import { existsSync, lstatSync, readFileSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectCertificationMcp } from './live-codex-certification-mcp.mjs';
import {
  assertManagedPath,
  assertPrivacyMarkerAbsent,
  assertSafeCertificationParent,
  buildIsolatedEnvironment,
  certificationPaths,
  evaluateCertificationStage,
  parseJsonCommandOutput,
  ROOT_MARKER_FILE,
  runCertificationCommand,
  sanitizeCertificationDiagnostic,
  sha256Text,
  validateCertificationManifest,
} from './live-codex-certification-utils.mjs';
import { repositoryRoot } from './release-artifact-utils.mjs';

function requireNode24() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== 24) throw new Error(`Live Codex certification checks require Node.js 24; found ${major}`);
}

function parseArguments(arguments_) {
  const normalized = arguments_.filter((argument) => argument !== '--');
  let manifestPath;
  let stage = 'installed';
  let exerciseLifecycle = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const argument = normalized[index];
    if (argument === '--manifest') {
      manifestPath = normalized[index + 1];
      if (!manifestPath) throw new Error('--manifest requires a path');
      index += 1;
      continue;
    }
    if (argument === '--stage') {
      stage = normalized[index + 1];
      if (!stage) throw new Error('--stage requires installed, uninstalled, or purged');
      index += 1;
      continue;
    }
    if (argument === '--exercise-lifecycle') {
      exerciseLifecycle = true;
      continue;
    }
    throw new Error(
      'Usage: check-live-codex-certification.mjs --manifest <path> [--stage installed|uninstalled|purged] [--exercise-lifecycle]',
    );
  }
  if (!manifestPath) throw new Error('--manifest is required');
  if (!['installed', 'uninstalled', 'purged'].includes(stage)) {
    throw new Error('--stage requires installed, uninstalled, or purged');
  }
  if (exerciseLifecycle && stage !== 'installed') {
    throw new Error('--exercise-lifecycle is valid only for the installed stage');
  }
  return { manifestPath, stage, exerciseLifecycle };
}

function readManifestSafely(manifestPath) {
  const resolvedManifest = resolve(manifestPath);
  if (!existsSync(resolvedManifest) || lstatSync(resolvedManifest).isSymbolicLink()) {
    throw new Error('Certification manifest must be an existing regular file');
  }
  const stats = statSync(resolvedManifest);
  if (!stats.isFile() || stats.size > 128 * 1_024) {
    throw new Error('Certification manifest is not a bounded regular file');
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(resolvedManifest, 'utf8'));
  } catch {
    throw new Error('Certification manifest is invalid JSON');
  }
  const root = resolve(parsed?.root ?? '');
  const manifest = validateCertificationManifest(parsed, root);
  if (resolve(manifest.manifestPath) !== resolvedManifest) {
    throw new Error('Certification manifest path does not match its temporary root');
  }
  assertSafeCertificationParent({
    parent: dirname(root),
    userHome: homedir(),
    repositoryRoot,
    systemTemp: tmpdir(),
  });
  if (!root.split(/[\\/]/u).at(-1)?.startsWith('temporalthread-live-codex-')) {
    throw new Error('Certification root does not have the expected temporary prefix');
  }
  assertManagedPath(root, resolvedManifest);
  const markerPath = assertManagedPath(root, join(root, ROOT_MARKER_FILE));
  if (!existsSync(markerPath) || lstatSync(markerPath).isSymbolicLink()) {
    throw new Error('Certification root marker is missing');
  }
  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch {
    throw new Error('Certification root marker is invalid');
  }
  if (
    marker?.purpose !== 'temporalthread-live-codex-certification' ||
    marker?.certificationId !== manifest.certificationId
  ) {
    throw new Error('Certification root marker does not match the manifest');
  }
  return manifest;
}

