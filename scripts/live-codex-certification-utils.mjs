import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, join, posix, relative, resolve, win32 } from 'node:path';

export const EXPECTED_MCP_TOOLS = Object.freeze([
  'calculate_elapsed_time',
  'get_current_time',
  'get_last_interaction',
  'get_temporal_context',
  'list_commitments',
  'record_commitment',
  'record_interaction',
  'resolve_relative_time',
  'update_commitment',
]);

export const ROOT_MARKER_FILE = '.temporalthread-live-certification-root.json';
export const CERTIFICATION_ROOT_PREFIX = 'temporalthread-live-codex-';
const manifestSchemaVersion = 1;
const maximumDiagnosticCharacters = 4_000;

const manifestFields = new Set([
  'schemaVersion',
  'certificationId',
  'expectedCommit',
  'createdAt',
  'dependencySecurity',
  'releaseUse',
  'timezone',
  'root',
  'projectRoot',
  'setupHome',
  'codexHome',
  'temporalThreadHome',
  'consumerRoot',
  'packageDirectory',
  'processTemp',
  'pnpmStore',
  'npmCache',
  'npmUserConfig',
  'executableDirectory',
  'manifestPath',
  'privacyMarkerPath',
  'instructionsPath',
  'cliEntry',
  'integrationManifestPath',
  'databasePath',
  'unrelatedConfigSentinel',
  'scenario',
  'privacyMarkerSha256',
  'expectedTools',
  'state',
]);

function comparablePath(pathApi, value) {
  const normalized = pathApi.resolve(value);
  return pathApi === win32 ? normalized.toLowerCase() : normalized;
}

