import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import {
  assertCodexPathsWritable,
  CODEX_INTEGRATION_VERSION,
  CodexInstallationScopeSchema,
  compareSemanticVersions,
  getCodexIntegrationStatus,
  installCodexIntegration,
  probeCodexMcpExecutable,
  probeCodexMcpServer,
  renderCodexMcpConfiguration,
  resolveCodexIntegrationPaths,
  TEMPORALTHREAD_MCP_TOOL_NAMES,
  uninstallCodexIntegration,
} from '@temporalthread/codex-integration';
import {
  createDefaultConfig,
  loadConfig,
  resolveTemporalThreadPaths,
  TemporalThreadConfigSchema,
  writeConfig,
} from '@temporalthread/config';
import { SystemClock, TemporalThreadService } from '@temporalthread/core';
import { type PrivacyMode, PrivacyModeSchema } from '@temporalthread/shared-types';
import { SqliteStorage } from '@temporalthread/storage-sqlite';
import type { Command } from 'commander';
import { printJson, printLines } from '../output.js';

type Scope = 'user' | 'project';

interface ScopeOptions {
  scope?: string;
  json?: boolean;
}

interface InstallOptions extends ScopeOptions {
  privacy?: string;
  yes?: boolean;
  dryRun?: boolean;
  hooks?: boolean;
  skillOnly?: boolean;
  mcpOnly?: boolean;
  developmentCli?: string;
}

interface UninstallOptions extends ScopeOptions {
  yes?: boolean;
  dryRun?: boolean;
  purgeData?: boolean;
}

interface DoctorCheck {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
  recommendedFix: string | null;
}

async function runCodexCommand(options: { json?: boolean }, operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!options.json) throw error;
    const code =
      error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'operation-failed';
    printJson({
      ok: false,
      error: {
        code,
        message: error instanceof Error ? error.message : 'Codex integration command failed',
      },
    });
    process.exitCode = 1;
  }
}

function detectCodexSurface(): 'codex-cli' | 'unknown' {
  const detected = spawnSync('codex', ['--version'], {
    encoding: 'utf8',
    stdio: 'ignore',
    timeout: 1_000,
  });
  return detected.status === 0 ? 'codex-cli' : 'unknown';
}

async function resolveScope(value: string | undefined): Promise<Scope> {
  if (value) return CodexInstallationScopeSchema.parse(value);
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Non-interactive Codex integration commands require --scope user or --scope project');
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(
      'Install TemporalThread for Codex at user or project scope? [project]: ',
    );
    return CodexInstallationScopeSchema.parse(answer.trim() || 'project');
  } finally {
    prompt.close();
  }
}

async function confirmMutation(scope: Scope, options: { yes?: boolean; dryRun?: boolean }): Promise<void> {
  if (options.yes || options.dryRun) return;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Pass --yes for a non-interactive Codex integration change');
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`Modify Codex ${scope}-scope configuration? [y/N]: `);
    if (!/^y(?:es)?$/i.test(answer.trim())) throw new Error('Codex integration change cancelled');
  } finally {
    prompt.close();
  }
}

async function resolvePrivacyOption(options: InstallOptions): Promise<InstallOptions> {
  if (options.privacy) {
    PrivacyModeSchema.parse(options.privacy);
    return options;
  }
  if (existsSync(resolveTemporalThreadPaths().configPath) || !process.stdin.isTTY || !process.stdout.isTTY) {
    return options;
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(
      'Privacy mode (metadata-only, temporal-references-only, full-local-history) [temporal-references-only]: ',
    );
    return { ...options, privacy: PrivacyModeSchema.parse(answer.trim() || 'temporal-references-only') };
  } finally {
    prompt.close();
  }
}

function componentsFor(options: InstallOptions): Array<'mcp' | 'skill' | 'hooks'> {
  if (options.skillOnly && options.mcpOnly) throw new Error('--skill-only and --mcp-only cannot be combined');
  if (options.skillOnly) return ['skill'];
  if (options.mcpOnly) return ['mcp'];
  return options.hooks === false ? ['mcp', 'skill'] : ['mcp', 'skill', 'hooks'];
}

