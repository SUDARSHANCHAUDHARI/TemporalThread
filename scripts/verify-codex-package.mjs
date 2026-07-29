import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { exerciseMcpRelease } from './mcp-release-smoke.mjs';
import {
  assessPackedDependencyGraph,
  productionVersions,
  summarizeAudit,
} from './packed-dependency-security.mjs';
import { releasePackages } from './release-packages.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const maximumDiagnosticCharacters = 4_000;
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error('Package verification must run through pnpm');
const npmExecutable = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
const npmArgumentPrefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd'] : [];
const verificationArguments = process.argv.slice(2).filter((argument) => argument !== '--');
if (verificationArguments.some((argument) => argument !== '--require-secure-dependencies')) {
  throw new Error('Usage: pnpm verify:codex-package -- [--require-secure-dependencies]');
}
const requireSecureDependencies = verificationArguments.includes('--require-secure-dependencies');

const packageSpecs = releasePackages.map(({ name, directory, archive }) => [name, directory, archive]);

function installedPackageRoot(installRoot, directory) {
  const packageName = releasePackages.find((releasePackage) => releasePackage.directory === directory)?.name;
  if (!packageName) throw new Error(`Release package is missing for directory: ${directory}`);
  return join(installRoot, 'node_modules', ...packageName.split('/'));
}

function diagnosticValue(record, key) {
  if (!record || typeof record !== 'object' || !(key in record)) return '';
  const value = record[key];
  return Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');
}

function sanitizeDiagnostic(value) {
  const printable = [...String(value)]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 && character !== '\n' && character !== '\r' && character !== '\t'
        ? ' '
        : character;
    })
    .join('')
    .replaceAll(repositoryRoot, '<repository>')
    .replaceAll(verificationRoot, '<temporary>')
    .replaceAll(homedir(), '$HOME')
    .replace(
      /((?:authorization|token|secret|password|api[_-]?key)["']?\s*[=:]\s*["']?)[^\s,"']+/giu,
      '$1<redacted>',
    )
    .replace(
      /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{20,})\b/gu,
      '<redacted-token>',
    )
    .trim();
  return printable.length > maximumDiagnosticCharacters
    ? `${printable.slice(0, maximumDiagnosticCharacters)}…[truncated]`
    : printable || '<empty>';
}

function runChecked(operation, executable, arguments_, options) {
  const result = spawnSync(executable, arguments_, options);
  if (result.error || result.status !== 0) {
    throw new Error(
      [
        'Packed package verification command failed',
        `operation: ${operation}`,
        `working directory: ${sanitizeDiagnostic(options.cwd)}`,
        `exit status: ${sanitizeDiagnostic(diagnosticValue(result, 'status') || 'unavailable')}`,
        `signal: ${sanitizeDiagnostic(diagnosticValue(result, 'signal') || 'none')}`,
        `stdout:\n${sanitizeDiagnostic(diagnosticValue(result, 'stdout'))}`,
        `stderr:\n${sanitizeDiagnostic(diagnosticValue(result, 'stderr'))}`,
      ].join('\n'),
    );
  }
  return result.stdout;
}

function runCaptured(operation, executable, arguments_, options) {
  const result = spawnSync(executable, arguments_, options);
  if (result.error) {
    throw new Error(
      [
        'Packed package verification command could not start',
        `operation: ${operation}`,
        `working directory: ${sanitizeDiagnostic(options.cwd)}`,
        `error: ${sanitizeDiagnostic(result.error.message)}`,
      ].join('\n'),
    );
  }
  return result;
}

function runPnpm(operation, arguments_, cwd = repositoryRoot) {
  return runChecked(operation, process.execPath, [pnpmCli, ...arguments_], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    maxBuffer: 20 * 1_024 * 1_024,
  });
}

function runNpm(operation, arguments_, cwd, environment) {
  return runChecked(operation, npmExecutable, [...npmArgumentPrefix, ...arguments_], {
    cwd,
    encoding: 'utf8',
    env: environment,
    windowsHide: true,
    maxBuffer: 20 * 1_024 * 1_024,
  });
}

function parseJsonOutput(operation, output) {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`${operation} did not return valid JSON: ${sanitizeDiagnostic(error.message)}`);
  }
}