export function isPathInside(root, candidate, pathApi = process.platform === 'win32' ? win32 : posix) {
  const normalizedRoot = comparablePath(pathApi, root);
  const normalizedCandidate = comparablePath(pathApi, candidate);
  const pathFromRoot = pathApi.relative(normalizedRoot, normalizedCandidate);
  return Boolean(pathFromRoot) && pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${pathApi.sep}`);
}

function samePath(left, right) {
  const pathApi = process.platform === 'win32' ? win32 : posix;
  return comparablePath(pathApi, left) === comparablePath(pathApi, right);
}

function existingRealPath(path) {
  const unresolved = resolve(path);
  if (existsSync(unresolved)) return realpathSync(unresolved);
  const suffix = [];
  let existing = unresolved;
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) return unresolved;
    suffix.unshift(existing.slice(parent.length + (parent.endsWith(posix.sep) ? 0 : 1)));
    existing = parent;
  }
  return resolve(realpathSync(existing), ...suffix);
}

function assertUuid(value, label = 'certification id') {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw new Error(`${label} is invalid`);
  }
}

export function assertSafeCertificationParent({
  parent,
  userHome = homedir(),
  repositoryRoot,
  systemTemp = tmpdir(),
}) {
  const resolvedParent = existingRealPath(parent);
  const resolvedHome = existingRealPath(userHome);
  const resolvedRepository = existingRealPath(repositoryRoot);
  const resolvedTemporary = existingRealPath(systemTemp);

  if (samePath(resolvedParent, resolvedHome)) {
    throw new Error('Certification preparation refuses the real home directory');
  }
  if (samePath(resolvedParent, resolvedRepository) || isPathInside(resolvedRepository, resolvedParent)) {
    throw new Error('Certification preparation refuses the repository root');
  }
  if (!samePath(resolvedParent, resolvedTemporary) && !isPathInside(resolvedTemporary, resolvedParent)) {
    throw new Error('Certification preparation requires a parent inside the system temporary directory');
  }
  if (!existsSync(resolvedParent) || !lstatSync(resolvedParent).isDirectory()) {
    throw new Error('Certification temporary parent must be an existing directory');
  }
  if (lstatSync(parent).isSymbolicLink()) {
    throw new Error('Certification temporary parent must not be a symbolic link');
  }
  return resolvedParent;
}

export function createCertificationRoot(parent) {
  return realpathSync(mkdtempSync(join(parent, CERTIFICATION_ROOT_PREFIX)));
}

export function certificationPaths(root) {
  const resolvedRoot = resolve(root);
  const consumerRoot = join(resolvedRoot, 'functional-consumer');
  return {
    root: resolvedRoot,
    projectRoot: join(resolvedRoot, 'Project Ω with spaces'),
    setupHome: join(resolvedRoot, 'isolated-setup-home'),
    codexHome: join(resolvedRoot, 'isolated-codex-home'),
    temporalThreadHome: join(resolvedRoot, 'isolated-temporalthread-home'),
    consumerRoot,
    packageDirectory: join(resolvedRoot, 'functional-packages-NOT-FOR-RELEASE'),
    processTemp: join(resolvedRoot, 'process-temp'),
    pnpmStore: join(resolvedRoot, 'pnpm-store'),
    npmCache: join(resolvedRoot, 'npm-cache'),
    npmUserConfig: join(resolvedRoot, 'isolated-npmrc'),
    executableDirectory: join(consumerRoot, 'node_modules', '.bin'),
    manifestPath: join(resolvedRoot, 'certification-manifest.json'),
    privacyMarkerPath: join(resolvedRoot, 'PRIVATE-MARKER-DELETE-AFTER-CERTIFICATION.txt'),
    instructionsPath: join(resolvedRoot, 'Project Ω with spaces', 'CERTIFICATION-INSTRUCTIONS.md'),
  };
}

export function buildIsolatedEnvironment(paths, baseEnvironment = process.env, platform = process.platform) {
  const pathDelimiter = platform === 'win32' ? ';' : delimiter;
  const executablePath = [paths.executableDirectory, baseEnvironment.PATH]
    .filter(Boolean)
    .join(pathDelimiter);
  const environment = {
    ...baseEnvironment,
    HOME: paths.setupHome,
    USERPROFILE: paths.setupHome,
    CODEX_HOME: paths.codexHome,
    TEMPORALTHREAD_HOME: paths.temporalThreadHome,
    TMPDIR: paths.processTemp,
    TEMP: paths.processTemp,
    TMP: paths.processTemp,
    XDG_CACHE_HOME: join(paths.setupHome, '.cache'),
    XDG_CONFIG_HOME: join(paths.setupHome, '.config'),
    XDG_DATA_HOME: join(paths.setupHome, '.local', 'share'),
    APPDATA: join(paths.setupHome, 'AppData', 'Roaming'),
    LOCALAPPDATA: join(paths.setupHome, 'AppData', 'Local'),
    npm_config_cache: paths.npmCache,
    NPM_CONFIG_CACHE: paths.npmCache,
    npm_config_userconfig: paths.npmUserConfig,
    NPM_CONFIG_USERCONFIG: paths.npmUserConfig,
    PNPM_HOME: join(paths.setupHome, '.pnpm'),
    COREPACK_HOME: join(paths.setupHome, '.cache', 'corepack'),
    PATH: executablePath,
    NO_COLOR: '1',
  };
  for (const key of Object.keys(environment)) {
    if (/TOKEN|PASSWORD|PASSWD|SECRET|API[_-]?KEY|AUTH|CREDENTIAL|COOKIE|SESSION/iu.test(key)) {
      delete environment[key];
    }
  }
  return environment;
}

export function initializeCertificationRoot(root, certificationId) {
  assertUuid(certificationId);
  const markerPath = join(root, ROOT_MARKER_FILE);
  if (existsSync(markerPath)) throw new Error('Certification root is already initialized');
  writeFileSync(
    markerPath,
    `${JSON.stringify({ schemaVersion: 1, certificationId, purpose: 'temporalthread-live-codex-certification' }, null, 2)}\n`,
    { encoding: 'utf8', mode: 0o600, flag: 'wx' },
  );
}

export function assertManagedPath(root, candidate) {
  const lexicalRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  if (!isPathInside(lexicalRoot, resolvedCandidate)) {
    throw new Error('Certification path is outside the temporary root');
  }

  const resolvedRoot = realpathSync(root);
  let current = resolvedRoot;
  const pathFromRoot = relative(lexicalRoot, resolvedCandidate);
  for (const segment of pathFromRoot.split(/[\\/]/u)) {
    current = join(current, segment);
    if (!existsSync(current)) continue;
    const stats = lstatSync(current);
    if (stats.isSymbolicLink()) {
      throw new Error('Certification path contains a symbolic link');
    }
    const actual = realpathSync(current);
    if (!samePath(actual, resolvedRoot) && !isPathInside(resolvedRoot, actual)) {
      throw new Error('Certification path escapes the temporary root');
    }
  }
  return resolvedCandidate;
}

export function sanitizeCertificationDiagnostic(value, replacements = {}) {
  let result = [...String(value ?? '')]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point < 32 && !['\n', '\r', '\t'].includes(character) ? ' ' : character;
    })
    .join('');
  for (const [sensitive, replacement] of [
    [replacements.repositoryRoot, '<repository>'],
    [replacements.temporaryRoot, '<temporary>'],
    [replacements.userHome, '$HOME'],
    [replacements.privacyMarker, '<privacy-marker>'],
  ]) {
    if (sensitive) result = result.replaceAll(sensitive, replacement);
  }
  result = result
    .replace(
      /((?:authorization|token|secret|password|api[_-]?key)["']?\s*[=:]\s*["']?)[^\s,"']+/giu,
      '$1<redacted>',
    )
    .replace(
      /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|npm_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{20,})\b/gu,
      '<redacted-token>',
    )
    .trim();
  if (!result) return '<empty>';
  return result.length > maximumDiagnosticCharacters
    ? `${result.slice(0, maximumDiagnosticCharacters)}…[truncated]`
    : result;
}

export function assertExactToolDiscovery(tools) {
  const actual = [...tools].sort();
  if (
    actual.length !== EXPECTED_MCP_TOOLS.length ||
    actual.some((tool, index) => tool !== EXPECTED_MCP_TOOLS[index])
  ) {
    throw new Error(`Expected exactly nine TemporalThread MCP tools; discovered ${actual.length}`);
  }
}

export function computeControlledScenario(nowMilliseconds = Date.now()) {
  const minuteStable = Math.floor(nowMilliseconds / 60_000) * 60_000;
  const previous = minuteStable - 99 * 60 * 60 * 1_000;
  return {
    now: new Date(minuteStable).toISOString(),
    previous: new Date(previous).toISOString(),
    due: new Date(previous + 24 * 60 * 60 * 1_000).toISOString(),
  };
}

export function evaluateCertificationStage(stage, state) {
  const failures = [];
  if (!state.unrelatedConfigPreserved) failures.push('Unrelated Codex configuration was not preserved');
  if (!state.databaseExists) failures.push('The isolated database was not preserved');
  if (stage === 'installed') {
    if (!state.integrationPresent) failures.push('The project-scoped integration is missing');
    if (state.interactions < 1) failures.push('The controlled interaction is missing');
    if (state.commitments !== 1) failures.push('The controlled scenario must contain exactly one commitment');
  }
  if (stage === 'uninstalled') {
    if (state.integrationPresent) failures.push('Managed integration files remain after uninstall');
    if (state.interactions < 1 || state.commitments !== 1) {
      failures.push('Uninstall did not preserve the isolated temporal data');
    }
  }
  if (stage === 'purged') {
    if (state.integrationPresent) failures.push('Managed integration files remain after purge');
    if (state.interactions !== 0 || state.commitments !== 0) {
      failures.push('Explicit purge left isolated domain data');
    }
  }
  return failures;
}

export function renderPosixLauncher() {
  return `#!/bin/sh
set -eu
CERT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT="$CERT_ROOT/Project Ω with spaces"
export CODEX_HOME="$CERT_ROOT/isolated-codex-home"
export TEMPORALTHREAD_HOME="$CERT_ROOT/isolated-temporalthread-home"
export PATH="$CERT_ROOT/functional-consumer/node_modules/.bin:$PATH"
cd "$PROJECT_ROOT"
exec codex --cd "$PROJECT_ROOT" "$@"
`;
}

export function renderWindowsLauncher() {
  return `@echo off
setlocal
set "CERT_ROOT=%~dp0"
set "PROJECT_ROOT=%CERT_ROOT%Project Ω with spaces"
set "CODEX_HOME=%CERT_ROOT%isolated-codex-home"
set "TEMPORALTHREAD_HOME=%CERT_ROOT%isolated-temporalthread-home"
set "PATH=%CERT_ROOT%functional-consumer\\node_modules\\.bin;%PATH%"
if not exist "%CERT_ROOT%functional-consumer\\node_modules\\.bin\\temporalthread.cmd" (
  echo The temporary temporalthread.cmd shim is missing.
  exit /b 1
)
cd /d "%PROJECT_ROOT%"
codex --cd "%PROJECT_ROOT%" %*
`;
}

export function renderPosixTemporalThreadRunner() {
  return `#!/bin/sh
set -eu
CERT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT="$CERT_ROOT/Project Ω with spaces"
export HOME="$CERT_ROOT/isolated-setup-home"
export USERPROFILE="$CERT_ROOT/isolated-setup-home"
export TEMPORALTHREAD_HOME="$CERT_ROOT/isolated-temporalthread-home"
export TMPDIR="$CERT_ROOT/process-temp"
export TEMP="$CERT_ROOT/process-temp"
export TMP="$CERT_ROOT/process-temp"
export PATH="$CERT_ROOT/functional-consumer/node_modules/.bin:$PATH"
cd "$PROJECT_ROOT"
exec temporalthread "$@"
`;
}

export function renderWindowsTemporalThreadRunner() {
  return `@echo off
setlocal
set "CERT_ROOT=%~dp0"
set "PROJECT_ROOT=%CERT_ROOT%Project Ω with spaces"
set "HOME=%CERT_ROOT%isolated-setup-home"
set "USERPROFILE=%CERT_ROOT%isolated-setup-home"
set "TEMPORALTHREAD_HOME=%CERT_ROOT%isolated-temporalthread-home"
set "TEMP=%CERT_ROOT%process-temp"
set "TMP=%CERT_ROOT%process-temp"
set "PATH=%CERT_ROOT%functional-consumer\\node_modules\\.bin;%PATH%"
cd /d "%PROJECT_ROOT%"
call temporalthread.cmd %*
`;
}

export function runCertificationCommand({
  operation,
  executable,
  arguments: arguments_ = [],
  cwd,
  env,
  input,
  replacements,
  timeoutMs = 120_000,
}) {
  const result = spawnSync(executable, arguments_, {
    cwd,
    env,
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 20 * 1_024 * 1_024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `${operation} failed`,
        `exit status: ${result.status ?? 'unavailable'}`,
        `signal: ${result.signal ?? 'none'}`,
        `stdout:\n${sanitizeCertificationDiagnostic(result.stdout, replacements)}`,
        `stderr:\n${sanitizeCertificationDiagnostic(result.stderr, replacements)}`,
      ].join('\n'),
    );
  }
  return result.stdout;
}

export function parseJsonCommandOutput(operation, output) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${operation} did not return valid JSON`);
  }
}

