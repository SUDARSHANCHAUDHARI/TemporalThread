#!/usr/bin/env node
import { startStdioServer } from './stdio.js';

async function main(): Promise<void> {
  const running = await startStdioServer();
  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    await running.close();
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

main().catch(() => {
  process.stderr.write('TemporalThread MCP server failed to start\n');
  process.exitCode = 1;
});