function launchFor(options: InstallOptions) {
  return options.developmentCli
    ? ({
        mode: 'development' as const,
        cliEntryPath: options.developmentCli,
        nodeExecutable: process.execPath,
      } as const)
    : ({ mode: 'installed' as const } as const);
}

function desiredConfiguration(options: InstallOptions): {
  config: ReturnType<typeof createDefaultConfig>;
  existed: boolean;
  paths: ReturnType<typeof resolveTemporalThreadPaths>;
} {
  const paths = resolveTemporalThreadPaths();
  const existed = existsSync(paths.configPath);
  const current = existed ? loadConfig(paths) : createDefaultConfig(paths);
  const privacyMode = options.privacy ? PrivacyModeSchema.parse(options.privacy) : current.privacyMode;
  return {
    paths,
    existed,
    config: TemporalThreadConfigSchema.parse({
      ...current,
      privacyMode,
      enabledIntegrations: [...new Set([...current.enabledIntegrations, 'codex'])],
    }),
  };
}

function initializeTemporalThread(options: InstallOptions): {
  privacyMode: PrivacyMode;
  configPath: string;
  configBackupPath: string | null;
  databasePath: string;
  databaseSchemaVersion: number;
} {
  const desired = desiredConfiguration(options);
  const current = desired.existed ? loadConfig(desired.paths) : null;
  const changed = !current || JSON.stringify(current) !== JSON.stringify(desired.config);
  if (current && options.privacy && current.privacyMode !== desired.config.privacyMode && !options.yes) {
    throw new Error('Changing an existing privacy mode requires --yes');
  }
  const write = changed
    ? writeConfig(desired.config, desired.paths)
    : { configPath: desired.paths.configPath, backupPath: null };
  const storage = new SqliteStorage(desired.config.databasePath);
  try {
    return {
      privacyMode: desired.config.privacyMode,
      configPath: write.configPath,
      configBackupPath: write.backupPath,
      databasePath: desired.config.databasePath,
      databaseSchemaVersion: storage.getMigrationVersion(),
    };
  } finally {
    storage.close();
  }
}

function printInstallResult(
  result: Awaited<ReturnType<typeof installCodexIntegration>> & {
    privacyMode: PrivacyMode;
    temporalThreadConfigPath: string;
    configBackupPath: string | null;
    databasePath: string;
    databaseSchemaVersion: number | null;
    doctor: { ok: boolean; checks: Array<{ name: string; ok: boolean }> } | null;
  },
  json: boolean | undefined,
): void {
  const dataStorageSummary =
    result.privacyMode === 'metadata-only'
      ? 'timestamps, identities, hashes, and event metadata; no prompt text'
      : result.privacyMode === 'temporal-references-only'
        ? 'event metadata and locally extracted temporal references; no complete prompt text'
        : 'complete local interaction history because full-local-history was explicitly enabled';
  const output = {
    ...result,
    dataStorageSummary,
    uninstallCommand: `temporalthread integrate codex uninstall --scope ${result.scope} --yes`,
  };
  if (json) {
    printJson(output);
    return;
  }
  printLines(
    [
      `Codex integration ${result.action} at ${result.scope} scope.`,
      ...result.changed.map((path) => `${result.dryRun ? 'Would change' : 'Changed'}: ${path}`),
      ...result.backups.map((path) => `${result.dryRun ? 'Would back up' : 'Backup'}: ${path}`),
      `Privacy mode: ${result.privacyMode}`,
      `Stored data: ${dataStorageSummary}.`,
      result.requiresTrustReview
        ? 'Review and trust the installed Codex hooks; the installer cannot approve its own hooks.'
        : 'Codex hooks were not installed.',
      result.doctor ? `Post-install doctor: ${result.doctor.ok ? 'passed' : 'needs attention'}.` : '',
      `Uninstall: temporalthread integrate codex uninstall --scope ${result.scope} --yes`,
    ].filter(Boolean),
  );
}

