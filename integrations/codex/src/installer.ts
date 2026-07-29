import { createHash, randomUUID } from 'node:crypto';
import {
  accessSync,
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrivacyMode } from '@sudarshanchaudhari/temporalthread-shared-types';
import { CodexHooksError, inspectCodexHooks, mergeCodexHooks, removeCodexHooks } from './hooks-config.js';
import {
  type CodexInstallationManifest,
  CodexInstallationManifestSchema,
  compareSemanticVersions,
} from './manifest.js';
import {
  type CodexMcpLaunchOptions,
  createCodexMcpServerConfig,
  inspectCodexMcpConfiguration,
  mergeCodexMcpConfiguration,
  removeCodexMcpConfiguration,
} from './mcp-config.js';
import { type CodexMcpProbeResult, probeCodexMcpExecutable, probeCodexMcpServer } from './mcp-probe.js';
import {
  type CodexInstallationScope,
  type CodexIntegrationPaths,
  resolveCodexIntegrationPaths,
} from './paths.js';

export const CODEX_INTEGRATION_VERSION = '0.1.0';
export const TEMPORALTHREAD_VERSION = '0.1.0';

type InstallableComponent = 'mcp' | 'skill' | 'hooks';
type Probe = (options: {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
}) => Promise<CodexMcpProbeResult>;

export type CodexInstallationErrorCode =
  | 'downgrade-refused'
  | 'ownership-uncertain'
  | 'mcp-unavailable'
  | 'invalid-manifest'
  | 'unsafe-path'
  | 'validation-failed';

export class CodexInstallationError extends Error {
  readonly code: CodexInstallationErrorCode;

  constructor(code: CodexInstallationErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CodexInstallationError';
    this.code = code;
  }
}

export interface CodexIntegrationAssets {
  skillContent: string;
  hooksContent: string;
}

export interface CodexInstallOptions {
  scope: CodexInstallationScope;
  projectRoot?: string;
  userHome?: string;
  privacyMode: PrivacyMode;
  components?: readonly InstallableComponent[];
  includeHooks?: boolean;
  dryRun?: boolean;
  force?: boolean;
  launch?: CodexMcpLaunchOptions;
  temporalThreadVersion?: string;
  integrationVersion?: string;
  installedAt?: string;
  supportedSurface?: CodexInstallationManifest['supportedSurface'];
  assets?: CodexIntegrationAssets;
  probe?: Probe;
  validateInstalledState?: (paths: CodexIntegrationPaths) => void;
}

export interface CodexUninstallOptions {
  scope: CodexInstallationScope;
  projectRoot?: string;
  userHome?: string;
  dryRun?: boolean;
  installedAt?: string;
  assets?: CodexIntegrationAssets;
  components?: readonly InstallableComponent[];
}

export interface CodexInstallResult {
  action: 'installed' | 'upgraded' | 'unchanged';
  scope: CodexInstallationScope;
  paths: CodexIntegrationPaths;
  components: InstallableComponent[];
  changed: string[];
  preserved: string[];
  backups: string[];
  warnings: string[];
  dryRun: boolean;
  requiresTrustReview: boolean;
  databasePreserved: true;
  probe: CodexMcpProbeResult | null;
}

export interface CodexUninstallResult {
  scope: CodexInstallationScope;
  paths: CodexIntegrationPaths;
  changed: string[];
  preserved: string[];
  backups: string[];
  warnings: string[];
  dryRun: boolean;
  databasePreserved: true;
}

