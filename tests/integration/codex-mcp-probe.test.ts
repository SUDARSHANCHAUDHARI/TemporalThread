import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { probeCodexMcpServer } from '../../integrations/codex/src/index.js';

const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'));

describe('Codex MCP server probe', () => {
  it('performs a real stdio handshake and verifies all TemporalThread tools', async () => {
    const home = mkdtempSync(join(tmpdir(), 'temporalthread-codex-probe-'));
    const result = await probeCodexMcpServer({
      command: process.execPath,
      args: [
        tsxCli,
        '--tsconfig',
        resolve('tsconfig.typecheck.json'),
        resolve('apps/cli/src/bin.ts'),
        'start',
      ],
      cwd: process.cwd(),
      env: {
        TEMPORALTHREAD_HOME: home,
        TEMPORALTHREAD_TIMEZONE: 'UTC',
        TEMPORALTHREAD_LOG_LEVEL: 'silent',
        NO_COLOR: '1',
      },
      timeoutMs: 10_000,
    });

    expect(result.ok).toBe(true);
    expect(result.errorCode).toBeUndefined();
    expect(result.toolNames).toHaveLength(9);
    expect(result.toolNames).toContain('get_temporal_context');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns a safe failure code when the command cannot start', async () => {
    const result = await probeCodexMcpServer({
      command: resolve('missing-temporalthread-command'),
      args: [],
      timeoutMs: 1_000,
    });

    expect(result).toMatchObject({ ok: false, toolNames: [] });
    expect(['spawn-failed', 'handshake-failed']).toContain(result.errorCode);
    expect(JSON.stringify(result)).not.toContain('ENOENT');
  });
});