async function installAction(options: InstallOptions, forcedComponents?: Array<'mcp' | 'skill' | 'hooks'>) {
  options = await resolvePrivacyOption(options);
  const scope = await resolveScope(options.scope);
  await confirmMutation(scope, options);
  const configuration = desiredConfiguration(options);
  const components = forcedComponents ?? componentsFor(options);
  const launch = launchFor(options);
  const common = {
    scope,
    projectRoot: process.cwd(),
    privacyMode: configuration.config.privacyMode,
    components,
    includeHooks: options.hooks !== false,
    ...(options.yes ? { force: true } : {}),
    launch,
    supportedSurface: detectCodexSurface(),
  } as const;
  const preflight = await installCodexIntegration({
    ...common,
    dryRun: true,
    probe: async (probeOptions) => probeCodexMcpExecutable(probeOptions),
  });
  if (options.dryRun) {
    if (components.includes('mcp')) {
      preflight.warnings.push(
        'Dry-run checked executable availability; the MCP handshake will run during installation.',
      );
    }
    printInstallResult(
      {
        ...preflight,
        privacyMode: configuration.config.privacyMode,
        temporalThreadConfigPath: configuration.paths.configPath,
        configBackupPath: null,
        databasePath: configuration.config.databasePath,
        databaseSchemaVersion: null,
        doctor: null,
      },
      options.json,
    );
    return;
  }
  const initialized = initializeTemporalThread(options);
  const installed = await installCodexIntegration({
    ...common,
    probe: probeCodexMcpServer,
  });
  const installedStatus = getCodexIntegrationStatus({ scope, projectRoot: process.cwd() });
  const doctorChecks = [
    { name: 'database', ok: initialized.databaseSchemaVersion > 0 },
    {
      name: 'mcp',
      ok:
        !components.includes('mcp') ||
        (installedStatus.mcp.valid && installedStatus.mcp.managed && Boolean(installed.probe?.ok)),
    },
    {
      name: 'skill',
      ok:
        !components.includes('skill') ||
        (installedStatus.skill.installed && installedStatus.skill.matchesManagedContent),
    },
    {
      name: 'hooks',
      ok: !components.includes('hooks') || (installedStatus.hooks.valid && installedStatus.hooks.installed),
    },
  ];
  printInstallResult(
    {
      ...installed,
      privacyMode: initialized.privacyMode,
      temporalThreadConfigPath: initialized.configPath,
      configBackupPath: initialized.configBackupPath,
      databasePath: initialized.databasePath,
      databaseSchemaVersion: initialized.databaseSchemaVersion,
      doctor: { ok: doctorChecks.every((item) => item.ok), checks: doctorChecks },
    },
    options.json,
  );
}

function databaseStatus(): {
  path: string;
  accessible: boolean;
  schemaVersion: number | null;
  latestSchemaVersion: number | null;
  lastSuccessfulInteraction: { timestamp: string; role: string } | null;
} {
  const paths = resolveTemporalThreadPaths();
  if (!existsSync(paths.databasePath)) {
    return {
      path: paths.databasePath,
      accessible: false,
      schemaVersion: null,
      latestSchemaVersion: null,
      lastSuccessfulInteraction: null,
    };
  }
  let storage: SqliteStorage | undefined;
  try {
    storage = new SqliteStorage(paths.databasePath);
    const last = storage.getLastInteraction();
    return {
      path: paths.databasePath,
      accessible: true,
      schemaVersion: storage.getMigrationVersion(),
      latestSchemaVersion: storage.getLatestMigrationVersion(),
      lastSuccessfulInteraction: last
        ? { timestamp: last.interaction.occurredAtUtc, role: last.interaction.role }
        : null,
    };
  } catch {
    return {
      path: paths.databasePath,
      accessible: false,
      schemaVersion: null,
      latestSchemaVersion: null,
      lastSuccessfulInteraction: null,
    };
  } finally {
    storage?.close();
  }
}

function temporalConfigurationStatus(): {
  present: boolean;
  valid: boolean;
  config: ReturnType<typeof loadConfig> | null;
} {
  const paths = resolveTemporalThreadPaths();
  if (!existsSync(paths.configPath)) return { present: false, valid: true, config: null };
  try {
    return { present: true, valid: true, config: loadConfig(paths) };
  } catch {
    return { present: true, valid: false, config: null };
  }
}

async function probeInstalledMcp(status: ReturnType<typeof getCodexIntegrationStatus>, timeoutMs: number) {
  if (!status.mcp.present || !status.mcp.entry) return null;
  const command = typeof status.mcp.entry.command === 'string' ? status.mcp.entry.command : '';
  const args = Array.isArray(status.mcp.entry.args)
    ? status.mcp.entry.args.filter((value): value is string => typeof value === 'string')
    : [];
  return probeCodexMcpServer({ command, args, cwd: status.paths.scopeRoot, timeoutMs });
}