function runAudit(operation, executable, arguments_, cwd, environment) {
  const result = runCaptured(operation, executable, arguments_, {
    cwd,
    encoding: 'utf8',
    env: environment,
    windowsHide: true,
    maxBuffer: 20 * 1_024 * 1_024,
  });
  const exitStatus = result.status;
  if (exitStatus !== 0 && exitStatus !== 1) {
    throw new Error(
      [
        'Packed package production audit could not establish a security result',
        `operation: ${operation}`,
        `working directory: ${sanitizeDiagnostic(cwd)}`,
        `exit status: ${sanitizeDiagnostic(exitStatus ?? 'unavailable')}`,
        `stdout:\n${sanitizeDiagnostic(result.stdout)}`,
        `stderr:\n${sanitizeDiagnostic(result.stderr)}`,
      ].join('\n'),
    );
  }
  return summarizeAudit(parseJsonOutput(operation, result.stdout), exitStatus);
}

function runCli(operation, cliEntry, arguments_, options) {
  return runChecked(operation, process.execPath, [cliEntry, ...arguments_], {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    ...(options.input ? { input: options.input } : {}),
    maxBuffer: 10 * 1_024 * 1_024,
  });
}

function allFiles(root, current = root) {
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...allFiles(root, path));
    else if (entry.isFile()) files.push(path.slice(root.length + 1).replaceAll('\\', '/'));
  }
  return files.sort();
}

function assessPackedConsumer(graph, audit) {
  const dependencySecurity = assessPackedDependencyGraph(graph, audit);
  const temporalThreadPackageVersions = Object.fromEntries(
    packageSpecs.map(([name]) => [name, productionVersions(graph, name)]),
  );
  const allReleasePackagesInstalled = Object.values(temporalThreadPackageVersions).every(
    (versions) => versions.length === 1 && versions[0] === '0.1.0',
  );

  return {
    ...dependencySecurity,
    temporalThreadPackageVersions,
    allReleasePackagesInstalled,
    secure: dependencySecurity.secure && allReleasePackagesInstalled,
  };
}