function pathsFromManifest(manifest) {
  const defaults = certificationPaths(manifest.root);
  return {
    ...defaults,
    projectRoot: manifest.projectRoot,
    setupHome: manifest.setupHome,
    codexHome: manifest.codexHome,
    temporalThreadHome: manifest.temporalThreadHome,
    consumerRoot: manifest.consumerRoot,
    packageDirectory: manifest.packageDirectory,
    processTemp: manifest.processTemp,
    pnpmStore: manifest.pnpmStore,
    npmCache: manifest.npmCache,
    npmUserConfig: manifest.npmUserConfig,
    executableDirectory: manifest.executableDirectory,
    manifestPath: manifest.manifestPath,
    privacyMarkerPath: manifest.privacyMarkerPath,
    instructionsPath: manifest.instructionsPath,
  };
}

function commandReplacements(paths, privacyMarker) {
  return {
    repositoryRoot,
    userHome: homedir(),
    temporaryRoot: paths.root,
    privacyMarker,
  };
}

function runCli(operation, manifest, paths, environment, arguments_, privacyMarker, input) {
  return runCertificationCommand({
    operation,
    executable: process.execPath,
    arguments: [manifest.cliEntry, ...arguments_],
    cwd: paths.projectRoot,
    env: environment,
    ...(input === undefined ? {} : { input }),
    replacements: commandReplacements(paths, privacyMarker),
  });
}

function integrationState(paths) {
  const configPath = join(paths.projectRoot, '.codex', 'config.toml');
  const hooksPath = join(paths.projectRoot, '.codex', 'hooks.json');
  const skillPath = join(paths.projectRoot, '.agents', 'skills', 'temporal-awareness', 'SKILL.md');
  const config = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  const hooks = existsSync(hooksPath) ? readFileSync(hooksPath, 'utf8') : '';
  const managedContentPresent =
    existsSync(join(paths.projectRoot, '.codex', 'temporalthread.integration.json')) ||
    config.includes('# temporalthread:codex-mcp:start') ||
    hooks.includes('temporalthread hook codex') ||
    existsSync(skillPath);
  return {
    integrationPresent: managedContentPresent,
    unrelatedConfigPreserved: config.includes('# temporalthread-certification: preserve-unrelated-config'),
    generatedConfigurationHasRealPath:
      config.includes(homedir()) ||
      config.includes(repositoryRoot) ||
      hooks.includes(homedir()) ||
      hooks.includes(repositoryRoot) ||
      (existsSync(skillPath) &&
        (readFileSync(skillPath, 'utf8').includes(homedir()) ||
          readFileSync(skillPath, 'utf8').includes(repositoryRoot))),
  };
}

function statusState(manifest, paths, environment, privacyMarker) {
  const status = parseJsonCommandOutput(
    'read isolated TemporalThread status',
    runCli(
      'read isolated TemporalThread status',
      manifest,
      paths,
      environment,
      ['status', '--json'],
      privacyMarker,
    ),
  );
  return status;
}

function verifyPrivacy(manifest, paths, environment, privacyMarker) {
  assertPrivacyMarkerAbsent(readFileSync(manifest.databasePath), privacyMarker);
  const exportPath = assertManagedPath(paths.root, join(paths.root, 'certification-check-export.json'));
  try {
    runCli(
      'export isolated privacy-permitted data',
      manifest,
      paths,
      environment,
      ['export', '--output', exportPath, '--force'],
      privacyMarker,
    );
    const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
    assertPrivacyMarkerAbsent(exported, privacyMarker);
    if (
      exported.interactions?.some(
        (interaction) => interaction.rawText !== null || interaction.textPreview !== null,
      )
    ) {
      throw new Error('Default privacy export contains raw text or a preview');
    }
    return true;
  } finally {
    if (existsSync(exportPath)) rmSync(exportPath);
  }
}

