import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteStorage } from '@sudarshanchaudhari/temporalthread-storage-sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'));
const cliEntry = resolve('apps/cli/src/bin.ts');
const typecheckConfig = resolve('tsconfig.typecheck.json');
const temporaryHomes: string[] = [];

function temporaryHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'temporalthread-codex-hook-'));
  temporaryHomes.push(home);
  return home;
}

function runCodexHook(home: string, input: string, extraEnv: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [tsxCli, '--tsconfig', typecheckConfig, cliEntry, 'hook', 'codex'], {
    encoding: 'utf8',
    input,
    env: {
      ...process.env,
      TEMPORALTHREAD_HOME: home,
      TEMPORALTHREAD_TIMEZONE: 'UTC',
      TEMPORALTHREAD_LOG_LEVEL: 'silent',
      NO_COLOR: '1',
      ...extraEnv,
    },
    maxBuffer: 2 * 1_024 * 1_024,
  });
}

afterEach(() => {
  for (const home of temporaryHomes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe('temporalthread hook codex', () => {
  it.each([
    ['invalid JSON', 'private prompt, not json'],
    ['oversized input', 'private'.repeat(40_000)],
  ])('fails open with neutral JSON for %s', (_label, input) => {
    const result = runCodexHook(temporaryHome(), input);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('{}\n');
    expect(result.stderr).toBe('');
    expect(`${result.stdout}${result.stderr}`).not.toContain('private prompt');
  });

  it('fails open when storage cannot be opened without disclosing hook text', () => {
    const home = temporaryHome();
    const result = runCodexHook(
      home,
      JSON.stringify({
        session_id: 'unavailable-storage',
        turn_id: 'private-turn',
        cwd: home,
        hook_event_name: 'UserPromptSubmit',
        prompt: 'A private prompt must never appear in hook errors.',
      }),
      { TEMPORALTHREAD_DATABASE_PATH: home },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('{}\n');
    expect(result.stderr).toBe('');
    expect(`${result.stdout}${result.stderr}`).not.toContain('private prompt');
  });

  it('records a valid prompt through the executable boundary under the default privacy mode', () => {
    const home = temporaryHome();
    const result = runCodexHook(
      home,
      JSON.stringify({
        session_id: 'cli-hook-session',
        turn_id: 'cli-hook-turn',
        cwd: home,
        hook_event_name: 'UserPromptSubmit',
        prompt: 'Continue tomorrow with private details.',
      }),
    );

    expect(result.status).toBe(0);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(result.stderr).toBe('');

    const storage = new SqliteStorage(join(home, 'temporalthread.sqlite'));
    try {
      expect(storage.tableCounts()).toMatchObject({ interactions: 1, temporalReferences: 1 });
      expect(storage.listInteractions()[0]?.interaction.rawText).toBeNull();
    } finally {
      storage.close();
    }
  });
});
