import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import {
  createDefaultConfig,
  ensureTemporalThreadDirectories,
  type Integration,
  IntegrationSchema,
  loadConfig,
  resolveTemporalThreadPaths,
  TemporalThreadConfigSchema,
  writeConfig,
} from '@temporalthread/config';
import { SqliteStorage } from '@temporalthread/storage-sqlite';
import type { Command } from 'commander';
import { generateIntegrationExamples } from '../integration-examples.js';
import { printJson, printLines } from '../output.js';

interface InitOptions {
  integration?: string[];
  privacyMode?: string;
  timezone?: string;
  yes?: boolean;
  json?: boolean;
}

async function selectIntegrations(options: InitOptions): Promise<Integration[]> {
  let requested = options.integration;
  if (!requested && process.stdin.isTTY && process.stdout.isTTY) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await prompt.question(
        'Integrations to prepare (generic, codex, claude-code, opencode, ollama) [generic]: ',
      );
      requested = answer.trim() ? answer.split(',').map((value) => value.trim()) : ['generic'];
    } finally {
      prompt.close();
    }
  }
  const values = requested ?? ['generic'];
  return [...new Set(values.map((value) => IntegrationSchema.parse(value)))];
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize local configuration, SQLite storage, and integration examples')
    .option('-i, --integration <name...>', 'integration(s) to prepare')
    .option('--privacy-mode <mode>', 'metadata-only, temporal-references-only, or full-local-history')
    .option('--timezone <iana>', 'IANA timezone')
    .option('-y, --yes', 'approve updating an existing TemporalThread configuration')
    .option('--json', 'print machine-readable output')
    .action(async (options: InitOptions) => {
      const paths = resolveTemporalThreadPaths();
      const configExisted = existsSync(paths.configPath);
      const current = configExisted ? loadConfig(paths) : createDefaultConfig(paths);
      const integrations = await selectIntegrations(options);
      const requestedChange = Boolean(options.privacyMode || options.timezone || options.integration);
      if (configExisted && requestedChange && !options.yes) {
        throw new Error('Configuration already exists; pass --yes to update it with a backup');
      }
      const config = TemporalThreadConfigSchema.parse({
        ...current,
        ...(options.privacyMode ? { privacyMode: options.privacyMode } : {}),
        ...(options.timezone ? { timezone: options.timezone } : {}),
        enabledIntegrations: configExisted && !requestedChange ? current.enabledIntegrations : integrations,
      });
      ensureTemporalThreadDirectories(paths);
      const write =
        configExisted && !requestedChange
          ? { configPath: paths.configPath, backupPath: null, created: false }
          : writeConfig(config, paths);
      const storage = new SqliteStorage(config.databasePath);
      const migrationVersion = storage.getMigrationVersion();
      storage.close();
      const generated = generateIntegrationExamples(paths, config.enabledIntegrations);
      const result = {
        configPath: write.configPath,
        configCreated: write.created,
        backupPath: write.backupPath,
        databasePath: config.databasePath,
        migrationVersion,
        privacyMode: config.privacyMode,
        timezone: config.timezone,
        integrations: config.enabledIntegrations,
        generatedFiles: generated.filter((item) => item.created).map((item) => item.path),
        preservedFiles: generated.filter((item) => !item.created).map((item) => item.path),
        hostConfigurationsModified: false,
      };
      if (options.json) printJson(result);
      else {
        printLines([
          write.created ? `Created config: ${write.configPath}` : `Preserved config: ${write.configPath}`,
          `Opened database: ${config.databasePath} (migration ${migrationVersion})`,
          `Privacy mode: ${config.privacyMode}`,
          `Prepared integrations: ${config.enabledIntegrations.join(', ')}`,
          ...result.generatedFiles.map((path) => `Created example: ${path}`),
          'Host configurations were not modified; use the integration installers after reviewing examples.',
        ]);
      }
    });
}