interface FileOperation {
  path: string;
  desired: string | null;
  previous: string | null;
  backupPath: string | null;
  validate: (content: string | null) => boolean;
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function integrationRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export function readCodexIntegrationAssets(): CodexIntegrationAssets {
  const root = integrationRoot();
  const repositoryRoot = resolve(root, '../..');
  const packagedSkill = join(root, 'plugin/skills/temporal-awareness/SKILL.md');
  return {
    hooksContent: readFileSync(join(root, 'hooks.json'), 'utf8'),
    skillContent: readFileSync(
      existsSync(packagedSkill)
        ? packagedSkill
        : join(repositoryRoot, 'skills/codex/temporal-awareness/SKILL.md'),
      'utf8',
    ),
  };
}

function readOptional(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function safeTimestamp(value: string): string {
  return value.replaceAll(':', '-');
}

function installationTimestamp(value: string | undefined): string {
  const candidate = value ?? new Date().toISOString();
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(candidate) ||
    Number.isNaN(Date.parse(candidate))
  ) {
    throw new CodexInstallationError('validation-failed', 'Installation timestamp is invalid');
  }
  return new Date(candidate).toISOString();
}

function backupPath(path: string, timestamp: string, reserved: Set<string>): string {
  const base = `${path}.backup-${safeTimestamp(timestamp)}`;
  let candidate = base;
  let index = 1;
  while (existsSync(candidate) || reserved.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  reserved.add(candidate);
  return candidate;
}

function ensureSafeTarget(scopeRoot: string, target: string): void {
  const pathFromRoot = relative(scopeRoot, target);
  if (!pathFromRoot || pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
    throw new CodexInstallationError('unsafe-path', 'Codex integration target is outside its scope');
  }
  let current = target;
  while (current !== scopeRoot) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new CodexInstallationError('unsafe-path', 'Codex integration refuses symbolic-link targets');
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  try {
    writeFileSync(temporaryPath, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(temporaryPath, path);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
}

function executeOperations(
  operations: FileOperation[],
  scopeRoot: string,
  dryRun: boolean,
  validateInstalledState?: () => void,
): void {
  for (const operation of operations) ensureSafeTarget(scopeRoot, operation.path);
  if (dryRun) return;
  const applied: FileOperation[] = [];
  try {
    for (const operation of operations) {
      if (operation.backupPath && operation.previous !== null) {
        mkdirSync(dirname(operation.backupPath), { recursive: true, mode: 0o700 });
        copyFileSync(operation.path, operation.backupPath, constants.COPYFILE_EXCL);
      }
      if (operation.desired === null) {
        if (existsSync(operation.path)) unlinkSync(operation.path);
      } else {
        atomicWrite(operation.path, operation.desired);
      }
      applied.push(operation);
      const actual = readOptional(operation.path);
      if (!operation.validate(actual)) throw new Error('managed file validation failed');
    }
    validateInstalledState?.();
  } catch (error) {
    for (const operation of [...applied].reverse()) {
      try {
        if (operation.previous === null) {
          if (existsSync(operation.path)) unlinkSync(operation.path);
        } else {
          atomicWrite(operation.path, operation.previous);
        }
      } catch {
        // Preserve the original failure; backups remain available for manual recovery.
      }
    }
    throw new CodexInstallationError(
      'validation-failed',
      'Codex installation validation failed and managed files were rolled back',
      { cause: error },
    );
  }
}

function parseManifest(content: string | null): CodexInstallationManifest | null {
  if (content === null) return null;
  try {
    return CodexInstallationManifestSchema.parse(JSON.parse(content));
  } catch (error) {
    throw new CodexInstallationError('invalid-manifest', 'Codex integration manifest is invalid', {
      cause: error,
    });
  }
}

function normalizedComponents(options: CodexInstallOptions): InstallableComponent[] {
  const requested = options.components ?? (['mcp', 'skill', 'hooks'] as const);
  const unique = new Set(requested);
  const supported = ['mcp', 'skill', 'hooks'] as const;
  const components = supported.filter((component) => unique.has(component));
  if (options.includeHooks === false) return components.filter((component) => component !== 'hooks');
  if (components.length === 0) throw new Error('At least one Codex integration component is required');
  return components;
}

function operation(
  path: string,
  desired: string | null,
  timestamp: string,
  reserved: Set<string>,
  validate: FileOperation['validate'],
): FileOperation | null {
  const previous = readOptional(path);
  if (previous === desired) return null;
  return {
    path,
    desired,
    previous,
    backupPath: previous === null ? null : backupPath(path, timestamp, reserved),
    validate,
  };
}

function validateSkill(content: string | null): boolean {
  return Boolean(
    content?.startsWith('---\n') &&
      content.includes('\nname: temporal-awareness\n') &&
      content.includes('\ndescription:'),
  );
}

function mergeBackupHistory(existing: string[], additions: string[]): string[] {
  return [...new Set([...existing, ...additions])].slice(-32);
}

export async function installCodexIntegration(options: CodexInstallOptions): Promise<CodexInstallResult> {
  const paths = resolveCodexIntegrationPaths(options);
  const assets = options.assets ?? readCodexIntegrationAssets();
  const requestedComponents = normalizedComponents(options);
  const launch = options.launch ?? ({ mode: 'installed' } as const);
  const integrationVersion = options.integrationVersion ?? CODEX_INTEGRATION_VERSION;
  const temporalThreadVersion = options.temporalThreadVersion ?? TEMPORALTHREAD_VERSION;
  const timestamp = installationTimestamp(options.installedAt);
  const existingManifest = parseManifest(readOptional(paths.manifestPath));
  const components = existingManifest
    ? (['mcp', 'skill', 'hooks'] as const).filter(
        (component) =>
          requestedComponents.includes(component) || existingManifest.installedComponents.includes(component),
      )
    : requestedComponents;
  const comparison = existingManifest
    ? compareSemanticVersions(integrationVersion, existingManifest.integrationVersion)
    : null;
  if (comparison !== null && comparison < 0) {
    throw new CodexInstallationError(
      'downgrade-refused',
      'A newer TemporalThread Codex integration is already installed',
    );
  }

  let probeResult: CodexMcpProbeResult | null = null;
  if (requestedComponents.includes('mcp')) {
    const server = createCodexMcpServerConfig(launch);
    const probe = options.probe ?? (options.dryRun ? probeCodexMcpExecutable : probeCodexMcpServer);
    probeResult = await probe({
      command: server.command,
      args: server.args,
      cwd: paths.scopeRoot,
      timeoutMs: Math.min(server.startup_timeout_sec * 1_000, 10_000),
    });
    if (!probeResult.ok) {
      throw new CodexInstallationError(
        'mcp-unavailable',
        'TemporalThread MCP startup validation failed; no Codex files were changed',
      );
    }
  }

  const reservedBackups = new Set<string>();
  const operations: FileOperation[] = [];
  const preserved: string[] = [];
  const warnings: string[] = [];
  const managedHashes: Record<string, string> = { ...(existingManifest?.managedHashes ?? {}) };
  const managedFiles: string[] =
    existingManifest?.managedFiles.filter((path) => path !== paths.manifestPath) ?? [];

  if (requestedComponents.includes('mcp')) {
    const current = readOptional(paths.configPath) ?? '';
    const merged = mergeCodexMcpConfiguration(current, launch);
    if (merged.ownership === 'external') {
      throw new CodexInstallationError(
        'ownership-uncertain',
        'An unmarked TemporalThread MCP entry already exists and was preserved',
      );
    }
    const planned = operation(paths.configPath, merged.content, timestamp, reservedBackups, (content) => {
      if (content === null) return false;
      const inspection = inspectCodexMcpConfiguration(content, launch);
      return inspection.valid && inspection.managed && inspection.matchesRecommended;
    });
    if (planned) operations.push(planned);
    else preserved.push(paths.configPath);
    if (!managedFiles.includes(paths.configPath)) managedFiles.push(paths.configPath);
    managedHashes.mcp = hash(merged.content);
  }

  if (requestedComponents.includes('hooks')) {
    const merged = mergeCodexHooks(readOptional(paths.hooksPath) ?? '', assets.hooksContent);
    const planned = operation(paths.hooksPath, merged.content, timestamp, reservedBackups, (content) =>
      content ? inspectCodexHooks(content, assets.hooksContent).installed : false,
    );
    if (planned) operations.push(planned);
    else preserved.push(paths.hooksPath);
    if (!managedFiles.includes(paths.hooksPath)) managedFiles.push(paths.hooksPath);
    managedHashes.hooks = hash(merged.content);
  }

  if (requestedComponents.includes('skill')) {
    const current = readOptional(paths.skillPath);
    if (current !== null && current !== assets.skillContent && !existingManifest && !options.force) {
      throw new CodexInstallationError(
        'ownership-uncertain',
        'An existing temporal-awareness skill is not managed by TemporalThread; pass --yes to replace it',
      );
    }
    const planned = operation(
      paths.skillPath,
      assets.skillContent,
      timestamp,
      reservedBackups,
      validateSkill,
    );
    if (planned) operations.push(planned);
    else preserved.push(paths.skillPath);
    if (!managedFiles.includes(paths.skillPath)) managedFiles.push(paths.skillPath);
    managedHashes.skill = hash(assets.skillContent);
  }

  const componentBackups = operations
    .map((item) => item.backupPath)
    .filter((path): path is string => path !== null);
  const installedAt = existingManifest?.installedAt ?? timestamp;
  const baseManifest = {
    schemaVersion: 1 as const,
    temporalThreadVersion,
    integrationVersion,
    installedAt,
    scope: paths.scope,
    privacyMode: options.privacyMode,
    supportedSurface: options.supportedSurface ?? 'unknown',
    installedComponents: components,
    managedFiles: [...managedFiles, paths.manifestPath],
    backupPaths: mergeBackupHistory(existingManifest?.backupPaths ?? [], componentBackups),
    managedHashes,
  };
  let manifest = CodexInstallationManifestSchema.parse(baseManifest);
  let manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  const previousManifestContent = readOptional(paths.manifestPath);
  let plannedManifestBackup: string | null = null;
  if (previousManifestContent !== manifestContent && previousManifestContent !== null) {
    plannedManifestBackup = backupPath(paths.manifestPath, timestamp, reservedBackups);
    manifest = CodexInstallationManifestSchema.parse({
      ...manifest,
      backupPaths: mergeBackupHistory(manifest.backupPaths, [plannedManifestBackup]),
    });
    manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  }
  const manifestOperation = operation(
    paths.manifestPath,
    manifestContent,
    timestamp,
    reservedBackups,
    (content) => {
      try {
        return Boolean(content && CodexInstallationManifestSchema.parse(JSON.parse(content)));
      } catch {
        return false;
      }
    },
  );
  if (manifestOperation) {
    if (plannedManifestBackup && manifestOperation.previous !== null) {
      manifestOperation.backupPath = plannedManifestBackup;
    }
    operations.push(manifestOperation);
  } else {
    preserved.push(paths.manifestPath);
  }

  const finalBackups = operations
    .map((item) => item.backupPath)
    .filter((path): path is string => path !== null);
  executeOperations(operations, paths.scopeRoot, Boolean(options.dryRun), () => {
    options.validateInstalledState?.(paths);
  });

  return {
    action: existingManifest
      ? comparison === 1
        ? 'upgraded'
        : operations.length
          ? 'upgraded'
          : 'unchanged'
      : 'installed',
    scope: paths.scope,
    paths,
    components,
    changed: operations.map((item) => item.path),
    preserved,
    backups: finalBackups,
    warnings,
    dryRun: Boolean(options.dryRun),
    requiresTrustReview: requestedComponents.includes('hooks'),
    databasePreserved: true,
    probe: probeResult,
  };
}

export async function uninstallCodexIntegration(
  options: CodexUninstallOptions,
): Promise<CodexUninstallResult> {
  const paths = resolveCodexIntegrationPaths(options);
  const assets = options.assets ?? readCodexIntegrationAssets();
  const timestamp = installationTimestamp(options.installedAt);
  let manifest: CodexInstallationManifest | null = null;
  const warnings: string[] = [];
  try {
    manifest = parseManifest(readOptional(paths.manifestPath));
  } catch {
    warnings.push('The installation manifest is invalid and was preserved');
  }
  const components = new Set<InstallableComponent>(
    options.components ??
      (manifest?.installedComponents.filter((value) => value !== 'plugin') as
        | InstallableComponent[]
        | undefined) ?? ['mcp', 'skill', 'hooks'],
  );
  const reservedBackups = new Set<string>();
  const operations: FileOperation[] = [];
  const preserved: string[] = [];
  const clearedComponents = new Set<InstallableComponent>();

  if (components.has('mcp')) {
    const current = readOptional(paths.configPath);
    if (current === null) {
      clearedComponents.add('mcp');
    } else {
      const removed = removeCodexMcpConfiguration(current);
      if (removed.change === 'removed') {
        const planned = operation(paths.configPath, removed.content, timestamp, reservedBackups, (content) =>
          content ? !inspectCodexMcpConfiguration(content).managed : true,
        );
        if (planned) operations.push(planned);
        clearedComponents.add('mcp');
      } else if (removed.ownership === 'external') {
        preserved.push(paths.configPath);
        warnings.push('An externally owned TemporalThread MCP entry was preserved');
      }
    }
  }

  if (components.has('hooks')) {
    const current = readOptional(paths.hooksPath);
    if (current === null) {
      clearedComponents.add('hooks');
    } else {
      try {
        const removed = removeCodexHooks(current);
        if (removed.change === 'removed') {
          const planned = operation(
            paths.hooksPath,
            removed.content,
            timestamp,
            reservedBackups,
            (content) => (content ? !inspectCodexHooks(content).installed : true),
          );
          if (planned) operations.push(planned);
          clearedComponents.add('hooks');
        } else {
          clearedComponents.add('hooks');
        }
      } catch (error) {
        if (!(error instanceof CodexHooksError)) throw error;
        preserved.push(paths.hooksPath);
        warnings.push('Malformed hooks.json was preserved');
      }
    }
  }

  if (components.has('skill')) {
    const current = readOptional(paths.skillPath);
    if (current === null) {
      clearedComponents.add('skill');
    } else {
      const expectedHash = manifest?.managedHashes.skill;
      if (current === assets.skillContent || (expectedHash && hash(current) === expectedHash)) {
        const planned = operation(
          paths.skillPath,
          null,
          timestamp,
          reservedBackups,
          (content) => content === null,
        );
        if (planned) operations.push(planned);
        clearedComponents.add('skill');
      } else {
        preserved.push(paths.skillPath);
        warnings.push('The modified skill was preserved because ownership no longer matches');
      }
    }
  }

  if (manifest) {
    const remainingComponents = manifest.installedComponents.filter(
      (component) => component === 'plugin' || !clearedComponents.has(component),
    );
    if (remainingComponents.length === 0) {
      const planned = operation(
        paths.manifestPath,
        null,
        timestamp,
        reservedBackups,
        (content) => content === null,
      );
      if (planned) operations.push(planned);
    } else {
      const componentPaths: Record<InstallableComponent, string> = {
        mcp: paths.configPath,
        hooks: paths.hooksPath,
        skill: paths.skillPath,
      };
      const managedHashes = { ...manifest.managedHashes };
      for (const component of clearedComponents) delete managedHashes[component];
      const operationBackups = operations
        .map((item) => item.backupPath)
        .filter((path): path is string => path !== null);
      const manifestBackup = backupPath(paths.manifestPath, timestamp, reservedBackups);
      const updatedManifest = CodexInstallationManifestSchema.parse({
        ...manifest,
        installedComponents: remainingComponents,
        managedFiles: manifest.managedFiles.filter(
          (path) =>
            path === paths.manifestPath ||
            ![...clearedComponents].some((component) => componentPaths[component] === path),
        ),
        backupPaths: mergeBackupHistory(manifest.backupPaths, [...operationBackups, manifestBackup]),
        managedHashes,
      });
      const planned = operation(
        paths.manifestPath,
        `${JSON.stringify(updatedManifest, null, 2)}\n`,
        timestamp,
        reservedBackups,
        (content) => {
          try {
            return Boolean(content && CodexInstallationManifestSchema.parse(JSON.parse(content)));
          } catch {
            return false;
          }
        },
      );
      if (planned) {
        planned.backupPath = manifestBackup;
        operations.push(planned);
      }
    }
  } else if (existsSync(paths.manifestPath)) {
    preserved.push(paths.manifestPath);
  }

  executeOperations(operations, paths.scopeRoot, Boolean(options.dryRun));
  return {
    scope: paths.scope,
    paths,
    changed: operations.map((item) => item.path),
    preserved,
    backups: operations.map((item) => item.backupPath).filter((path): path is string => path !== null),
    warnings,
    dryRun: Boolean(options.dryRun),
    databasePreserved: true,
  };
}

export interface CodexIntegrationStatus {
  installed: boolean;
  scope: CodexInstallationScope;
  paths: CodexIntegrationPaths;
  integrationVersion: string | null;
  privacyMode: PrivacyMode | null;
  manifest: { present: boolean; valid: boolean };
  mcp: ReturnType<typeof inspectCodexMcpConfiguration>;
  skill: { installed: boolean; matchesManagedContent: boolean };
  hooks: ReturnType<typeof inspectCodexHooks>;
  unsupportedComponents: string[];
}

export function getCodexIntegrationStatus(options: {
  scope: CodexInstallationScope;
  projectRoot?: string;
  userHome?: string;
  assets?: CodexIntegrationAssets;
}): CodexIntegrationStatus {
  const paths = resolveCodexIntegrationPaths(options);
  const assets = options.assets ?? readCodexIntegrationAssets();
  const manifestContent = readOptional(paths.manifestPath);
  let manifest: CodexInstallationManifest | null = null;
  let manifestValid = true;
  try {
    manifest = parseManifest(manifestContent);
  } catch {
    manifestValid = false;
  }
  const config = readOptional(paths.configPath);
  const hooks = readOptional(paths.hooksPath);
  const skill = readOptional(paths.skillPath);
  return {
    installed: Boolean(manifest && manifestValid),
    scope: paths.scope,
    paths,
    integrationVersion: manifest?.integrationVersion ?? null,
    privacyMode: manifest?.privacyMode ?? null,
    manifest: { present: manifestContent !== null, valid: manifestContent !== null && manifestValid },
    mcp: config
      ? inspectCodexMcpConfiguration(config)
      : { valid: true, managed: false, present: false, matchesRecommended: false, entry: null },
    skill: { installed: skill !== null, matchesManagedContent: skill === assets.skillContent },
    hooks: hooks
      ? inspectCodexHooks(hooks, assets.hooksContent)
      : { valid: true, installed: false, duplicateGroups: 0 },
    unsupportedComponents: ['guaranteed-session-end', 'transcript-capture', 'remote-mcp'],
  };
}

export function assertCodexPathsWritable(paths: CodexIntegrationPaths): void {
  for (const path of [paths.configPath, paths.hooksPath, paths.skillPath, paths.manifestPath]) {
    const parent = dirname(path);
    if (existsSync(parent)) accessSync(parent, constants.R_OK | constants.W_OK);
  }
}
