import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidTimezone, loadConfig, resolveTemporalThreadPaths } from '@temporalthread/config';
import { SystemClock, TemporalThreadService } from '@temporalthread/core';
import { createMcpServer } from '@temporalthread/mcp-server';
import type { DoctorCheck } from '@temporalthread/shared-types';
import { inspectDatabaseHealth, SqliteStorage } from '@temporalthread/storage-sqlite';
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

function installationCheck(name: string, path: string, label: string, marker?: string): DoctorCheck {
  if (!existsSync(path)) return { name, status: 'warn', detail: `${label} is not installed` };
  try {
    if (marker && !readFileSync(path, 'utf8').includes(marker)) {
      return { name, status: 'warn', detail: `${label} does not contain a TemporalThread entry` };
    }
    return { name, status: 'pass', detail: `${label} is installed` };
  } catch {
    return { name, status: 'fail', detail: `${label} could not be read` };
  }
}

function hostInstallationChecks(integration: string, projectRoot: string): DoctorCheck[] {
  if (integration === 'codex') {
    return [
      installationCheck(
        'codex agent configuration',
        join(projectRoot, '.codex/config.toml'),
        '.codex/config.toml',
        'mcp_servers.temporal-thread',
      ),
      installationCheck(
        'codex skill installation',
        join(projectRoot, '.agents/skills/temporal-awareness/SKILL.md'),
        'Codex TemporalThread skill',
      ),
      installationCheck(
        'codex hook installation',
        join(projectRoot, '.codex/hooks.json'),
        '.codex/hooks.json',
        'temporalthread hook codex',
      ),
    ];
  }
  if (integration === 'claude-code') {
    return [
      installationCheck(
        'claude-code agent configuration',
        join(projectRoot, '.mcp.json'),
        '.mcp.json',
        'temporal-thread',
      ),
      installationCheck(
        'claude-code skill installation',
        join(projectRoot, '.claude/skills/temporalthread/SKILL.md'),
        'Claude Code TemporalThread skill',
      ),
      installationCheck(
        'claude-code hook installation',
        join(projectRoot, '.claude/settings.json'),
        '.claude/settings.json',
        'temporalthread hook claude-code',
      ),
    ];
  }
  if (integration === 'opencode') {
    return [
      installationCheck(
        'opencode agent configuration',
        join(projectRoot, 'opencode.json'),
        'opencode.json',
        'temporal-thread',
      ),
      installationCheck(
        'opencode skill installation',
        join(projectRoot, '.opencode/skills/temporalthread/SKILL.md'),
        'OpenCode TemporalThread skill',
      ),
      installationCheck(
        'opencode plugin installation',
        join(projectRoot, '.opencode/plugins/temporalthread.ts'),
        'OpenCode TemporalThread plugin',
      ),
    ];
  }
  return [
    {
      name: `${integration} host installation`,
      status: 'pass',
      detail: 'no host configuration, skill, or hook installation is required',
    },
  ];
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
        const health = inspectDatabaseHealth(openedStorage.database);
        checks.push(
          check('Database migration', () => {
            if (health.migrationVersion !== health.latestMigrationVersion) {
              throw new Error(
                `migration ${health.migrationVersion}; expected ${health.latestMigrationVersion}`,
              );
            }
            if (health.userVersion !== health.latestMigrationVersion) {
              throw new Error(
                `SQLite user version ${health.userVersion}; expected ${health.latestMigrationVersion}`,
              );
            }
            return `migration ${health.migrationVersion}`;
          }),
          check('Database integrity', () => {
            if (health.integrity !== 'ok' || health.quickCheck !== 'ok') {
              throw new Error(`integrity=${health.integrity}; quick=${health.quickCheck}`);
            }
            return 'integrity and quick checks passed';
          }),
          check('Database relationships', () => {
            if (health.foreignKeyViolations !== 0) {
              throw new Error(`${health.foreignKeyViolations} foreign-key violation(s)`);
            }
            return 'foreign-key check passed';
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
        checks.push(...hostInstallationChecks(integration, process.cwd()));
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
