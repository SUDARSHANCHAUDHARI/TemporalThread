import { loadConfig, resolveTemporalThreadPaths } from '@temporalthread/config';
import { FakeClock, TemporalThreadService } from '@temporalthread/core';
import { SqliteStorage } from '@temporalthread/storage-sqlite';
import { startStdioServer } from '../../apps/mcp-server/src/stdio.js';

async function main(): Promise<void> {
  const now = process.env.TEMPORALTHREAD_TEST_NOW;
  if (!now) throw new Error('TEMPORALTHREAD_TEST_NOW is required');
  const paths = resolveTemporalThreadPaths();
  const config = loadConfig(paths);
  const storage = new SqliteStorage(config.databasePath);
  const service = new TemporalThreadService({ storage, config, clock: new FakeClock(now) });
  await startStdioServer({ storage, service });
}

main().catch(() => {
  process.stderr.write('TemporalThread test MCP server failed to start\n');
  process.exitCode = 1;
});
