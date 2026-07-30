import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { seedCertificationScenario } from './live-codex-certification-mcp.mjs';
import {
  assertManagedPath,
  assertPrivacyMarkerAbsent,
  assertSafeCertificationParent,
  buildIsolatedEnvironment,
  certificationPaths,
  cleanupCertificationRoot,
  computeControlledScenario,
  createCertificationConsumerManifest,
  createCertificationManifest,
  createCertificationRoot,
  ensureCertificationDirectories,
  initializeCertificationRoot,
  parseJsonCommandOutput,
  renderPosixLauncher,
  renderPosixTemporalThreadRunner,
  renderWindowsLauncher,
  renderWindowsTemporalThreadRunner,
  runCertificationCommand,
  sanitizeCertificationDiagnostic,
  sha256Text,
  validateCertificationManifest,
} from './live-codex-certification-utils.mjs';
import { auditTarball, repositoryRoot } from './release-artifact-utils.mjs';
import { releasePackages } from './release-packages.mjs';

function requireNode24() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== 24)
    throw new Error(`Live Codex certification preparation requires Node.js 24; found ${major}`);
}

function parseArguments(arguments_) {
  const normalized = arguments_.filter((argument) => argument !== '--');
  let parent = tmpdir();
  let json = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const argument = normalized[index];
    if (argument === '--json') {
      json = true;
      continue;
    }
    if (argument === '--parent') {
      const value = normalized[index + 1];
      if (!value) throw new Error('--parent requires a path');
      parent = value;
      index += 1;
      continue;
    }
    throw new Error('Usage: prepare-live-codex-certification.mjs [--parent <system-temp-child>] [--json]');
  }
  return { parent, json };
}

function commandOptions(paths, environment, privacyMarker) {
  return {
    cwd: repositoryRoot,
    env: environment,
    replacements: {
      repositoryRoot,
      userHome: homedir(),
      temporaryRoot: paths.root,
      privacyMarker,
    },
  };
}

function runPnpm(operation, arguments_, options) {
  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) {
    throw new Error('Preparation must run through the repository pnpm package script');
  }
  return runCertificationCommand({
    operation,
    executable: process.execPath,
    arguments: [pnpmCli, ...arguments_],
    ...options,
  });
}

function runCli(operation, paths, environment, arguments_, privacyMarker, input) {
  const cliEntry = join(paths.consumerRoot, 'node_modules', 'temporalthread', 'dist', 'bin.js');
  return runCertificationCommand({
    operation,
    executable: process.execPath,
    arguments: [cliEntry, ...arguments_],
    cwd: paths.projectRoot,
    env: environment,
    ...(input === undefined ? {} : { input }),
    replacements: {
      repositoryRoot,
      userHome: homedir(),
      temporaryRoot: paths.root,
      privacyMarker,
    },
  });
}

function assertCleanSource(environment, paths) {
  const options = commandOptions(paths, environment);
  const status = runCertificationCommand({
    operation: 'check the source tree',
    executable: 'git',
    arguments: ['status', '--porcelain'],
    ...options,
  });
  if (status.trim()) throw new Error('Live certification preparation requires a clean source tree');
  return runCertificationCommand({
    operation: 'read the source commit',
    executable: 'git',
    arguments: ['rev-parse', 'HEAD'],
    ...options,
  }).trim();
}