function exerciseLifecycle(manifest, paths, environment, privacyMarker) {
  const before = statusState(manifest, paths, environment, privacyMarker);
  const sessionId = `automated-lifecycle-${manifest.certificationId}`;
  runCli(
    'exercise isolated SessionStart handling',
    manifest,
    paths,
    environment,
    ['hook', 'codex'],
    privacyMarker,
    JSON.stringify({
      hook_event_name: 'SessionStart',
      session_id: sessionId,
      cwd: paths.projectRoot,
      source: 'startup',
    }),
  );
  const afterSessionStart = statusState(manifest, paths, environment, privacyMarker);
  if (afterSessionStart.counts.interactions !== before.counts.interactions + 1) {
    throw new Error('Automated SessionStart adapter exercise did not add one lifecycle row');
  }

  runCli(
    'exercise isolated Stop handling without assistant text',
    manifest,
    paths,
    environment,
    ['hook', 'codex'],
    privacyMarker,
    JSON.stringify({
      hook_event_name: 'Stop',
      session_id: sessionId,
      turn_id: 'missing-assistant-text',
      cwd: paths.projectRoot,
    }),
  );
  const afterMissingStop = statusState(manifest, paths, environment, privacyMarker);
  if (afterMissingStop.counts.interactions !== afterSessionStart.counts.interactions) {
    throw new Error('A Stop event without assistant text created a fake interaction');
  }

  runCli(
    'exercise isolated Stop handling with assistant text',
    manifest,
    paths,
    environment,
    ['hook', 'codex'],
    privacyMarker,
    JSON.stringify({
      hook_event_name: 'Stop',
      session_id: sessionId,
      turn_id: 'assistant-text-present',
      cwd: paths.projectRoot,
      last_assistant_message: 'Automated lifecycle eligibility check completed.',
    }),
  );
  return {
    sessionStartRecorded: true,
    missingAssistantStopCreatedInteraction: false,
    assistantStopEligibilityExercised: true,
  };
}