export function createCertificationManifest({
  certificationId,
  expectedCommit,
  timezone,
  paths,
  privacyMarkerSha256,
  createdAt,
  scenario,
}) {
  return {
    schemaVersion: manifestSchemaVersion,
    certificationId,
    expectedCommit,
    createdAt,
    dependencySecurity: 'BLOCKED',
    releaseUse: 'PROHIBITED',
    timezone,
    root: paths.root,
    projectRoot: paths.projectRoot,
    setupHome: paths.setupHome,
    codexHome: paths.codexHome,
    temporalThreadHome: paths.temporalThreadHome,
    consumerRoot: paths.consumerRoot,
    packageDirectory: paths.packageDirectory,
    processTemp: paths.processTemp,
    pnpmStore: paths.pnpmStore,
    npmCache: paths.npmCache,
    npmUserConfig: paths.npmUserConfig,
    executableDirectory: paths.executableDirectory,
    manifestPath: paths.manifestPath,
    privacyMarkerPath: paths.privacyMarkerPath,
    instructionsPath: paths.instructionsPath,
    cliEntry: join(paths.consumerRoot, 'node_modules', 'temporalthread', 'dist', 'bin.js'),
    integrationManifestPath: join(paths.projectRoot, '.codex', 'temporalthread.integration.json'),
    databasePath: join(paths.temporalThreadHome, 'temporalthread.sqlite'),
    unrelatedConfigSentinel: '# temporalthread-certification: preserve-unrelated-config',
    scenario,
    privacyMarkerSha256,
    expectedTools: [...EXPECTED_MCP_TOOLS],
    state: 'prepared',
  };
}