function writeConsumer(paths) {
  const localPackages = Object.fromEntries(
    releasePackages.map((spec) => [spec.name, `file:../functional-packages-NOT-FOR-RELEASE/${spec.archive}`]),
  );
  const sourceManifest = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
  const mcpSdkVersion =
    sourceManifest.devDependencies?.['@modelcontextprotocol/sdk'] ??
    sourceManifest.dependencies?.['@modelcontextprotocol/sdk'];
  writeFileSync(
    join(paths.consumerRoot, 'package.json'),
    `${JSON.stringify(createCertificationConsumerManifest(localPackages, mcpSdkVersion), null, 2)}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  writeFileSync(
    join(paths.consumerRoot, 'pnpm-workspace.yaml'),
    `allowBuilds:
  better-sqlite3: true
overrides:
${Object.entries(localPackages)
  .map(([name, value]) => `  '${name}': ${value}`)
  .join('\n')}
`,
    { encoding: 'utf8', mode: 0o600 },
  );
}

function writeLaunchers(paths) {
  const launchers = [
    ['launch-codex-certification.sh', renderPosixLauncher(), true],
    ['launch-codex-certification.cmd', renderWindowsLauncher(), false],
    ['run-temporalthread-certification.sh', renderPosixTemporalThreadRunner(), true],
    ['run-temporalthread-certification.cmd', renderWindowsTemporalThreadRunner(), false],
  ];
  for (const [name, content, executable] of launchers) {
    const path = assertManagedPath(paths.root, join(paths.root, name));
    writeFileSync(path, content, { encoding: 'utf8', mode: executable ? 0o700 : 0o600 });
    if (executable && process.platform !== 'win32') chmodSync(path, 0o700);
  }
}

function instructionContent(manifest) {
  return `# TemporalThread live Codex certification

Status: **MANUAL REQUIRED**

These files are temporary functional-test material. They are **not release candidates**, must not be
published, and do not provide dependency-security evidence.

## Controlled state

- TemporalThread commit: \`${manifest.expectedCommit}\`
- Timezone: \`${manifest.timezone}\`
- T_NOW at preparation: \`${manifest.scenario.now}\`
- T_PREVIOUS: \`${manifest.scenario.previous}\` (T_NOW minus 4 days and 3 hours)
- T_DUE: \`${manifest.scenario.due}\` (T_PREVIOUS plus 24 hours)
- Agent identity: \`Codex / codex\`
- Project identity: \`TemporalThread Live Codex Certification\`
- Privacy: \`temporal-references-only\`
- Expected initial state: one user interaction, one overdue commitment, and no SessionStart row

The unique privacy marker is stored separately at the temporary root only so the automated checker can prove
it is absent from prohibited database/export fields. Do not paste it into Codex or copy it into the repository.

## Manual host procedure

1. Review this project, \`.codex/config.toml\`, \`.codex/hooks.json\`,
   \`.codex/temporalthread.integration.json\`, and
   \`.agents/skills/temporal-awareness/SKILL.md\`.
2. On macOS/Linux, return to the temporary root and run \`./launch-codex-certification.sh\`.
   On Windows, run \`launch-codex-certification.cmd\`.
3. Review every Codex project and hook trust prompt. Approve only the expected temporary project files; do
   not bypass or disable Codex security.
4. Confirm the TemporalThread MCP server is visible, exactly nine TemporalThread tools are available, and
   the \`temporal-awareness\` skill is discoverable.
5. Start a new session and submit:

   > I’m back. Use TemporalThread and tell me how long it has been since the previous meaningful conversation.

6. Confirm the answer uses the seeded user interaction rather than the immediate SessionStart event, reports
   approximately four days and three hours, and reports the commitment as overdue.
7. End with a normal assistant response, start another session, and confirm that real assistant response can
   become the previous meaningful conversation.
8. End a session without assistant text and confirm no fake conversational interaction appears.
9. Record only privacy-safe results in \`docs/LIVE-CODEX-CERTIFICATION-RESULTS.md\`; use safe labels instead of
   private absolute paths. Keep any optional screenshots/logs private and outside the repository.

## Automated and cleanup steps

Run repository commands from the clean TemporalThread checkout, substituting this manifest path:

\`\`\`sh
pnpm run certify:codex:check -- --manifest "${manifest.manifestPath}" --stage installed --exercise-lifecycle
\`\`\`

Uninstall the temporary project integration while preserving its database:

- macOS/Linux:
  \`./run-temporalthread-certification.sh integrate codex uninstall --scope project --yes --json\`
- Windows:
  \`run-temporalthread-certification.cmd integrate codex uninstall --scope project --yes --json\`

Then run the checker with \`--stage uninstalled\`. Explicitly purge only this isolated data:

- macOS/Linux: \`./run-temporalthread-certification.sh purge --yes --json\`
- Windows: \`run-temporalthread-certification.cmd purge --yes --json\`

Run the checker with \`--stage purged\`, then use the cleanup command printed by preparation. Cleanup is
destructive only to the proven temporary certification root.
`;
}

function generatedConfigHasRealHome(paths) {
  for (const path of [
    join(paths.projectRoot, '.codex', 'config.toml'),
    join(paths.projectRoot, '.codex', 'hooks.json'),
    join(paths.projectRoot, '.agents', 'skills', 'temporal-awareness', 'SKILL.md'),
  ]) {
    const content = readFileSync(path, 'utf8');
    if (content.includes(homedir()) || content.includes(repositoryRoot)) return true;
  }
  return false;
}

export async function prepareLiveCodexCertification(arguments_ = process.argv.slice(2)) {
  requireNode24();
  const options = parseArguments(arguments_);
  const parent = assertSafeCertificationParent({
    parent: options.parent,
    userHome: homedir(),
    repositoryRoot,
    systemTemp: tmpdir(),
  });
  const certificationId = randomUUID();
  const privacyMarker = `TT_CERT_PRIVATE_${randomUUID().replaceAll('-', '')}`;
  const root = createCertificationRoot(parent);
  const paths = certificationPaths(root);
  let markerInitialized = false;

  try {
    initializeCertificationRoot(root, certificationId);
    markerInitialized = true;
    ensureCertificationDirectories(paths);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const environment = {
      ...buildIsolatedEnvironment(paths),
      TEMPORALTHREAD_TIMEZONE: timezone,
      TEMPORALTHREAD_PRIVACY_MODE: 'temporal-references-only',
      TEMPORALTHREAD_LOG_LEVEL: 'silent',
    };
    writeFileSync(paths.npmUserConfig, 'registry=https://registry.npmjs.org/\n', {
      encoding: 'utf8',
      mode: 0o600,
    });
    const expectedCommit = assertCleanSource(environment, paths);

    runPnpm(
      'build the TemporalThread workspace',
      ['build'],
      commandOptions(paths, environment, privacyMarker),
    );
    writeFileSync(
      join(paths.packageDirectory, 'FUNCTIONAL-ONLY-NOT-FOR-RELEASE.txt'),
      `TemporalThread Phase 4.2 functional-test packages

NOT FOR RELEASE OR PUBLICATION.
Dependency security is not evaluated by this certification kit.
These archives exist only inside this disposable certification root.
`,
      { encoding: 'utf8', mode: 0o600 },
    );
    for (const spec of releasePackages) {
      runPnpm(
        `pack ${spec.name} for functional certification`,
        [
          '--dir',
          resolve(repositoryRoot, spec.directory),
          'pack',
          '--pack-destination',
          paths.packageDirectory,
        ],
        commandOptions(paths, environment, privacyMarker),
      );
      auditTarball(join(paths.packageDirectory, spec.archive), spec);
    }

    writeConsumer(paths);
    runPnpm('install the isolated functional package consumer', ['install', '--store-dir', paths.pnpmStore], {
      ...commandOptions(paths, environment, privacyMarker),
      cwd: paths.consumerRoot,
      timeoutMs: 300_000,
    });

    mkdirSync(join(paths.projectRoot, '.codex'), { recursive: true, mode: 0o700 });
    const unrelatedConfigSentinel = '# temporalthread-certification: preserve-unrelated-config';
    writeFileSync(join(paths.projectRoot, '.codex', 'config.toml'), `${unrelatedConfigSentinel}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });

    const cliVersion = runCli(
      'check the temporary CLI version',
      paths,
      environment,
      ['--version'],
      privacyMarker,
    ).trim();
    if (cliVersion !== '0.1.0') throw new Error('The temporary CLI version is not 0.1.0');
    const installed = parseJsonCommandOutput(
      'install the temporary project-scoped Codex integration',
      runCli(
        'install the temporary project-scoped Codex integration',
        paths,
        environment,
        ['integrate', 'codex', 'install', '--scope', 'project', '--yes', '--json'],
        privacyMarker,
      ),
    );
    if (!installed.doctor?.ok || installed.components?.join(',') !== 'mcp,skill,hooks') {
      throw new Error('Temporary Codex integration installation did not pass its doctor checks');
    }
    const doctor = parseJsonCommandOutput(
      'run the temporary Codex integration doctor',
      runCli(
        'run the temporary Codex integration doctor',
        paths,
        environment,
        ['integrate', 'codex', 'doctor', '--scope', 'project', '--json'],
        privacyMarker,
      ),
    );
    if (!doctor.ok) throw new Error('Temporary Codex integration doctor failed');

    const scenario = computeControlledScenario();
    const cliEntry = join(paths.consumerRoot, 'node_modules', 'temporalthread', 'dist', 'bin.js');
    const seeded = await seedCertificationScenario({
      consumerRoot: paths.consumerRoot,
      cliEntry,
      projectRoot: paths.projectRoot,
      environment,
      timezone,
      scenario,
      privacyMarker,
      certificationId,
    });
    if (seeded.tools.length !== 9) throw new Error('Temporary MCP discovery did not return nine tools');

    const databasePath = join(paths.temporalThreadHome, 'temporalthread.sqlite');
    assertPrivacyMarkerAbsent(readFileSync(databasePath), privacyMarker);
    const exportPath = assertManagedPath(paths.root, join(paths.root, 'privacy-verification-export.json'));
    try {
      runCli(
        'export privacy-permitted temporary data',
        paths,
        environment,
        ['export', '--output', exportPath],
        privacyMarker,
      );
      const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
      assertPrivacyMarkerAbsent(exported, privacyMarker);
      if (
        exported.interactions?.length !== 1 ||
        exported.commitments?.length !== 1 ||
        exported.interactions.some((interaction) => interaction.rawText || interaction.textPreview)
      ) {
        throw new Error('The controlled privacy representation is incomplete or unsafe');
      }
    } finally {
      if (existsSync(exportPath)) rmSync(exportPath);
    }
    if (generatedConfigHasRealHome(paths)) {
      throw new Error('Generated project configuration contains a real home or repository path');
    }

    writeFileSync(paths.privacyMarkerPath, `${privacyMarker}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    const manifest = createCertificationManifest({
      certificationId,
      expectedCommit,
      timezone,
      paths,
      privacyMarkerSha256: sha256Text(privacyMarker),
      createdAt: scenario.now,
      scenario,
    });
    validateCertificationManifest(manifest, root);
    writeFileSync(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    writeFileSync(paths.instructionsPath, instructionContent(manifest), {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    writeLaunchers(paths);

    return {
      ok: true,
      status: 'MANUAL REQUIRED',
      certificationKit: 'PREPARED',
      dependencySecurity: 'NOT_EVALUATED',
      releaseUse: 'PROHIBITED',
      expectedCommit,
      temporaryProjectPath: paths.projectRoot,
      manifestPath: paths.manifestPath,
      instructionsPath: paths.instructionsPath,
      toolsDiscovered: seeded.tools.length,
      privacy: 'PASS',
      realUserDirectoriesModified: false,
      hostLaunched: false,
      trustApproved: false,
      cleanupCommand: `pnpm run certify:codex:cleanup -- --root "${paths.root}" --id "${certificationId}"`,
    };
  } catch (error) {
    if (markerInitialized) {
      try {
        cleanupCertificationRoot({
          root,
          certificationId,
          userHome: homedir(),
          repositoryRoot,
          systemTemp: tmpdir(),
        });
      } catch {
        // Preserve the original failure; cleanup still refuses an unprovable root.
      }
    }
    throw error;
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  try {
    const result = await prepareLiveCodexCertification(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, options.json ? 2 : 2)}\n`);
  } catch (error) {
    process.stderr.write(
      `${sanitizeCertificationDiagnostic(error instanceof Error ? error.message : error, {
        repositoryRoot,
        userHome: homedir(),
      })}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
