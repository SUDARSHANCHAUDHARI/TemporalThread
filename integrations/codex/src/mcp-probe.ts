import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';

export const TEMPORALTHREAD_MCP_TOOL_NAMES = [
  'get_current_time',
  'record_interaction',
  'get_temporal_context',
  'get_last_interaction',
  'calculate_elapsed_time',
  'resolve_relative_time',
  'record_commitment',
  'list_commitments',
  'update_commitment',
] as const;

const ProbeOptionsSchema = z
  .object({
    command: z.string().trim().min(1).max(4096),
    args: z.array(z.string().max(4096)).max(64).default([]),
    cwd: z.string().trim().min(1).max(4096).optional(),
    env: z.record(z.string().trim().min(1).max(256), z.string().max(16_384)).optional(),
    timeoutMs: z.number().int().min(100).max(60_000).default(5_000),
  })
  .strict();

export interface CodexMcpProbeResult {
  ok: boolean;
  toolNames: string[];
  durationMs: number;
  errorCode?: 'invalid-options' | 'spawn-failed' | 'timeout' | 'handshake-failed' | 'missing-tools';
}

export function probeCodexMcpExecutable(options: {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
}): CodexMcpProbeResult {
  const startedAt = performance.now();
  const parsed = ProbeOptionsSchema.safeParse(options);
  if (!parsed.success) return { ok: false, toolNames: [], durationMs: 0, errorCode: 'invalid-options' };
  const args = [...parsed.data.args];
  if (args.at(-1) === 'start') args.splice(-1, 1, '--version');
  else args.push('--version');
  const result = spawnSync(parsed.data.command, args, {
    cwd: parsed.data.cwd,
    encoding: 'utf8',
    stdio: 'ignore',
    timeout: parsed.data.timeoutMs,
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    toolNames: [],
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    ...(result.status === 0 ? {} : { errorCode: 'spawn-failed' as const }),
  };
}

class ProbeTimeoutError extends Error {}

export async function probeCodexMcpServer(options: {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}): Promise<CodexMcpProbeResult> {
  const startedAt = performance.now();
  const parsed = ProbeOptionsSchema.safeParse(options);
  if (!parsed.success) {
    return { ok: false, toolNames: [], durationMs: 0, errorCode: 'invalid-options' };
  }

  const transport = new StdioClientTransport({
    command: parsed.data.command,
    args: parsed.data.args,
    ...(parsed.data.cwd ? { cwd: parsed.data.cwd } : {}),
    ...(parsed.data.env ? { env: { ...getDefaultEnvironment(), ...parsed.data.env } } : {}),
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => {
    // Drain child diagnostics without forwarding potentially sensitive local output.
  });
  const client = new Client({ name: 'temporalthread-codex-doctor', version: '0.1.0' });
  let timeout: NodeJS.Timeout | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new ProbeTimeoutError('MCP probe timed out')), parsed.data.timeoutMs);
    });
    await Promise.race([client.connect(transport), timeoutPromise]);
    const listed = await Promise.race([client.listTools(), timeoutPromise]);
    const toolNames = listed.tools.map((tool) => tool.name);
    const missing = TEMPORALTHREAD_MCP_TOOL_NAMES.filter((name) => !toolNames.includes(name));
    return {
      ok: missing.length === 0,
      toolNames,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ...(missing.length ? { errorCode: 'missing-tools' as const } : {}),
    };
  } catch (error) {
    const errorCode =
      error instanceof ProbeTimeoutError
        ? 'timeout'
        : transport.pid === null
          ? 'spawn-failed'
          : 'handshake-failed';
    return {
      ok: false,
      toolNames: [],
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      errorCode,
    };
  } finally {
    if (timeout) clearTimeout(timeout);
    await client.close().catch(() => undefined);
  }
}
