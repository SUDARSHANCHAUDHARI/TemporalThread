import { accessSync, constants, existsSync } from 'node:fs';
import { isValidTimezone, loadConfig, resolveTemporalThreadPaths } from '@temporalthread/config';
import { SystemClock, TemporalThreadService } from '@temporalthread/core';
import { createMcpServer } from '@temporalthread/mcp-server';
import type { DoctorCheck } from '@temporalthread/shared-types';
import { SqliteStorage } from '@temporalthread/storage-sqlite';
import type { Command } from 'commander';
import { expectedIntegrationExample } from '../integration-examples.js';
import { printJson, printLines } from '../output.js';

function check(name: string, operation: () => string): DoctorCheck {
  try {
    return { name, status: 'pass', detail: operation() };
  } catch (error) {
    return {
      name,
      status: 'fail',
      detail: error instanceof Error ? error.message : 'check failed',
    };
  }
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check runtime, storage, configuration, MCP registration, and selected integrations')
    .option('--json', 'print machine-readable output')
    .action((options: { json?: boolean }) => {
      const paths = resolveTemporalThreadPaths();
      const config = loadConfig(paths);
      let storage: SqliteStorage | undefined;
      const checks: DoctorCheck[] = [
        check('Node runtime', () => {
          const major = Number(process.versions.node.split('.')[0]);
          if (major < 24)
            throw new Error(`Node ${process.versions.node} is unsupported; use Node 24 or newer`);
          return `Node ${process.versions.node}`;
        }),
        check('Configuration directory', () => {
          accessSync(paths.configDir, constants.R_OK | constants.W_OK);
          return 'readable and writable';
        }),
        check('Timezone', () => {
          if (!isValidTimezone(config.timezone)) throw new Error('configured timezone is invalid');
          return config.timezone;
        }),
      ];
      try {
        storage = new SqliteStorage(config.databasePath);
        checks.push({ name: 'Database accessibility', status: 'pass', detail: 'database opened' });
      } catch {
        checks.push({
          name: 'Database accessibility',
          status: 'fail',
          detail: 'unable to open or migrate the configured database',
        });
      }
      if (storage) {
        const openedStorage = storage;
        checks.push(
          check('Database migration', () => {
            const current = openedStorage.getMigrationVersion();
            const latest = openedStorage.getLatestMigrationVersion();
            if (current !== latest) throw new Error(`migration ${current}; expected ${latest}`);
            return `migration ${current}`;
          }),
          check('Database integrity', () => {
            const integrity = openedStorage.integrityCheck();
            if (integrity !== 'ok') throw new Error(integrity);
            return integrity;
          }),
          check('MCP server startup', () => {
            createMcpServer(
              new TemporalThreadService({ storage: openedStorage, config, clock: new SystemClock() }),
            );
            return 'all tool registrations loaded';
          }),
        );
      }
      for (const integration of config.enabledIntegrations) {
        checks.push(
          check(`${integration} configuration example`, () => {
            const example = expectedIntegrationExample(integration);
            if (!existsSync(`${paths.integrationExamplesDir}/${example}`)) {
              throw new Error('run temporalthread init to generate the selected integration example');
            }
            return example;
          }),
        );
        if (integration === 'generic' || integration === 'ollama') {
          checks.push({
            name: `${integration} skill and hooks`,
            status: 'pass',
            detail: 'not required for this integration',
          });
        } else {
          checks.push({
            name: `${integration} skill and hooks`,
            status: 'warn',
            detail: 'run the host-specific installer and review host trust/permission status',
          });
        }
      }
      if (storage) storage.close();
      const result = { ok: checks.every((item) => item.status !== 'fail'), checks };
      if (options.json) printJson(result);
      else {
        printLines([
          ...checks.map((item) => `[${item.status.toUpperCase()}] ${item.name}: ${item.detail}`),
          result.ok ? 'TemporalThread doctor passed.' : 'TemporalThread doctor found failures.',
        ]);
      }
      if (!result.ok) process.exitCode = 1;
    });
}
