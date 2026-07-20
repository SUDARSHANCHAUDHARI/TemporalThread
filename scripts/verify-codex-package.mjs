import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repositoryRoot = resolve(import.meta.dirname, '..');
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error('Package verification must run through pnpm');

const packageSpecs = [
  ['@temporalthread/shared-types', 'packages/shared-types', 'temporalthread-shared-types-0.1.0.tgz'],
  ['@temporalthread/config', 'packages/config', 'temporalthread-config-0.1.0.tgz'],
  ['@temporalthread/temporal-parser', 'packages/temporal-parser', 'temporalthread-temporal-parser-0.1.0.tgz'],
  ['@temporalthread/storage-sqlite', 'packages/storage-sqlite', 'temporalthread-storage-sqlite-0.1.0.tgz'],
  ['@temporalthread/core', 'packages/core', 'temporalthread-core-0.1.0.tgz'],
  ['@temporalthread/mcp-server', 'apps/mcp-server', 'temporalthread-mcp-server-0.1.0.tgz'],
  ['@temporalthread/codex-integration', 'integrations/codex', 'temporalthread-codex-integration-0.1.0.tgz'],
  ['temporalthread', 'apps/cli', 'temporalthread-0.1.0.tgz'],
];

function runPnpm(arguments_, cwd = repositoryRoot) {
  return execFileSync(process.execPath, [pnpmCli, ...arguments_], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    maxBuffer: 20 * 1_024 * 1_024,
  });
}

function runCli(cliEntry, arguments_, options) {
  return execFileSync(process.execPath, [cliEntry, ...arguments_], {
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

const verificationRoot = mkdtempSync(join(tmpdir(), 'temporalthread-packed-'));
try {
  const tarballDirectory = join(verificationRoot, 'tarballs');
  const installRoot = join(verificationRoot, 'install');
  const temporalHome = join(verificationRoot, 'home');
  const projectRoot = join(verificationRoot, 'Project Ω with spaces');
  mkdirSync(tarballDirectory, { recursive: true });
  mkdirSync(installRoot, { recursive: true });
  mkdirSync(projectRoot, { recursive: true });

  for (const [, directory] of packageSpecs) {
    runPnpm(['--dir', resolve(repositoryRoot, directory), 'pack', '--pack-destination', tarballDirectory]);
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

  writeFileSync(
    join(installRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'temporalthread-packed-verification',
        private: true,
        version: '1.0.0',
        dependencies: localPackages,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  writeFileSync(
    join(installRoot, 'pnpm-workspace.yaml'),
    `allowBuilds:\n  better-sqlite3: true\noverrides:\n${Object.entries(localPackages)
      .map(([name, specifier]) => `  '${name}': ${specifier}`)
      .join('\n')}\n`,
    'utf8',
  );
  runPnpm(['install', '--prefer-offline'], installRoot);

  const integrationRoot = join(installRoot, 'node_modules', '@temporalthread', 'codex-integration');
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

  const cliEntry = join(installRoot, 'node_modules', 'temporalthread', 'dist', 'bin.js');
  const executableDirectory = join(installRoot, 'node_modules', '.bin');
  const environment = {
    ...process.env,
    PATH: `${executableDirectory}${delimiter}${process.env.PATH ?? ''}`,
    TEMPORALTHREAD_HOME: temporalHome,
    TEMPORALTHREAD_TIMEZONE: 'UTC',
    TEMPORALTHREAD_LOG_LEVEL: 'silent',
    NO_COLOR: '1',
  };
  if (runCli(cliEntry, ['--version'], { cwd: projectRoot, env: environment }).trim() !== '0.1.0') {
    throw new Error('Packed TemporalThread CLI version check failed');
  }
  mkdirSync(join(projectRoot, '.codex'), { recursive: true });
  writeFileSync(join(projectRoot, '.codex', 'config.toml'), 'model = "gpt-5"\n', 'utf8');

  const installed = JSON.parse(
    runCli(cliEntry, ['integrate', 'codex', 'install', '--scope', 'project', '--yes', '--json'], {
      cwd: projectRoot,
      env: environment,
    }),
  );
  if (!installed.doctor?.ok || installed.components.join(',') !== 'mcp,skill,hooks') {
    throw new Error('Packed Codex integration install did not pass its doctor checks');
  }
  if (!existsSync(join(projectRoot, '.agents', 'skills', 'temporal-awareness', 'SKILL.md'))) {
    throw new Error('Packed install did not create the Codex skill');
  }
  const databasePath = join(temporalHome, 'temporalthread.sqlite');
  if (!existsSync(databasePath)) throw new Error('Packed install did not initialize local storage');

  const uninstalled = JSON.parse(
    runCli(cliEntry, ['integrate', 'codex', 'uninstall', '--scope', 'project', '--yes', '--json'], {
      cwd: projectRoot,
      env: environment,
    }),
  );
  if (!uninstalled.databasePreserved || !existsSync(databasePath)) {
    throw new Error('Packed uninstall did not preserve the TemporalThread database');
  }
  if (readFileSync(join(projectRoot, '.codex', 'config.toml'), 'utf8') !== 'model = "gpt-5"\n') {
    throw new Error('Packed uninstall did not preserve unrelated Codex configuration');
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      tarballs: tarballs.length,
      integrationFiles: integrationFiles.length,
      pluginFiles: pluginValidation.files.length,
      packedInstall: true,
      packedUninstall: true,
      databasePreserved: true,
    })}\n`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