export async function checkLiveCodexCertification(arguments_ = process.argv.slice(2)) {
  requireNode24();
  const options = parseArguments(arguments_);
  const manifest = readManifestSafely(options.manifestPath);
  const paths = pathsFromManifest(manifest);
  const privacyMarker = readFileSync(manifest.privacyMarkerPath, 'utf8').trim();
  if (!privacyMarker || sha256Text(privacyMarker) !== manifest.privacyMarkerSha256) {
    throw new Error('Certification privacy marker does not match its manifest digest');
  }
  const environment = {
    ...buildIsolatedEnvironment(paths),
    TEMPORALTHREAD_TIMEZONE: manifest.timezone,
    TEMPORALTHREAD_PRIVACY_MODE: 'temporal-references-only',
    TEMPORALTHREAD_LOG_LEVEL: 'silent',
  };
  const currentCommit = runCertificationCommand({
    operation: 'read the current source commit',
    executable: 'git',
    arguments: ['rev-parse', 'HEAD'],
    cwd: repositoryRoot,
    env: environment,
    replacements: commandReplacements(paths, privacyMarker),
  }).trim();
  if (currentCommit !== manifest.expectedCommit) {
    throw new Error('Certification manifest commit does not match the current repository commit');
  }
  for (const path of [
    paths.projectRoot,
    paths.temporalThreadHome,
    paths.consumerRoot,
    manifest.databasePath,
    manifest.privacyMarkerPath,
  ]) {
    assertManagedPath(paths.root, path);
  }

  const integration = integrationState(paths);
  if (integration.generatedConfigurationHasRealPath) {
    throw new Error('Generated Codex configuration contains a real home or repository path');
  }
  const status = statusState(manifest, paths, environment, privacyMarker);
  const lifecycleState = {
    integrationPresent: integration.integrationPresent,
    databaseExists: existsSync(manifest.databasePath),
    unrelatedConfigPreserved: integration.unrelatedConfigPreserved,
    interactions: status.counts.interactions,
    commitments: status.counts.commitments,
  };
  const stageFailures = evaluateCertificationStage(options.stage, lifecycleState);
  if (stageFailures.length) throw new Error(stageFailures[0]);

  let mcp = null;
  let privacy = null;
  let automatedLifecycle = null;
  if (options.stage === 'installed') {
    const doctor = parseJsonCommandOutput(
      'run the isolated Codex doctor',
      runCli(
        'run the isolated Codex doctor',
        manifest,
        paths,
        environment,
        ['integrate', 'codex', 'doctor', '--scope', 'project', '--json'],
        privacyMarker,
      ),
    );
    if (!doctor.ok) throw new Error('Isolated Codex integration doctor failed');
    mcp = await inspectCertificationMcp({
      consumerRoot: paths.consumerRoot,
      cliEntry: manifest.cliEntry,
      projectRoot: paths.projectRoot,
      environment,
    });
    if (!mcp.context.lastInteraction || mcp.context.lastInteraction.role === 'system') {
      throw new Error('SessionStart lifecycle data masked the previous conversational interaction');
    }
    if (
      !Array.isArray(mcp.commitments.commitments) ||
      mcp.commitments.commitments.length !== 1 ||
      mcp.commitments.commitments[0].dueStartUtc !== manifest.scenario.due
    ) {
      throw new Error('Controlled commitment state does not match the certification manifest');
    }
    const timeline = parseJsonCommandOutput(
      'read the isolated interaction timeline',
      runCli(
        'read the isolated interaction timeline',
        manifest,
        paths,
        environment,
        ['timeline', '--project', paths.projectRoot, '--limit', '100', '--json'],
        privacyMarker,
      ),
    );
    if (
      !timeline.timeline?.some(
        (interaction) => interaction.role === 'user' && interaction.timestamp === manifest.scenario.previous,
      )
    ) {
      throw new Error('Controlled previous user interaction is missing');
    }
    privacy = verifyPrivacy(manifest, paths, environment, privacyMarker);
    if (options.exerciseLifecycle) {
      automatedLifecycle = exerciseLifecycle(manifest, paths, environment, privacyMarker);
      const postLifecycleMcp = await inspectCertificationMcp({
        consumerRoot: paths.consumerRoot,
        cliEntry: manifest.cliEntry,
        projectRoot: paths.projectRoot,
        environment,
      });
      if (postLifecycleMcp.context.lastInteraction?.role !== 'assistant') {
        throw new Error('Assistant Stop text was not eligible as a conversational interaction');
      }
      verifyPrivacy(manifest, paths, environment, privacyMarker);
    }
  }

  return {
    ok: true,
    stage: options.stage,
    expectedCommit: manifest.expectedCommit,
    dependencySecurity: 'NOT_EVALUATED',
    releaseUse: 'PROHIBITED',
    temporaryEnvironment: 'PASS',
    isolatedHome: 'PASS',
    isolatedUserProfile: 'PASS',
    realUserDirectoriesModified: false,
    databaseExists: existsSync(manifest.databasePath),
    databasePreserved: options.stage === 'uninstalled' ? true : null,
    explicitPurge: options.stage === 'purged' ? true : null,
    integrationPresent: integration.integrationPresent,
    unrelatedConfigurationPreserved: integration.unrelatedConfigPreserved,
    mcpDoctor: options.stage === 'installed' ? 'PASS' : 'NOT APPLICABLE',
    toolsDiscovered: mcp?.tools.length ?? null,
    previousConversationalInteractionPreserved:
      options.stage === 'installed' ? mcp?.context.lastInteraction?.role !== 'system' : null,
    commitmentCount: status.counts.commitments,
    privacyMarkerAbsent: privacy,
    automatedAdapterLifecycle: automatedLifecycle,
    managedChildProcesses: 'CLOSED',
    manualClaims: {
      trustApproved: 'NOT OBSERVED',
      mcpVisibleInCodexUi: 'NOT OBSERVED',
      skillVisibleInCodexUi: 'NOT OBSERVED',
      modelUsedContextCorrectly: 'NOT OBSERVED',
      desktopBehavior: 'NOT OBSERVED',
      ideBehavior: 'NOT OBSERVED',
    },
  };
}

async function main() {
  try {
    const result = await checkLiveCodexCertification(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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