function interruptedWritePaths(paths: ReturnType<typeof resolveCodexIntegrationPaths>): string[] {
  const directories = new Set([
    dirname(paths.configPath),
    dirname(paths.skillPath),
    dirname(paths.manifestPath),
  ]);
  const remnants: string[] = [];
  for (const directory of directories) {
    if (!existsSync(directory)) continue;
    try {
      for (const name of readdirSync(directory)) {
        if (name.includes('.tmp-')) remnants.push(join(directory, name));
      }
    } catch {
      // File-permission checks report unreadable directories separately.
    }
  }
  return remnants;
}

async function statusAction(options: ScopeOptions) {
  const scope = await resolveScope(options.scope);
  const status = getCodexIntegrationStatus({ scope, projectRoot: process.cwd() });
  const temporalConfiguration = temporalConfigurationStatus();
  const database = databaseStatus();
  const probe = database.accessible ? await probeInstalledMcp(status, 3_000) : null;
  const result = {
    ...status,
    temporalThreadInstalled: temporalConfiguration.present && temporalConfiguration.valid,
    temporalThreadConfigurationValid: temporalConfiguration.valid,
    configuredPrivacyMode: temporalConfiguration.config?.privacyMode ?? null,
    database,
    detectedCodexSurface: detectCodexSurface(),
    mcpReachable: probe?.ok ?? null,
    mcpProbeErrorCode: probe?.errorCode ?? null,
  };
  if (options.json) printJson(result);
  else {
    printLines([
      `TemporalThread Codex integration: ${result.installed ? 'installed' : 'not installed'}`,
      `Scope: ${scope}`,
      `MCP configuration: ${result.mcp.present ? 'present' : 'missing'}`,
      `Skill: ${result.skill.installed ? 'installed' : 'missing'}`,
      `Hooks: ${result.hooks.installed ? 'installed' : 'missing'}`,
      `Privacy mode: ${result.configuredPrivacyMode ?? 'not configured'}`,
      `Database: ${result.database.path}`,
      `Integration version: ${result.integrationVersion ?? 'not installed'}`,
      `Detected Codex surface: ${result.detectedCodexSurface}`,
    ]);
  }
}

function check(
  name: string,
  status: DoctorCheck['status'],
  detail: string,
  recommendedFix: string | null = null,
): DoctorCheck {
  return { name, status, detail, recommendedFix };
}

