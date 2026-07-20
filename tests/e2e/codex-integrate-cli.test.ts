import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'));
const cliEntry = resolve('apps/cli/src/bin.ts');
const typecheckConfig = resolve('tsconfig.typecheck.json');
const temporaryRoots: string[] = [];

function temporaryRoot(label: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), `temporalthread-integrate-${label}-`)));
  temporaryRoots.push(root);
  return root;
}

function runCli(home: string, project: string, arguments_: string[], input?: string) {
  return spawnSync(process.execPath, [tsxCli, '--tsconfig', typecheckConfig, cliEntry, ...arguments_], {
    cwd: project,
    encoding: 'utf8',
    ...(input === undefined ? {} : { input }),
    env: {
      ...process.env,
      TEMPORALTHREAD_HOME: home,
      TEMPORALTHREAD_TIMEZONE: 'UTC',
      TEMPORALTHREAD_LOG_LEVEL: 'silent',
      NO_COLOR: '1',
    },
    maxBuffer: 2 * 1_024 * 1_024,
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('temporalthread integrate codex CLI', () => {
  it('prints a valid manual MCP configuration without modifying files', () => {
    const home = temporaryRoot('home');
    const project = temporaryRoot('project');
    const result = runCli(home, project, [
      'integrate',
      'codex',
      'print-config',
      '--scope',
      'project',
      '--json',
    ]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      scope: 'project',
      configPath: join(project, '.codex', 'config.toml'),
    });
    expect(result.stdout).toContain('[mcp_servers.temporal-thread]');
    expect(result.stderr).toBe('');
    expect(existsSync(join(project, '.codex'))).toBe(false);
  });

  it('performs a zero-write dry-run and reports the complete skill-only plan', () => {
    const home = temporaryRoot('home');
    const project = temporaryRoot('project');
    const result = runCli(home, project, [
      'integrate',
      'codex',
      'install',
      '--scope',
      'project',
      '--skill-only',
      '--dry-run',
      '--yes',
      '--json',
    ]);
    const output = JSON.parse(result.stdout) as {
      dryRun: boolean;
      components: string[];
      changed: string[];
    };

    expect(result.status).toBe(0);
    expect(output).toMatchObject({ dryRun: true, components: ['skill'] });
    expect(output.changed).toContain(join(project, '.agents', 'skills', 'temporal-awareness', 'SKILL.md'));
    expect(existsSync(join(project, '.agents'))).toBe(false);
    expect(existsSync(join(home, 'config.json'))).toBe(false);
    expect(existsSync(join(home, 'temporalthread.sqlite'))).toBe(false);
  });

  it('returns a structured nonzero dry-run result for a missing MCP prerequisite', () => {
    const home = temporaryRoot('home');
    const project = temporaryRoot('project');
    const result = runCli(home, project, [
      'integrate',
      'codex',
      'install',
      '--scope',
      'project',
      '--mcp-only',
      '--development-cli',
      join(project, 'missing-cli.js'),
      '--dry-run',
      '--yes',
      '--json',
    ]);

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      error: { code: 'mcp-unavailable' },
    });
    expect(result.stderr).toBe('');
    expect(existsSync(join(project, '.codex'))).toBe(false);
    expect(existsSync(join(home, 'config.json'))).toBe(false);
    expect(existsSync(join(home, 'temporalthread.sqlite'))).toBe(false);
  });

  it('installs, reports status, removes the skill, and preserves TemporalThread storage', () => {
    const home = temporaryRoot('home');
    const project = temporaryRoot('project');
    const installed = runCli(home, project, [
      'integrate',
      'codex',
      'install',
      '--scope',
      'project',
      '--skill-only',
      '--privacy',
      'temporal-references-only',
      '--yes',
      '--json',
    ]);
    expect(installed.status).toBe(0);
    expect(JSON.parse(installed.stdout)).toMatchObject({
      action: 'installed',
      components: ['skill'],
      privacyMode: 'temporal-references-only',
    });
    expect(existsSync(join(home, 'config.json'))).toBe(true);
    expect(existsSync(join(home, 'temporalthread.sqlite'))).toBe(true);

    const status = runCli(home, project, ['integrate', 'codex', 'status', '--scope', 'project', '--json']);
    expect(status.status).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({
      installed: true,
      integrationVersion: '0.1.0',
      configuredPrivacyMode: 'temporal-references-only',
      database: { accessible: true, schemaVersion: 2 },
      skill: { installed: true },
    });

    const removed = runCli(home, project, [
      'integrate',
      'codex',
      'remove-skill',
      '--scope',
      'project',
      '--yes',
      '--json',
    ]);
    expect(removed.status).toBe(0);
    expect(JSON.parse(removed.stdout)).toMatchObject({ databasePreserved: true });
    expect(existsSync(join(project, '.agents', 'skills', 'temporal-awareness', 'SKILL.md'))).toBe(false);
    expect(existsSync(join(home, 'temporalthread.sqlite'))).toBe(true);
  });

  it('provides JSON and human-readable doctor output with recommended fixes', () => {
    const home = temporaryRoot('home');
    const project = temporaryRoot('project');
    const json = runCli(home, project, ['integrate', 'codex', 'doctor', '--scope', 'project', '--json']);
    const parsed = JSON.parse(json.stdout) as {
      checks: Array<{ status: string; recommendedFix: string | null }>;
    };
    expect(parsed.checks.some((check) => check.status === 'WARN')).toBe(true);
    expect(parsed.checks.some((check) => check.recommendedFix)).toBe(true);

    const human = runCli(home, project, ['integrate', 'codex', 'doctor', '--scope', 'project']);
    expect(human.stdout).toContain('[WARN]');
    expect(human.stdout).toContain('Fix:');
  });

  it('reports an invalid TemporalThread configuration as structured doctor failure', () => {
    const home = temporaryRoot('home');
    const project = temporaryRoot('project');
    writeFileSync(
      join(home, 'config.json'),
      `${JSON.stringify({
        databasePath: join(home, 'temporalthread.sqlite'),
        timezone: 'UTC',
        locale: 'en-US',
        privacyMode: 'invalid-private-mode',
        sessionInactivityThresholdMinutes: 30,
        temporalContextRefreshThresholdMinutes: 30,
        maxTextBytes: 100_000,
        enabledIntegrations: ['codex'],
        logLevel: 'silent',
      })}\n`,
      'utf8',
    );

    const result = runCli(home, project, ['integrate', 'codex', 'doctor', '--scope', 'project', '--json']);
    const output = JSON.parse(result.stdout) as {
      ok: boolean;
      checks: Array<{ name: string; status: string }>;
    };

    expect(result.status).toBe(1);
    expect(output.ok).toBe(false);
    expect(output.checks).toContainEqual(
      expect.objectContaining({ name: 'TemporalThread configuration', status: 'FAIL' }),
    );
    expect(result.stderr).toBe('');
  });

  it('purges stored interactions only with the explicit uninstall purge flag', () => {
    const home = temporaryRoot('home');
    const project = temporaryRoot('project');
    expect(
      runCli(home, project, [
        'integrate',
        'codex',
        'install',
        '--scope',
        'project',
        '--skill-only',
        '--yes',
        '--json',
      ]).status,
    ).toBe(0);
    expect(
      runCli(
        home,
        project,
        ['hook', 'codex'],
        JSON.stringify({
          session_id: 'purge-session',
          turn_id: 'purge-turn',
          cwd: project,
          hook_event_name: 'UserPromptSubmit',
          prompt: 'Continue tomorrow.',
        }),
      ).status,
    ).toBe(0);
    const before = JSON.parse(
      runCli(home, project, ['integrate', 'codex', 'status', '--scope', 'project', '--json']).stdout,
    ) as { database: { lastSuccessfulInteraction: unknown } };
    expect(before.database.lastSuccessfulInteraction).not.toBeNull();

    const removed = runCli(home, project, [
      'integrate',
      'codex',
      'uninstall',
      '--scope',
      'project',
      '--purge-data',
      '--yes',
      '--json',
    ]);
    expect(removed.status).toBe(0);
    expect(JSON.parse(removed.stdout)).toMatchObject({ dataPurged: true });

    const after = JSON.parse(
      runCli(home, project, ['integrate', 'codex', 'status', '--scope', 'project', '--json']).stdout,
    ) as { database: { lastSuccessfulInteraction: unknown } };
    expect(after.database.lastSuccessfulInteraction).toBeNull();
    expect(existsSync(join(home, 'temporalthread.sqlite'))).toBe(true);
  });
});
