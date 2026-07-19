import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const executeFile = promisify(execFile);
const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'));
const cliEntry = resolve('apps/cli/src/bin.ts');
const typecheckConfig = resolve('tsconfig.typecheck.json');

async function runCli(home: string, arguments_: string[]): Promise<{ stdout: string; stderr: string }> {
  return executeFile(process.execPath, [tsxCli, '--tsconfig', typecheckConfig, cliEntry, ...arguments_], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TEMPORALTHREAD_HOME: home,
      TEMPORALTHREAD_TIMEZONE: 'UTC',
      TEMPORALTHREAD_LOG_LEVEL: 'silent',
      NO_COLOR: '1',
    },
    maxBuffer: 10 * 1_024 * 1_024,
  });
}

describe('temporalthread CLI', () => {
  it('initializes an isolated installation and reports a passing doctor result', async () => {
    const home = mkdtempSync(join(tmpdir(), 'temporalthread-cli-'));
    const initialized = await runCli(home, [
      'init',
      '--yes',
      '--timezone',
      'UTC',
      '--integration',
      'generic',
      '--json',
    ]);
    const initResult = JSON.parse(initialized.stdout) as {
      configCreated: boolean;
      privacyMode: string;
      migrationVersion: number;
      hostConfigurationsModified: boolean;
    };
    expect(initResult).toEqual(
      expect.objectContaining({
        configCreated: true,
        privacyMode: 'temporal-references-only',
        migrationVersion: 2,
        hostConfigurationsModified: false,
      }),
    );
    expect(initialized.stderr).toBe('');

    const doctor = JSON.parse((await runCli(home, ['doctor', '--json'])).stdout) as {
      ok: boolean;
      checks: Array<{ name: string; status: string }>;
    };
    expect(doctor.ok).toBe(true);
    expect(doctor.checks.find((item) => item.name === 'MCP server startup')?.status).toBe('pass');
    expect(doctor.checks.find((item) => item.name === 'Database integrity')?.status).toBe('pass');

    const changed = JSON.parse(
      (await runCli(home, ['config', 'set', 'locale', 'en-GB', '--json'])).stdout,
    ) as { backupPath: string | null; value: string };
    expect(changed.value).toBe('en-GB');
    expect(changed.backupPath).toEqual(expect.any(String));
  });

  it('ingests JSONL, lists metadata, exports the private representation, and requires purge confirmation', async () => {
    const home = mkdtempSync(join(tmpdir(), 'temporalthread-cli-'));
    await runCli(home, ['init', '--yes', '--timezone', 'UTC', '--integration', 'generic', '--json']);
    const projectPath = join(home, 'example-project');
    const eventsPath = join(home, 'events.jsonl');
    const events = [
      {
        eventType: 'interaction',
        role: 'user',
        occurredAt: '2026-07-15T13:00:00Z',
        timezone: 'UTC',
        agent: { name: 'Generic', platform: 'generic' },
        project: { path: projectPath, name: 'Example' },
        sessionId: 'cli-session',
        text: 'Continue tomorrow.',
        idempotencyKey: 'cli-event-1',
      },
      {
        eventType: 'interaction',
        role: 'assistant',
        occurredAt: '2026-07-15T13:01:00Z',
        timezone: 'UTC',
        agent: { name: 'Generic', platform: 'generic' },
        project: { path: projectPath, name: 'Example' },
        sessionId: 'cli-session',
        text: 'Acknowledged.',
        idempotencyKey: 'cli-event-2',
      },
    ];
    writeFileSync(eventsPath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');

    const ingested = JSON.parse((await runCli(home, ['ingest', '--file', eventsPath, '--json'])).stdout) as {
      ingested: number;
    };
    expect(ingested.ingested).toBe(2);

    const status = JSON.parse((await runCli(home, ['status', '--json'])).stdout) as {
      counts: { interactions: number; temporalReferences: number };
      integrity: string;
    };
    expect(status).toMatchObject({
      counts: { interactions: 2, temporalReferences: 1 },
      integrity: 'ok',
    });

    const timeline = JSON.parse(
      (await runCli(home, ['timeline', '--project', projectPath, '--json'])).stdout,
    ) as { timeline: Array<{ role: string; temporalReferenceCount: number }> };
    expect(timeline.timeline.map((item) => item.role)).toEqual(['assistant', 'user']);
    expect(timeline.timeline[1]?.temporalReferenceCount).toBe(1);

    const exportPath = join(home, 'export.json');
    await runCli(home, ['export', '--output', exportPath]);
    const exported = JSON.parse(readFileSync(exportPath, 'utf8')) as {
      interactions: Array<{ rawText: string | null; textPreview: string | null }>;
    };
    expect(exported.interactions).toHaveLength(2);
    expect(exported.interactions.every((item) => item.rawText === null && item.textPreview === null)).toBe(
      true,
    );

    try {
      await runCli(home, ['purge', '--json']);
      throw new Error('purge unexpectedly succeeded');
    } catch (error) {
      expect(String((error as { stderr?: string }).stderr)).toContain('pass --yes');
    }

    const purged = JSON.parse((await runCli(home, ['purge', '--yes', '--json'])).stdout) as {
      deleted: { interactions: number };
    };
    expect(purged.deleted.interactions).toBe(2);
    const after = JSON.parse((await runCli(home, ['status', '--json'])).stdout) as {
      counts: { interactions: number };
    };
    expect(after.counts.interactions).toBe(0);
  });
});