async function doctorAction(options: ScopeOptions) {
  const scope = await resolveScope(options.scope);
  const status = getCodexIntegrationStatus({ scope, projectRoot: process.cwd() });
  const temporalPaths = resolveTemporalThreadPaths();
  const temporalConfiguration = temporalConfigurationStatus();
  const configured = temporalConfiguration.config;
  const database = databaseStatus();
  const surface = detectCodexSurface();
  const checks: DoctorCheck[] = [];
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push(
    check(
      'Node.js runtime',
      nodeMajor >= 24 ? 'PASS' : 'FAIL',
      `Node ${process.versions.node}`,
      nodeMajor >= 24 ? null : 'Install Node.js 24 or newer.',
    ),
    check('TemporalThread CLI availability', 'PASS', 'the active CLI loaded successfully'),
    check(
      'CLI build output',
      process.argv[1] && existsSync(process.argv[1]) ? 'PASS' : 'FAIL',
      process.argv[1] && existsSync(process.argv[1])
        ? 'active entry point exists'
        : 'active entry point is missing',
      process.argv[1] && existsSync(process.argv[1]) ? null : 'Reinstall or rebuild the TemporalThread CLI.',
    ),
    check(
      'Codex surface',
      surface === 'unknown' ? 'WARN' : 'PASS',
      surface,
      surface === 'unknown' ? 'Install Codex CLI or use the desktop/IDE direct integration.' : null,
    ),
    check(
      'Integration manifest',
      !status.manifest.present ? 'WARN' : status.manifest.valid ? 'PASS' : 'FAIL',
      status.manifest.present ? (status.manifest.valid ? 'valid' : 'invalid') : 'not installed',
      status.manifest.present
        ? status.manifest.valid
          ? null
          : 'Reinstall after reviewing the invalid manifest.'
        : `Run temporalthread integrate codex install --scope ${scope}.`,
    ),
    check(
      'Codex configuration syntax',
      status.mcp.valid ? 'PASS' : 'FAIL',
      status.mcp.valid ? 'valid TOML or no file' : `invalid (${status.mcp.errorCode ?? 'unknown'})`,
      status.mcp.valid ? null : 'Repair config.toml manually, then rerun install.',
    ),
    check(
      'MCP entry correctness',
      !status.mcp.present ? 'WARN' : status.mcp.managed && status.mcp.matchesRecommended ? 'PASS' : 'WARN',
      status.mcp.present
        ? status.mcp.managed
          ? 'TemporalThread entry found'
          : 'external entry found'
        : 'missing',
      status.mcp.present && status.mcp.managed && status.mcp.matchesRecommended
        ? null
        : `Run temporalthread integrate codex install --scope ${scope} --mcp-only --yes.`,
    ),
    check(
      'Skill installation',
      status.skill.installed && status.skill.matchesManagedContent ? 'PASS' : 'WARN',
      status.skill.installed ? 'skill present' : 'skill missing',
      status.skill.installed && status.skill.matchesManagedContent
        ? null
        : `Run temporalthread integrate codex install-skill --scope ${scope} --yes.`,
    ),
    check(
      'Lifecycle hooks',
      status.hooks.installed && status.hooks.valid ? 'PASS' : status.hooks.valid ? 'WARN' : 'FAIL',
      status.hooks.installed ? 'supported hooks present' : 'supported hooks missing',
      status.hooks.installed
        ? null
        : `Reinstall without --no-hooks and review Codex hook trust for ${scope} scope.`,
    ),
    check(
      'Duplicate hook configuration',
      status.hooks.duplicateGroups === 0 ? 'PASS' : 'FAIL',
      `${status.hooks.duplicateGroups} duplicate TemporalThread hook group(s)`,
      status.hooks.duplicateGroups === 0 ? null : 'Reinstall to normalize duplicate managed hook groups.',
    ),
  );

  try {
    assertCodexPathsWritable(status.paths);
    accessSync(status.paths.scopeRoot, constants.R_OK | constants.W_OK);
    checks.push(check('File permissions', 'PASS', 'scope paths are readable and writable'));
  } catch {
    checks.push(
      check(
        'File permissions',
        'FAIL',
        'a Codex integration path is not readable and writable',
        'Fix ownership/permissions without replacing unrelated configuration.',
      ),
    );
  }

  checks.push(
    check(
      'TemporalThread configuration',
      !temporalConfiguration.present ? 'WARN' : temporalConfiguration.valid ? 'PASS' : 'FAIL',
      !temporalConfiguration.present
        ? 'not initialized'
        : temporalConfiguration.valid
          ? temporalPaths.configPath
          : 'configuration is malformed or invalid',
      temporalConfiguration.present && temporalConfiguration.valid
        ? null
        : 'Repair the TemporalThread config or run initialization with a backup.',
    ),
    check(
      'Configured timezone',
      configured ? 'PASS' : 'WARN',
      configured?.timezone ?? 'not configured',
      configured ? null : 'Configure an IANA timezone during initialization.',
    ),
    check(
      'Privacy mode',
      configured ? 'PASS' : 'WARN',
      configured?.privacyMode ?? 'not configured',
      configured ? null : 'Choose a privacy mode; temporal-references-only is the default.',
    ),
    check(
      'Database accessibility',
      database.accessible ? 'PASS' : existsSync(database.path) ? 'FAIL' : 'WARN',
      database.accessible ? 'database opened without reading stored text' : 'database unavailable or absent',
      database.accessible ? null : 'Initialize TemporalThread and verify the configured database path.',
    ),
    check(
      'Database migration',
      database.schemaVersion === null
        ? 'WARN'
        : database.schemaVersion === database.latestSchemaVersion
          ? 'PASS'
          : 'FAIL',
      database.schemaVersion === null
        ? 'no database schema available'
        : `migration ${database.schemaVersion}; latest ${database.latestSchemaVersion}`,
      database.schemaVersion === null || database.schemaVersion !== database.latestSchemaVersion
        ? 'Run a current TemporalThread command to apply safe migrations.'
        : null,
    ),
  );

  const probe = await probeInstalledMcp(status, 5_000);
  if (probe) {
    checks.push(
      check(
        'MCP protocol handshake',
        probe.ok ? 'PASS' : 'FAIL',
        probe.ok ? `completed in ${probe.durationMs}ms` : `failed (${probe.errorCode ?? 'unknown'})`,
        probe.ok ? null : 'Verify the configured TemporalThread executable and rerun doctor.',
      ),
      check(
        'MCP tool listing',
        probe.ok && TEMPORALTHREAD_MCP_TOOL_NAMES.every((name) => probe.toolNames.includes(name))
          ? 'PASS'
          : 'FAIL',
        probe.ok ? `${probe.toolNames.length} tools available` : 'tool listing unavailable',
        probe.ok ? null : 'Repair MCP startup before enabling the integration.',
      ),
    );
  } else {
    checks.push(
      check(
        'MCP protocol handshake',
        'WARN',
        'not tested because the MCP entry is missing',
        `Install the MCP component for ${scope} scope.`,
      ),
      check(
        'MCP tool listing',
        'WARN',
        'not tested because the MCP entry is missing',
        `Install the MCP component for ${scope} scope.`,
      ),
    );
  }

  const versionComparison = status.integrationVersion
    ? compareSemanticVersions(status.integrationVersion, CODEX_INTEGRATION_VERSION)
    : null;
  checks.push(
    check(
      'Stale MCP path',
      !status.mcp.present || status.mcp.matchesRecommended ? 'PASS' : 'WARN',
      !status.mcp.present
        ? 'not applicable because the entry is missing'
        : status.mcp.matchesRecommended
          ? 'installed command matches this release'
          : 'configured command differs from installed-package mode',
      !status.mcp.present || status.mcp.matchesRecommended
        ? null
        : 'Reinstall the MCP component or verify the intentional development path.',
    ),
    (() => {
      const remnants = interruptedWritePaths(status.paths);
      return check(
        'Interrupted writes',
        remnants.length === 0 ? 'PASS' : 'WARN',
        remnants.length === 0
          ? 'no temporary remnants found'
          : `${remnants.length} temporary remnant(s) found`,
        remnants.length === 0
          ? null
          : 'Review and remove stale .tmp-* files after confirming no install is running.',
      );
    })(),
    check(
      'Integration version compatibility',
      versionComparison === null
        ? 'WARN'
        : versionComparison > 0
          ? 'FAIL'
          : versionComparison < 0
            ? 'WARN'
            : 'PASS',
      status.integrationVersion ?? 'not installed',
      versionComparison === 0
        ? null
        : 'Use the matching or newer TemporalThread CLI; downgrades are refused.',
    ),
    check(
      'Unsupported components',
      'WARN',
      status.unsupportedComponents.join(', '),
      'Use best-effort supported hooks; transcripts, remote MCP, and guaranteed end capture remain unsupported.',
    ),
  );

  const result = { ok: checks.every((item) => item.status !== 'FAIL'), scope, checks };
  if (options.json) printJson(result);
  else {
    printLines([
      ...checks.flatMap((item) => [
        `[${item.status}] ${item.name}: ${item.detail}`,
        ...(item.recommendedFix ? [`  Fix: ${item.recommendedFix}`] : []),
      ]),
      result.ok
        ? 'TemporalThread Codex doctor completed without failures.'
        : 'TemporalThread Codex doctor found failures.',
    ]);
  }
  if (!result.ok) process.exitCode = 1;
}

