import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';

const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'));
const serverEntry = resolve('apps/mcp-server/src/bin.ts');
const typecheckConfig = resolve('tsconfig.typecheck.json');

function createClient(home: string): {
  client: Client;
  transport: StdioClientTransport;
  stderr: string[];
} {
  const stderr: string[] = [];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCli, '--tsconfig', typecheckConfig, serverEntry],
    cwd: process.cwd(),
    env: {
      TEMPORALTHREAD_HOME: home,
      TEMPORALTHREAD_TIMEZONE: 'UTC',
      TEMPORALTHREAD_LOG_LEVEL: 'silent',
      NO_COLOR: '1',
    },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', (chunk) => stderr.push(String(chunk)));
  return {
    client: new Client({ name: 'temporalthread-stdio-test', version: '0.1.0' }),
    transport,
    stderr,
  };
}

describe('MCP stdio process', () => {
  it('persists an interaction across a real server process restart', async () => {
    const home = mkdtempSync(join(tmpdir(), 'temporalthread-mcp-'));
    const first = createClient(home);
    await first.client.connect(first.transport);
    const tools = await first.client.listTools();
    expect(tools.tools).toHaveLength(9);
    const recorded = await first.client.callTool({
      name: 'record_interaction',
      arguments: {
        role: 'user',
        occurredAt: '2026-07-15T13:00:00Z',
        timezone: 'UTC',
        agent: { name: 'Generic test', platform: 'generic' },
        sessionId: 'restart-session',
        text: 'Continue tomorrow.',
        idempotencyKey: 'restart-event',
      },
    });
    const interactionId = (recorded.structuredContent as { interactionId?: unknown } | undefined)
      ?.interactionId;
    expect(interactionId).toEqual(expect.any(String));
    await first.client.close();
    expect(first.stderr.join('')).toBe('');

    const second = createClient(home);
    await second.client.connect(second.transport);
    const last = await second.client.callTool({
      name: 'get_last_interaction',
      arguments: { sessionId: 'restart-session' },
    });
    expect(last.structuredContent).toMatchObject({
      interaction: {
        interactionId,
        timestamp: '2026-07-15T13:00:00Z',
        session: { externalSessionId: 'restart-session' },
      },
    });
    await second.client.close();
    expect(second.stderr.join('')).toBe('');
  });
});
