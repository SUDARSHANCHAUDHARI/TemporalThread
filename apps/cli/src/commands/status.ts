import { loadConfig, resolveTemporalThreadPaths } from '@temporalthread/config';
import { inspectDatabaseHealth, SqliteStorage } from '@temporalthread/storage-sqlite';
import type { Command } from 'commander';
import { printJson, printLines } from '../output.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show local configuration and persistence status without private content')
    .option('--json', 'print machine-readable output')
    .action((options: { json?: boolean }) => {
      const paths = resolveTemporalThreadPaths();
      const config = loadConfig(paths);
      const storage = new SqliteStorage(config.databasePath);
      try {
        const health = inspectDatabaseHealth(storage.database);
        const result = {
          version: '0.1.0',
          configPath: paths.configPath,
          databasePath: config.databasePath,
          timezone: config.timezone,
          privacyMode: config.privacyMode,
          enabledIntegrations: config.enabledIntegrations,
          migrationVersion: health.migrationVersion,
          latestMigrationVersion: health.latestMigrationVersion,
          userVersion: health.userVersion,
          integrity: health.integrity,
          quickCheck: health.quickCheck,
          foreignKeyViolations: health.foreignKeyViolations,
          healthy: health.healthy,
          counts: storage.tableCounts(),
        };
        if (options.json) printJson(result);
        else {
          printLines([
            `TemporalThread ${result.version}`,
            `Privacy: ${result.privacyMode}`,
            `Timezone: ${result.timezone}`,
            `Database health: ${result.healthy ? 'healthy' : 'unhealthy'}`,
            `Database integrity: ${result.integrity}`,
            `Interactions: ${result.counts.interactions}`,
            `Commitments: ${result.counts.commitments}`,
          ]);
        }
        if (!result.healthy) process.exitCode = 1;
      } finally {
        storage.close();
      }
    });
}
