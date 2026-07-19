import {
  loadConfig,
  resolveTemporalThreadPaths,
  TemporalThreadConfigSchema,
  writeConfig,
} from '@temporalthread/config';
import type { Command } from 'commander';
import { printJson, printLines } from '../output.js';

const numericKeys = new Set([
  'sessionInactivityThresholdMinutes',
  'temporalContextRefreshThresholdMinutes',
  'maxTextBytes',
]);
const configurableKeys = new Set([
  'databasePath',
  'timezone',
  'locale',
  'privacyMode',
  ...numericKeys,
  'enabledIntegrations',
  'logLevel',
]);

function parsedValue(key: string, value: string): unknown {
  if (numericKeys.has(key)) return Number(value);
  if (key === 'enabledIntegrations') return value.split(',').map((item) => item.trim());
  return value;
}

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Show, read, or safely update TemporalThread configuration')
    .argument('[action]', 'show, path, get, or set', 'show')
    .argument('[key]', 'configuration key')
    .argument('[value]', 'new value')
    .option('--json', 'print machine-readable output')
    .action(
      (action: string, key: string | undefined, value: string | undefined, options: { json?: boolean }) => {
        const paths = resolveTemporalThreadPaths();
        if (action === 'path') {
          if (options.json) printJson({ configPath: paths.configPath });
          else printLines([paths.configPath]);
          return;
        }
        const config = loadConfig(paths);
        if (action === 'show') {
          printJson(config);
          return;
        }
        if (!key || !configurableKeys.has(key)) throw new Error('Unknown or missing configuration key');
        if (action === 'get') {
          const selected = config[key as keyof typeof config];
          if (options.json) printJson({ key, value: selected });
          else printLines([String(selected)]);
          return;
        }
        if (action !== 'set' || value === undefined) {
          throw new Error('Usage: temporalthread config set <key> <value>');
        }
        const updated = TemporalThreadConfigSchema.parse({ ...config, [key]: parsedValue(key, value) });
        const result = writeConfig(updated, paths);
        if (options.json) printJson({ key, value: updated[key as keyof typeof updated], ...result });
        else printLines([`Updated ${key}; backup: ${result.backupPath ?? 'none'}`]);
      },
    );
}
