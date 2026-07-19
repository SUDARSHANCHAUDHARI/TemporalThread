import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const integrationDirectory = resolve('integrations/codex');

function run(script: string, target: string): Record<string, unknown> {
  return JSON.parse(
    execFileSync(process.execPath, [join(integrationDirectory, script), '--target', target], {
      encoding: 'utf8',
    }),
  ) as Record<string, unknown>;
}

describe('Codex project integration installer', () => {
  let target: string;

  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), 'temporalthread-codex-installer-'));
  });

  afterEach(() => rmSync(target, { recursive: true, force: true }));

  it('installs idempotently, preserves unrelated settings, and removes only owned entries', () => {
    const codexDirectory = join(target, '.codex');
    execFileSync(process.execPath, [join(integrationDirectory, 'install.mjs'), '--target', target]);
    const firstConfig = readFileSync(join(codexDirectory, 'config.toml'), 'utf8');
    expect(firstConfig).toContain('# temporalthread:start');
    expect(firstConfig).toContain('[mcp_servers.temporal-thread]');

    const hooksPath = join(codexDirectory, 'hooks.json');
    const hooks = JSON.parse(readFileSync(hooksPath, 'utf8')) as {
      hooks: Record<string, unknown[]>;
    };
    hooks.hooks.PreToolUse = [{ hooks: [{ type: 'command', command: 'safe-local-check' }] }];
    writeFileSync(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);

    const second = run('install.mjs', target);
    expect(second.changed).toEqual([]);
    expect((second.preserved as string[]).length).toBe(3);

    const diagnosis = run('doctor.mjs', target);
    expect(diagnosis.ok).toBe(true);

    run('uninstall.mjs', target);
    const finalHooks = readFileSync(hooksPath, 'utf8');
    expect(finalHooks).toContain('safe-local-check');
    expect(finalHooks).not.toContain('temporalthread hook codex');
    expect(readFileSync(join(codexDirectory, 'config.toml'), 'utf8')).not.toContain('temporalthread');
    expect(existsSync(join(target, '.agents/skills/temporalthread/SKILL.md'))).toBe(false);
  });

  it('backs up and preserves a locally edited installed skill during uninstall', () => {
    const installed = run('install.mjs', target);
    expect((installed.changed as string[]).length).toBe(3);
    const skillPath = join(target, '.agents/skills/temporalthread/SKILL.md');
    writeFileSync(skillPath, `${readFileSync(skillPath, 'utf8')}\nLocal note.\n`);

    const removed = run('uninstall.mjs', target);
    expect(removed.preserved).toContain(skillPath);
    expect(readFileSync(skillPath, 'utf8')).toContain('Local note.');
    expect((removed.backups as string[]).length).toBeGreaterThan(0);
  });
});