async function uninstallAction(options: UninstallOptions, components?: Array<'mcp' | 'skill' | 'hooks'>) {
  const scope = await resolveScope(options.scope);
  await confirmMutation(scope, options);
  if (options.purgeData && !options.yes) throw new Error('--purge-data requires --yes');
  const result = await uninstallCodexIntegration({
    scope,
    projectRoot: process.cwd(),
    ...(options.dryRun ? { dryRun: true } : {}),
    ...(components ? { components } : {}),
  });
  let dataPurged = false;
  if (options.purgeData && !options.dryRun) {
    const temporalPaths = resolveTemporalThreadPaths();
    if (existsSync(temporalPaths.databasePath)) {
      const config = loadConfig(temporalPaths);
      const storage = new SqliteStorage(config.databasePath);
      try {
        new TemporalThreadService({ storage, config, clock: new SystemClock() }).purgeData();
        dataPurged = true;
      } finally {
        storage.close();
      }
    }
  }
  const output = { ...result, dataPurged };
  if (options.json) printJson(output);
  else {
    printLines([
      ...result.changed.map((path) => `${result.dryRun ? 'Would remove from' : 'Changed'}: ${path}`),
      ...result.preserved.map((path) => `Preserved: ${path}`),
      ...result.warnings.map((warning) => `Warning: ${warning}`),
      dataPurged
        ? 'TemporalThread data was explicitly purged.'
        : 'TemporalThread database and conversation data were preserved.',
    ]);
  }
}