function requiredString(record, field) {
  if (typeof record[field] !== 'string' || !record[field]) {
    throw new Error(`Certification manifest field ${field} is invalid`);
  }
  return record[field];
}

export function validateCertificationManifest(value, expectedRoot) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Certification manifest must be an object');
  }
  const manifest = value;
  const unknown = Object.keys(manifest).find((field) => !manifestFields.has(field));
  if (unknown) throw new Error(`Certification manifest has an unknown field: ${unknown}`);
  for (const field of manifestFields) {
    if (!(field in manifest)) throw new Error(`Certification manifest is missing ${field}`);
  }
  if (manifest.schemaVersion !== manifestSchemaVersion) {
    throw new Error('Certification manifest schema version is unsupported');
  }
  assertUuid(requiredString(manifest, 'certificationId'));
  if (!/^[a-f0-9]{40}$/u.test(requiredString(manifest, 'expectedCommit'))) {
    throw new Error('Certification manifest expected commit is invalid');
  }
  if (!/^[a-f0-9]{64}$/u.test(requiredString(manifest, 'privacyMarkerSha256'))) {
    throw new Error('Certification manifest marker digest is invalid');
  }
  if (manifest.dependencySecurity !== 'BLOCKED' || manifest.releaseUse !== 'PROHIBITED') {
    throw new Error('Certification manifest must retain the release blocker');
  }
  if (manifest.state !== 'prepared') throw new Error('Certification manifest state is invalid');
  if (!Number.isFinite(Date.parse(requiredString(manifest, 'createdAt')))) {
    throw new Error('Certification manifest creation time is invalid');
  }
  const timezone = requiredString(manifest, 'timezone');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new Error('Certification manifest timezone is invalid');
  }
  const root = resolve(requiredString(manifest, 'root'));
  if (expectedRoot && !samePath(root, resolve(expectedRoot))) {
    throw new Error('Certification manifest root does not match the requested root');
  }
  for (const field of [
    'projectRoot',
    'setupHome',
    'codexHome',
    'temporalThreadHome',
    'consumerRoot',
    'packageDirectory',
    'processTemp',
    'pnpmStore',
    'npmCache',
    'npmUserConfig',
    'executableDirectory',
    'manifestPath',
    'privacyMarkerPath',
    'instructionsPath',
    'cliEntry',
    'integrationManifestPath',
    'databasePath',
  ]) {
    if (!isPathInside(root, requiredString(manifest, field))) {
      throw new Error(`Certification manifest path ${field} is outside the temporary root`);
    }
  }
  if (
    !Array.isArray(manifest.expectedTools) ||
    manifest.expectedTools.some((tool) => typeof tool !== 'string')
  ) {
    throw new Error('Certification manifest tool list is invalid');
  }
  assertExactToolDiscovery(manifest.expectedTools);
  if (!manifest.scenario || typeof manifest.scenario !== 'object' || Array.isArray(manifest.scenario)) {
    throw new Error('Certification manifest scenario is invalid');
  }
  for (const field of ['now', 'previous', 'due']) {
    if (!Number.isFinite(Date.parse(requiredString(manifest.scenario, field)))) {
      throw new Error(`Certification manifest scenario ${field} is invalid`);
    }
  }
  return manifest;
}

