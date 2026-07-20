import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { exerciseMcpRelease } from './mcp-release-smoke.mjs';
import { repositoryRoot, runChecked, runPnpm, sanitizeDiagnostic } from './release-artifact-utils.mjs';

function runCli(operation, cliEntry, arguments_, options) {
  return runChecked(operation, process.execPath, [cliEntry, ...arguments_], {
    cwd: options.cwd,
    env: options.env,
    input: options.input,
    temporaryRoot: options.temporaryRoot,
  });
}

function shouldCopy(source) {
  const path = relative(repositoryRoot, source).replaceAll('\\', '/');
  if (!path) return true;
  const segments = path.split('/');
  if (
    segments.some((segment) =>
      ['.git', 'node_modules', 'dist', 'coverage', 'release-artifacts'].includes(segment),
    )
  ) {
    return false;
  }
  return !path.endsWith('.tsbuildinfo');
}

const temporaryRoot = mkdtempSync(join(tmpdir(), 'temporalthread-clean-source-'));
try {
  const sourceRoot = join(temporaryRoot, 'Source Ω with spaces');
  const homeRoot = join(temporaryRoot, 'Home Ω with spaces');
  const temporalHome = join(temporaryRoot, 'Temporal data Ω');
  const projectRoot = join(temporaryRoot, 'Project Ω with spaces');
  const tempRoot = join(temporaryRoot, 'Process temp Ω');
  const storeRoot = join(temporaryRoot, 'pnpm store Ω');
  cpSync(repositoryRoot, sourceRoot, { recursive: true, filter: shouldCopy });
  for (const path of [homeRoot, temporalHome, projectRoot, tempRoot, storeRoot]) {
    mkdirSync(path, { recursive: true });
  }

  const environment = {
    ...process.env,
    HOME: homeRoot,
    USERPROFILE: homeRoot,
    TEMPORALTHREAD_HOME: temporalHome,
    TEMPORALTHREAD_TIMEZONE: 'UTC',
    TEMPORALTHREAD_LOG_LEVEL: 'silent',
    TMPDIR: tempRoot,
    TEMP: tempRoot,
    TMP: tempRoot,
    XDG_CACHE_HOME: join(homeRoot, '.cache'),
    XDG_CONFIG_HOME: join(homeRoot, '.config'),
    XDG_DATA_HOME: join(homeRoot, '.local', 'share'),
    npm_config_cache: join(homeRoot, '.npm'),
    PNPM_HOME: join(homeRoot, '.pnpm'),
    NO_COLOR: '1',
  };

  runPnpm('install clean source dependencies', ['install', '--frozen-lockfile', '--store-dir', storeRoot], {
    cwd: sourceRoot,
    env: environment,
    temporaryRoot,
  });
  runPnpm('build clean source workspace', ['build'], {
    cwd: sourceRoot,
    env: environment,
    temporaryRoot,
  });

  const cliEntry = join(sourceRoot, 'apps', 'cli', 'dist', 'bin.js');
  if (
    runCli('check clean-source CLI version', cliEntry, ['--version'], {
      cwd: projectRoot,
      env: environment,
      temporaryRoot,
    }).trim() !== '0.1.0'
  ) {
    throw new Error('Clean-source CLI version check failed');
  }
  const help = runCli('check clean-source CLI help', cliEntry, ['--help'], {
    cwd: projectRoot,
    env: environment,
    temporaryRoot,
  });
  if (!help.includes('Give AI agents a persistent sense of time.'))
    throw new Error('Clean-source CLI help is incomplete');

  const initialized = JSON.parse(
    runCli(
      'initialize clean-source installation',
      cliEntry,
      ['init', '--yes', '--timezone', 'UTC', '--integration', 'generic', '--json'],
      { cwd: projectRoot, env: environment, temporaryRoot },
    ),
  );
  if (
    initialized.privacyMode !== 'temporal-references-only' ||
    initialized.hostConfigurationsModified !== false ||
    !existsSync(initialized.databasePath)
  ) {
    throw new Error('Clean-source initialization violated the expected privacy or storage contract');
  }
  const doctor = JSON.parse(
    runCli('run clean-source doctor', cliEntry, ['doctor', '--json'], {
      cwd: projectRoot,
      env: environment,
      temporaryRoot,
    }),
  );
  if (!doctor.ok) throw new Error('Clean-source doctor failed');
  const status = JSON.parse(
    runCli('read clean-source status', cliEntry, ['status', '--json'], {
      cwd: projectRoot,
      env: environment,
      temporaryRoot,
    }),
  );
  if (status.integrity !== 'ok' || status.privacyMode !== 'temporal-references-only') {
    throw new Error('Clean-source status failed its integrity or privacy check');
  }

  const mcp = await exerciseMcpRelease({
    nodeModulesRoot: join(sourceRoot, 'node_modules'),
    cliEntry,
    cwd: projectRoot,
    env: environment,
  });
  if (readFileSync(initialized.databasePath).includes('RELEASE_SMOKE_PRIVATE_SENTENCE')) {
    throw new Error('Default privacy mode retained the complete release-smoke prompt');
  }

  const exportPath = join(temporaryRoot, 'export Ω.json');
  runCli('export clean-source data', cliEntry, ['export', '--output', exportPath], {
    cwd: projectRoot,
    env: environment,
    temporaryRoot,
  });
  const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
  if (!exported.interactions?.length || !exported.commitments?.length) {
    throw new Error('Clean-source export is missing recorded temporal data');
  }

  mkdirSync(join(projectRoot, '.codex'), { recursive: true });
  writeFileSync(join(projectRoot, '.codex', 'config.toml'), 'model = "gpt-5"\n', 'utf8');
  const installed = JSON.parse(
    runCli(
      'install clean-source Codex integration',
      cliEntry,
      [
        'integrate',
        'codex',
        'install',
        '--scope',
        'project',
        '--development-cli',
        cliEntry,
        '--yes',
        '--json',
      ],
      { cwd: projectRoot, env: environment, temporaryRoot },
    ),
  );
  if (!installed.doctor?.ok || installed.components.join(',') !== 'mcp,skill,hooks') {
    throw new Error('Clean-source Codex integration did not pass installation checks');
  }
  const uninstalled = JSON.parse(
    runCli(
      'uninstall clean-source Codex integration',
      cliEntry,
      ['integrate', 'codex', 'uninstall', '--scope', 'project', '--yes', '--json'],
      { cwd: projectRoot, env: environment, temporaryRoot },
    ),
  );
  if (!uninstalled.databasePreserved || !existsSync(initialized.databasePath)) {
    throw new Error('Clean-source uninstall did not preserve the database');
  }
  if (readFileSync(join(projectRoot, '.codex', 'config.toml'), 'utf8') !== 'model = "gpt-5"\n') {
    throw new Error('Clean-source uninstall changed unrelated Codex configuration');
  }

  const purged = JSON.parse(
    runCli('explicitly purge clean-source data', cliEntry, ['purge', '--yes', '--json'], {
      cwd: projectRoot,
      env: environment,
      temporaryRoot,
    }),
  );
  if (purged.deleted.interactions < 1 || purged.deleted.commitments < 1) {
    throw new Error('Clean-source explicit purge did not delete the recorded domain data');
  }
  const finalStatus = JSON.parse(
    runCli('read clean-source status after purge', cliEntry, ['status', '--json'], {
      cwd: projectRoot,
      env: environment,
      temporaryRoot,
    }),
  );
  if (finalStatus.counts.interactions !== 0 || finalStatus.counts.commitments !== 0) {
    throw new Error('Clean-source data remained after explicit purge');
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      frozenInstall: true,
      build: true,
      cliVersion: '0.1.0',
      cliHelp: true,
      database: true,
      doctor: true,
      status: true,
      mcpStartup: true,
      tools: mcp.tools.length,
      interaction: mcp.interaction,
      context: mcp.context,
      commitment: mcp.commitment,
      export: true,
      uninstall: true,
      databasePreserved: true,
      explicitPurge: true,
      isolatedRoot: sanitizeDiagnostic(temporaryRoot, temporaryRoot),
    })}\n`,
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