const verificationRoot = mkdtempSync(join(tmpdir(), 'temporalthread-packed-'));
try {
  const tarballDirectory = join(verificationRoot, 'tarballs');
  const npmInstallRoot = join(verificationRoot, 'npm-consumer');
  const pnpmInstallRoot = join(verificationRoot, 'pnpm-consumer');
  const npmCache = join(verificationRoot, 'npm-cache');
  const pnpmStore = join(verificationRoot, 'pnpm-store');
  const temporalHome = join(verificationRoot, 'home');
  const projectRoot = join(verificationRoot, 'Project Ω with spaces');
  mkdirSync(tarballDirectory, { recursive: true });
  mkdirSync(npmInstallRoot, { recursive: true });
  mkdirSync(pnpmInstallRoot, { recursive: true });
  mkdirSync(npmCache, { recursive: true });
  mkdirSync(pnpmStore, { recursive: true });
  mkdirSync(projectRoot, { recursive: true });

  for (const [, directory] of packageSpecs) {
    runPnpm(`pack ${directory}`, [
      '--dir',
      resolve(repositoryRoot, directory),
      'pack',
      '--pack-destination',
      tarballDirectory,
    ]);
  }
  const tarballs = readdirSync(tarballDirectory).filter((name) => name.endsWith('.tgz'));
  if (tarballs.length !== packageSpecs.length) {
    throw new Error(`Expected ${packageSpecs.length} package tarballs; found ${tarballs.length}`);
  }

  const localPackages = Object.fromEntries(
    packageSpecs.map(([name, , archive]) => {
      if (!tarballs.includes(archive)) throw new Error(`Packed archive is missing: ${archive}`);
      return [name, `file:../tarballs/${archive}`];
    }),
  );

  const packedConsumerManifest = {
    name: 'temporalthread-packed-verification',
    private: true,
    version: '1.0.0',
    packageManager: 'pnpm@11.9.0',
    dependencies: localPackages,
  };
  writeFileSync(
    join(npmInstallRoot, 'package.json'),
    `${JSON.stringify(packedConsumerManifest, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(join(npmInstallRoot, '.npmrc'), 'registry=https://registry.npmjs.org/\n', 'utf8');
  const npmEnvironment = {
    ...process.env,
    NO_COLOR: '1',
    npm_config_cache: npmCache,
    npm_config_userconfig: join(npmInstallRoot, '.npmrc'),
  };
  runNpm(
    'install packed tarballs with npm',
    ['install', '--no-audit', '--no-fund', '--package-lock=true'],
    npmInstallRoot,
    npmEnvironment,
  );
  const npmProductionGraph = parseJsonOutput(
    'inspect npm packed production dependencies',
    runNpm(
      'inspect npm packed production dependencies',
      ['ls', '--omit=dev', '--all', '--json'],
      npmInstallRoot,
      npmEnvironment,
    ),
  );
  const npmAudit = runAudit(
    'audit npm packed production dependencies',
    npmExecutable,
    [...npmArgumentPrefix, 'audit', '--omit=dev', '--audit-level=low', '--json'],
    npmInstallRoot,
    npmEnvironment,
  );

  writeFileSync(
    join(pnpmInstallRoot, 'package.json'),
    `${JSON.stringify(packedConsumerManifest, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    join(pnpmInstallRoot, 'pnpm-workspace.yaml'),
    `allowBuilds:\n  better-sqlite3: true\noverrides:\n${Object.entries(localPackages)
      .map(([name, specifier]) => `  '${name}': ${specifier}`)
      .join('\n')}\n`,
    'utf8',
  );
  runPnpm('install packed tarballs with pnpm', ['install', '--store-dir', pnpmStore], pnpmInstallRoot);
  const pnpmProductionGraph = parseJsonOutput(
    'inspect pnpm packed production dependencies',
    runPnpm(
      'inspect pnpm packed production dependencies',
      ['list', '--prod', '--depth', 'Infinity', '--json'],
      pnpmInstallRoot,
    ),
  );
  const pnpmAudit = runAudit(
    'audit pnpm packed production dependencies',
    process.execPath,
    [pnpmCli, 'audit', '--prod', '--audit-level', 'low', '--json'],
    pnpmInstallRoot,
    { ...process.env, NO_COLOR: '1' },
  );
  const packedDependencyConsumers = {
    npm: assessPackedConsumer(npmProductionGraph, npmAudit),
    pnpm: assessPackedConsumer(pnpmProductionGraph, pnpmAudit),
  };
  const packedDependencySecurity = Object.values(packedDependencyConsumers).every(
    (consumer) => consumer.secure,
  );
  const securityGateFailed = requireSecureDependencies && !packedDependencySecurity;

  const integrationRoot = installedPackageRoot(pnpmInstallRoot, 'integrations/codex');
  const installedIntegration = await import(pathToFileURL(join(integrationRoot, 'dist', 'index.js')).href);
  const pluginValidation = installedIntegration.validateCodexPluginPackage({
    pluginRoot: join(integrationRoot, 'plugin'),
  });
  if (!pluginValidation.ok) throw new Error('Packed Codex plugin validation failed');

  const integrationFiles = allFiles(integrationRoot);
  if (integrationFiles.some((path) => path.includes('.tsbuildinfo') || path.startsWith('src/'))) {
    throw new Error('Packed Codex integration contains build metadata or source files');
  }
  for (const required of [
    'LICENSE',
    'README.md',
    'hooks.json',
    'plugin/.codex-plugin/plugin.json',
    'plugin/PRIVACY.md',
  ]) {
    if (!integrationFiles.includes(required)) throw new Error(`Packed integration is missing ${required}`);
  }

  const npmCliEntry = join(npmInstallRoot, 'node_modules', 'temporalthread', 'dist', 'bin.js');
  if (
    runCli('check npm-packed CLI version', npmCliEntry, ['--version'], {
      cwd: projectRoot,
      env: npmEnvironment,
    }).trim() !== '0.1.0'
  ) {
    throw new Error('npm-packed TemporalThread CLI version check failed');
  }

  const cliEntry = join(pnpmInstallRoot, 'node_modules', 'temporalthread', 'dist', 'bin.js');
  const executableDirectory = join(pnpmInstallRoot, 'node_modules', '.bin');
  const environment = {
    ...process.env,
    PATH: `${executableDirectory}${delimiter}${process.env.PATH ?? ''}`,
    TEMPORALTHREAD_HOME: temporalHome,
    TEMPORALTHREAD_TIMEZONE: 'UTC',
    TEMPORALTHREAD_LOG_LEVEL: 'silent',
    NO_COLOR: '1',
  };
  if (
    runCli('check packed CLI version', cliEntry, ['--version'], {
      cwd: projectRoot,
      env: environment,
    }).trim() !== '0.1.0'
  ) {
    throw new Error('Packed TemporalThread CLI version check failed');
  }
  const help = runCli('check packed CLI help', cliEntry, ['--help'], {
    cwd: projectRoot,
    env: environment,
  });
  if (!help.includes('Give AI agents a persistent sense of time.')) {
    throw new Error('Packed TemporalThread CLI help check failed');
  }
  const initialized = JSON.parse(
    runCli(
      'initialize packed TemporalThread installation',
      cliEntry,
      ['init', '--yes', '--timezone', 'UTC', '--integration', 'generic', '--json'],
      { cwd: projectRoot, env: environment },
    ),
  );
  if (
    initialized.privacyMode !== 'temporal-references-only' ||
    initialized.hostConfigurationsModified !== false ||
    !existsSync(initialized.databasePath)
  ) {
    throw new Error('Packed TemporalThread initialization failed its privacy or storage checks');
  }
  const doctor = JSON.parse(
    runCli('run packed TemporalThread doctor', cliEntry, ['doctor', '--json'], {
      cwd: projectRoot,
      env: environment,
    }),
  );
  if (!doctor.ok) throw new Error('Packed TemporalThread doctor failed');
  const status = JSON.parse(
    runCli('read packed TemporalThread status', cliEntry, ['status', '--json'], {
      cwd: projectRoot,
      env: environment,
    }),
  );
  if (status.integrity !== 'ok' || status.privacyMode !== 'temporal-references-only') {
    throw new Error('Packed TemporalThread status failed its integrity or privacy check');
  }
  mkdirSync(join(projectRoot, '.codex'), { recursive: true });
  writeFileSync(join(projectRoot, '.codex', 'config.toml'), 'model = "gpt-5"\n', 'utf8');

  const installed = JSON.parse(
    runCli(
      'install packed Codex integration and validate MCP startup',
      cliEntry,
      ['integrate', 'codex', 'install', '--scope', 'project', '--yes', '--json'],
      {
        cwd: projectRoot,
        env: environment,
      },
    ),
  );
  if (!installed.doctor?.ok || installed.components.join(',') !== 'mcp,skill,hooks') {
    throw new Error('Packed Codex integration install did not pass its doctor checks');
  }
  if (!existsSync(join(projectRoot, '.agents', 'skills', 'temporal-awareness', 'SKILL.md'))) {
    throw new Error('Packed install did not create the Codex skill');
  }
  const databasePath = join(temporalHome, 'temporalthread.sqlite');
  if (!existsSync(databasePath)) throw new Error('Packed install did not initialize local storage');

  const mcp = await exerciseMcpRelease({
    nodeModulesRoot: join(pnpmInstallRoot, 'node_modules'),
    dependencyResolverPath: join(
      installedPackageRoot(pnpmInstallRoot, 'apps/mcp-server'),
      'dist',
      'index.js',
    ),
    cliEntry,
    cwd: projectRoot,
    env: environment,
  });
  if (readFileSync(databasePath).includes('RELEASE_SMOKE_PRIVATE_SENTENCE')) {
    throw new Error('Packed default privacy mode retained the complete release-smoke prompt');
  }
  const exportPath = join(verificationRoot, 'packed-export.json');
  runCli('export packed TemporalThread data', cliEntry, ['export', '--output', exportPath], {
    cwd: projectRoot,
    env: environment,
  });
  const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
  if (!exported.interactions?.length || !exported.commitments?.length) {
    throw new Error('Packed TemporalThread export is missing recorded temporal data');
  }

  const uninstalled = JSON.parse(
    runCli(
      'uninstall packed Codex integration',
      cliEntry,
      ['integrate', 'codex', 'uninstall', '--scope', 'project', '--yes', '--json'],
      {
        cwd: projectRoot,
        env: environment,
      },
    ),
  );
  if (!uninstalled.databasePreserved || !existsSync(databasePath)) {
    throw new Error('Packed uninstall did not preserve the TemporalThread database');
  }
  if (readFileSync(join(projectRoot, '.codex', 'config.toml'), 'utf8') !== 'model = "gpt-5"\n') {
    throw new Error('Packed uninstall did not preserve unrelated Codex configuration');
  }

  const purged = JSON.parse(
    runCli('explicitly purge packed TemporalThread data', cliEntry, ['purge', '--yes', '--json'], {
      cwd: projectRoot,
      env: environment,
    }),
  );
  if (purged.deleted.interactions < 1 || purged.deleted.commitments < 1) {
    throw new Error('Packed explicit purge did not delete the recorded domain data');
  }
  const finalStatus = JSON.parse(
    runCli('read packed TemporalThread status after purge', cliEntry, ['status', '--json'], {
      cwd: projectRoot,
      env: environment,
    }),
  );
  if (finalStatus.counts.interactions !== 0 || finalStatus.counts.commitments !== 0) {
    throw new Error('Packed TemporalThread data remained after explicit purge');
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: !securityGateFailed,
      tarballs: tarballs.length,
      integrationFiles: integrationFiles.length,
      pluginFiles: pluginValidation.files.length,
      cliHelp: true,
      initialized: true,
      doctor: true,
      status: true,
      mcpTools: mcp.tools.length,
      temporalInteraction: mcp.interaction,
      temporalContext: mcp.context,
      commitment: mcp.commitment,
      export: true,
      packedInstall: true,
      packedUninstall: true,
      databasePreserved: true,
      explicitPurge: true,
      packedDependencyConsumers,
      packedDependencySecurity,
    })}\n`,
  );
  if (securityGateFailed) process.exitCode = 1;
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