export function assertPrivacyMarkerAbsent(value, marker) {
  if (!marker) throw new Error('Privacy marker is unavailable');
  const serialized = Buffer.isBuffer(value) ? value.toString('utf8') : JSON.stringify(value);
  if (serialized.includes(marker)) {
    throw new Error('Privacy marker appeared in a prohibited storage field');
  }
}

function walkAndRefuseSymlinkEscapes(root, current = root) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      let target;
      try {
        target = realpathSync(path);
      } catch {
        throw new Error('Cleanup refuses a broken symbolic link in the temporary root');
      }
      if (!samePath(root, target) && !isPathInside(root, target)) {
        throw new Error('Cleanup refuses a symbolic link that escapes the temporary root');
      }
      continue;
    }
    if (entry.isDirectory()) walkAndRefuseSymlinkEscapes(root, path);
  }
}

function safeCleanupLocation(root, userHome, repositoryRoot, systemTemp) {
  const resolvedRoot = existingRealPath(root);
  const resolvedTemporary = existingRealPath(systemTemp);
  if (!isPathInside(resolvedTemporary, resolvedRoot)) {
    throw new Error('Cleanup target is outside the system temporary directory');
  }
  if (samePath(resolvedRoot, existingRealPath(userHome))) {
    throw new Error('Cleanup refuses the real home directory');
  }
  const resolvedRepository = existingRealPath(repositoryRoot);
  if (samePath(resolvedRoot, resolvedRepository) || isPathInside(resolvedRoot, resolvedRepository)) {
    throw new Error('Cleanup refuses a path that contains the repository root');
  }
  if (!resolve(resolvedRoot).split(/[\\/]/u).at(-1)?.startsWith('temporalthread-')) {
    throw new Error('Cleanup target does not have a TemporalThread temporary prefix');
  }
  return resolvedRoot;
}

