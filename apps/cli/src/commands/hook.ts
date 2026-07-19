import { createRuntime } from '@temporalthread/mcp-server';
import type { Command } from 'commander';
import { type HookHost, handleHostHook } from '../hook-adapter.js';
import { printJson } from '../output.js';

const MAX_HOOK_BYTES = 2 * 1_024 * 1_024;

async function readHookInput(): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    bytes += buffer.length;
    if (bytes > MAX_HOOK_BYTES) throw new Error('Hook input exceeds the 2 MiB limit');
    chunks.push(buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error('Hook input must be one JSON object');
  }
}

export function registerHookCommand(program: Command): void {
  program
    .command('hook')
    .description('Handle a documented Codex or Claude Code lifecycle hook from stdin')
    .argument('<host>', 'codex or claude-code')
    .action(async (host: string) => {
      if (host !== 'codex' && host !== 'claude-code') throw new Error('Unsupported hook host');
      if (process.stdin.isTTY) throw new Error('Hook input must be piped on stdin');
      const input = await readHookInput();
      const runtime = createRuntime();
      try {
        printJson(
          handleHostHook({
            host: host as HookHost,
            input,
            service: runtime.service,
            config: runtime.service.config,
          }),
        );
      } finally {
        runtime.storage.close();
      }
    });
}
