import { loadConfig, resolveTemporalThreadPaths } from '@temporalthread/config';
import { SqliteStorage } from '@temporalthread/storage-sqlite';
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
      const result = {
        version: '0.1.0',
        configPath: paths.configPath,
        databasePath: config.databasePath,
        timezone: config.timezone,
        privacyMode: config.privacyMode,
        enabledIntegrations: config.enabledIntegrations,
        migrationVersion: storage.getMigrationVersion(),
        latestMigrationVersion: storage.getLatestMigrationVersion(),
        integrity: storage.integrityCheck(),
        counts: storage.tableCounts(),
      };
      storage.close();
      if (options.json) printJson(result);
      else {
        printLines([
          `TemporalThread ${result.version}`,
          `Privacy: ${result.privacyMode}`,
          `Timezone: ${result.timezone}`,
          `Database integrity: ${result.integrity}`,
          `Interactions: ${result.counts.interactions}`,
          `Commitments: ${result.counts.commitments}`,
        ]);
      }
    });
}
