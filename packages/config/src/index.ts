import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { LogLevelSchema, PrivacyModeSchema } from '@temporalthread/shared-types';
import { z } from 'zod';

export const IntegrationSchema = z.enum(['codex', 'claude-code', 'opencode', 'ollama', 'generic']);

export const TemporalThreadConfigSchema = z
  .object({
    databasePath: z.string().trim().min(1).max(4096),
    timezone: z.string().trim().min(1).max(128),
    locale: z.string().trim().min(2).max(35),
    privacyMode: PrivacyModeSchema,
    sessionInactivityThresholdMinutes: z.number().int().min(1).max(10_080),
    temporalContextRefreshThresholdMinutes: z.number().int().min(1).max(10_080),
    maxTextBytes: z.number().int().min(1).max(1_000_000),
    enabledIntegrations: z.array(IntegrationSchema),
    logLevel: LogLevelSchema,
  })
  .strict();

export type TemporalThreadConfig = z.infer<typeof TemporalThreadConfigSchema>;
export type Integration = z.infer<typeof IntegrationSchema>;

export interface TemporalThreadPaths {
  configDir: string;
  dataDir: string;
  configPath: string;
  databasePath: string;
  integrationExamplesDir: string;
}

export interface ConfigWriteResult {
  configPath: string;
  backupPath: string | null;
  created: boolean;
}

const parseInteger = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function detectSystemTimezone(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone && isValidTimezone(timezone) ? timezone : 'UTC';
}

export function resolveTemporalThreadPaths(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  userHome = homedir(),
): TemporalThreadPaths {
  const explicitHome = env.TEMPORALTHREAD_HOME;
  let configDir: string;
  let dataDir: string;

  if (explicitHome) {
    configDir = resolve(explicitHome);
    dataDir = configDir;
  } else if (platform === 'darwin') {
    configDir = join(userHome, 'Library', 'Application Support', 'TemporalThread');
    dataDir = configDir;
  } else if (platform === 'win32') {
    const appData = env.APPDATA ? resolve(env.APPDATA) : join(userHome, 'AppData', 'Roaming');
    configDir = join(appData, 'TemporalThread');
    dataDir = configDir;
  } else {
    configDir = join(
      env.XDG_CONFIG_HOME ? resolve(env.XDG_CONFIG_HOME) : join(userHome, '.config'),
      'temporalthread',
    );
    dataDir = join(
      env.XDG_DATA_HOME ? resolve(env.XDG_DATA_HOME) : join(userHome, '.local', 'share'),
      'temporalthread',
    );
  }

  const configPath = resolve(env.TEMPORALTHREAD_CONFIG_PATH ?? join(configDir, 'config.json'));
  const databasePath = resolve(env.TEMPORALTHREAD_DATABASE_PATH ?? join(dataDir, 'temporalthread.sqlite'));
  return {
    configDir: dirname(configPath),
    dataDir: dirname(databasePath),
    configPath,
    databasePath,
    integrationExamplesDir: join(dirname(configPath), 'integrations'),
  };
}

export function createDefaultConfig(
  paths = resolveTemporalThreadPaths(),
  env: NodeJS.ProcessEnv = process.env,
): TemporalThreadConfig {
  return TemporalThreadConfigSchema.parse({
    databasePath: paths.databasePath,
    timezone: env.TEMPORALTHREAD_TIMEZONE ?? detectSystemTimezone(),
    locale: env.TEMPORALTHREAD_LOCALE ?? 'en-US',
    privacyMode: env.TEMPORALTHREAD_PRIVACY_MODE ?? 'temporal-references-only',
    sessionInactivityThresholdMinutes: parseInteger(env.TEMPORALTHREAD_SESSION_INACTIVITY_MINUTES) ?? 30,
    temporalContextRefreshThresholdMinutes: parseInteger(env.TEMPORALTHREAD_CONTEXT_REFRESH_MINUTES) ?? 30,
    maxTextBytes: parseInteger(env.TEMPORALTHREAD_MAX_TEXT_BYTES) ?? 100_000,
    enabledIntegrations: ['generic'],
    logLevel: env.TEMPORALTHREAD_LOG_LEVEL ?? 'warn',
  });
}

function applyEnvironmentOverrides(
  config: TemporalThreadConfig,
  env: NodeJS.ProcessEnv,
): TemporalThreadConfig {
  return TemporalThreadConfigSchema.parse({
    ...config,
    databasePath: env.TEMPORALTHREAD_DATABASE_PATH ?? config.databasePath,
    timezone: env.TEMPORALTHREAD_TIMEZONE ?? config.timezone,
    locale: env.TEMPORALTHREAD_LOCALE ?? config.locale,
    privacyMode: env.TEMPORALTHREAD_PRIVACY_MODE ?? config.privacyMode,
    sessionInactivityThresholdMinutes:
      parseInteger(env.TEMPORALTHREAD_SESSION_INACTIVITY_MINUTES) ?? config.sessionInactivityThresholdMinutes,
    temporalContextRefreshThresholdMinutes:
      parseInteger(env.TEMPORALTHREAD_CONTEXT_REFRESH_MINUTES) ??
      config.temporalContextRefreshThresholdMinutes,
    maxTextBytes: parseInteger(env.TEMPORALTHREAD_MAX_TEXT_BYTES) ?? config.maxTextBytes,
    logLevel: env.TEMPORALTHREAD_LOG_LEVEL ?? config.logLevel,
  });
}

export function loadConfig(
  paths = resolveTemporalThreadPaths(),
  env: NodeJS.ProcessEnv = process.env,
): TemporalThreadConfig {
  const config = existsSync(paths.configPath)
    ? TemporalThreadConfigSchema.parse(JSON.parse(readFileSync(paths.configPath, 'utf8')))
    : createDefaultConfig(paths, env);
  const overridden = applyEnvironmentOverrides(config, env);
  if (!isValidTimezone(overridden.timezone)) throw new Error(`Invalid IANA timezone: ${overridden.timezone}`);
  return overridden;
}

export function ensureTemporalThreadDirectories(paths = resolveTemporalThreadPaths()): void {
  mkdirSync(paths.configDir, { recursive: true, mode: 0o700 });
  mkdirSync(paths.dataDir, { recursive: true, mode: 0o700 });
}

export function writeConfig(
  config: TemporalThreadConfig,
  paths = resolveTemporalThreadPaths(),
  options: { backup?: boolean } = {},
): ConfigWriteResult {
  const validated = TemporalThreadConfigSchema.parse(config);
  if (!isValidTimezone(validated.timezone)) throw new Error(`Invalid IANA timezone: ${validated.timezone}`);
  ensureTemporalThreadDirectories(paths);

  const created = !existsSync(paths.configPath);
  let backupPath: string | null = null;
  if (!created && options.backup !== false) {
    backupPath = `${paths.configPath}.backup-${new Date().toISOString().replaceAll(':', '-')}`;
    copyFileSync(paths.configPath, backupPath, 0);
  }

  const temporaryPath = `${paths.configPath}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporaryPath, paths.configPath);
  return { configPath: paths.configPath, backupPath, created };
}