function addScopeOption(command: Command): Command {
  return command.option('--scope <scope>', 'user or project scope');
}

function addInstallOptions(command: Command): Command {
  return addScopeOption(command)
    .option('--privacy <mode>', 'metadata-only, temporal-references-only, or full-local-history')
    .option('--dry-run', 'validate and print the plan without writing files or opening the database')
    .option('-y, --yes', 'approve non-interactive changes and replacement of managed files')
    .option('--no-hooks', 'do not install lifecycle hooks')
    .option('--skill-only', 'install only the temporal-awareness skill')
    .option('--mcp-only', 'install only the MCP configuration')
    .option('--development-cli <path>', 'use an absolute built CLI path for development-mode MCP')
    .option('--json', 'print machine-readable output');
}

export function registerCodexIntegrationCommands(program: Command): void {
  const codex = program
    .command('integrate')
    .description('Install and manage host integrations')
    .command('codex');

  addInstallOptions(
    codex.command('install').description('Install or safely upgrade the Codex integration'),
  ).action((options: InstallOptions) => runCodexCommand(options, () => installAction(options)));

  addScopeOption(codex.command('uninstall').description('Remove only TemporalThread-managed Codex files'))
    .option('--dry-run', 'print removals without changing files')
    .option('--purge-data', 'explicitly purge TemporalThread data after integration removal')
    .option('-y, --yes', 'approve non-interactive changes')
    .option('--json', 'print machine-readable output')
    .action((options: UninstallOptions) => runCodexCommand(options, () => uninstallAction(options)));

  addScopeOption(codex.command('status').description('Inspect Codex integration and storage status'))
    .option('--json', 'print machine-readable output')
    .action((options: ScopeOptions) => runCodexCommand(options, () => statusAction(options)));

  addScopeOption(codex.command('doctor').description('Diagnose the complete Codex integration'))
    .option('--json', 'print machine-readable output')
    .action((options: ScopeOptions) => runCodexCommand(options, () => doctorAction(options)));

  addScopeOption(codex.command('print-config').description('Print the manual Codex MCP configuration'))
    .option('--development-cli <path>', 'use an absolute built CLI path for development mode')
    .option('--json', 'print machine-readable output')
    .action((options: ScopeOptions & { developmentCli?: string }) =>
      runCodexCommand(options, async () => {
        const scope = await resolveScope(options.scope);
        const paths = resolveCodexIntegrationPaths({ scope, projectRoot: process.cwd() });
        const content = renderCodexMcpConfiguration(launchFor(options));
        const result = { scope, configPath: paths.configPath, content };
        if (options.json) printJson(result);
        else printLines([`Codex config path: ${paths.configPath}`, content.trimEnd()]);
      }),
    );

  addInstallOptions(codex.command('install-skill').description('Install only temporal-awareness')).action(
    (options: InstallOptions) => runCodexCommand(options, () => installAction(options, ['skill'])),
  );

  addScopeOption(
    codex.command('remove-skill').description('Remove only the managed temporal-awareness skill'),
  )
    .option('--dry-run', 'print removals without changing files')
    .option('-y, --yes', 'approve non-interactive changes')
    .option('--json', 'print machine-readable output')
    .action((options: UninstallOptions) =>
      runCodexCommand(options, () => uninstallAction(options, ['skill'])),
    );
}