export function cleanupCertificationRoot({
  root,
  certificationId,
  userHome = homedir(),
  repositoryRoot,
  systemTemp = tmpdir(),
}) {
  assertUuid(certificationId);
  const safeRoot = safeCleanupLocation(root, userHome, repositoryRoot, systemTemp);
  if (!existsSync(safeRoot)) return { removed: false, alreadyRemoved: true };
  const markerPath = join(safeRoot, ROOT_MARKER_FILE);
  if (!existsSync(markerPath) || lstatSync(markerPath).isSymbolicLink()) {
    throw new Error('Cleanup refuses a root without a regular certification marker');
  }
  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch {
    throw new Error('Cleanup certification marker is invalid');
  }
  if (marker?.schemaVersion !== 1 || marker?.purpose !== 'temporalthread-live-codex-certification') {
    throw new Error('Cleanup certification marker is invalid');
  }
  if (marker.certificationId !== certificationId) {
    throw new Error('Cleanup certification id does not match the temporary root');
  }
  walkAndRefuseSymlinkEscapes(safeRoot);
  rmSync(safeRoot, { recursive: true, force: false });
  return { removed: true, alreadyRemoved: false };
}

export function removeTestDirectory(root) {
  if (!existsSync(root)) return;
  const safeRoot = safeCleanupLocation(root, homedir(), resolve(import.meta.dirname, '..'), tmpdir());
  rmSync(safeRoot, { recursive: true, force: true });
}

export function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function ensureCertificationDirectories(paths) {
  for (const path of [
    paths.projectRoot,
    paths.setupHome,
    paths.codexHome,
    paths.temporalThreadHome,
    paths.consumerRoot,
    paths.packageDirectory,
    paths.processTemp,
    paths.pnpmStore,
    paths.npmCache,
  ]) {
    assertManagedPath(paths.root, path);
    mkdirSync(path, { recursive: true, mode: 0o700 });
  }
}
