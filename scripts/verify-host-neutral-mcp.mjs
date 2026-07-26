import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { expectedMcpTools } from './mcp-release-smoke.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const cliEntry = join(repositoryRoot, 'apps', 'cli', 'dist', 'bin.js');
const verificationRoot = mkdtempSync(join(tmpdir(), 'temporalthread-host-neutral-'));
const isolatedHome = join(verificationRoot, 'home');
const processTemp = join(verificationRoot, 'process-temp');
const projectRoot = join(verificationRoot, 'Project Ω with spaces');
const privateMarker = 'HOST_NEUTRAL_PRIVATE_SENTENCE_DO_NOT_PERSIST';

function sanitized(value) {
  return String(value)
    .replaceAll(repositoryRoot, '<repository>')
    .replaceAll(verificationRoot, '<temporary>')
    .slice(0, 4_000);
}

function runCli(arguments_) {
  const result = spawnSync(process.execPath, [cliEntry, ...arguments_], {
    cwd: projectRoot,
    env: environment,
    encoding: 'utf8',
    maxBuffer: 10 * 1_024 * 1_024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `Host-neutral CLI command failed: ${arguments_.join(' ')}`,
        `status: ${result.status ?? 'unavailable'}`,
        `stdout: ${sanitized(result.stdout)}`,
        `stderr: ${sanitized(result.stderr)}`,
      ].join('\n'),
    );
  }
  return result.stdout;
}

function resultObject(label, result, expectError = false) {
  if (expectError !== Boolean(result.isError)) {
    throw new Error(`${label} returned an unexpected MCP error state`);
  }
  if (result.structuredContent && typeof result.structuredContent === 'object') {
    return result.structuredContent;
  }
  const text = result.content?.find((item) => item.type === 'text')?.text;
  if (!text) throw new Error(`${label} returned no structured or text content`);
  if (expectError) return { message: text };
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} did not return valid JSON content`);
  }
}

function assertEqual(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} did not match the expected value`);
  }
}

async function connectClient(name) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliEntry, 'start'],
    cwd: projectRoot,
    env: { ...getDefaultEnvironment(), ...environment },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => {
    // Drain diagnostics without exposing temporary paths or stored data.
  });
  const client = new Client({ name, version: '0.1.0' });
  await client.connect(transport);
  return client;
}

mkdirSync(isolatedHome, { recursive: true, mode: 0o700 });
mkdirSync(processTemp, { recursive: true, mode: 0o700 });
mkdirSync(projectRoot, { recursive: true, mode: 0o700 });

const environment = {
  ...process.env,
  HOME: isolatedHome,
  USERPROFILE: isolatedHome,
  TEMPORALTHREAD_HOME: join(isolatedHome, '.temporalthread'),
  TEMPORALTHREAD_TIMEZONE: 'Asia/Bangkok',
  TEMPORALTHREAD_LOG_LEVEL: 'silent',
  TMPDIR: processTemp,
  TEMP: processTemp,
  TMP: processTemp,
  NO_COLOR: '1',
};
delete environment.OPENAI_API_KEY;
delete environment.ANTHROPIC_API_KEY;
delete environment.NODE_AUTH_TOKEN;

let firstClient;
let secondClient;
try {
  if (!existsSync(cliEntry)) throw new Error('Build the workspace before host-neutral MCP verification');

  const initialized = JSON.parse(
    runCli(['init', '--yes', '--timezone', 'Asia/Bangkok', '--integration', 'generic', '--json']),
  );
  if (initialized.privacyMode !== 'temporal-references-only') {
    throw new Error('Host-neutral initialization did not preserve the default privacy mode');
  }
  if (initialized.hostConfigurationsModified !== false) {
    throw new Error('Host-neutral initialization modified a host configuration');
  }

  firstClient = await connectClient('temporalthread-host-neutral-first');
  const listed = await firstClient.listTools();
  const tools = listed.tools.map((tool) => tool.name).sort();
  assertEqual('MCP tool discovery', tools, expectedMcpTools);

  const currentTime = resultObject(
    'get_current_time',
    await firstClient.callTool({
      name: 'get_current_time',
      arguments: { timezone: 'Asia/Bangkok' },
    }),
  );
  if (currentTime.timezone !== 'Asia/Bangkok') throw new Error('Current-time timezone was not preserved');

  const elapsed = resultObject(
    'calculate_elapsed_time',
    await firstClient.callTool({
      name: 'calculate_elapsed_time',
      arguments: {
        start: '2026-07-15T20:00:00+07:00',
        end: '2026-07-19T23:00:00+07:00',
        timezone: 'Asia/Bangkok',
      },
    }),
  );
  if (elapsed.totalMilliseconds !== 99 * 60 * 60 * 1_000 || elapsed.calendarDayDifference !== 4) {
    throw new Error('Elapsed-time calculation failed the controlled scenario');
  }

  const resolution = resultObject(
    'resolve_relative_time',
    await firstClient.callTool({
      name: 'resolve_relative_time',
      arguments: {
        expression: 'tomorrow',
        anchorTime: '2026-07-15T20:00:00+07:00',
        timezone: 'Asia/Bangkok',
      },
    }),
  );
  if (!resolution.resolvedStartUtc || !resolution.resolvedEndUtc) {
    throw new Error('Relative-time resolution did not produce a bounded result');
  }

  const agent = { name: 'Host-neutral agent', platform: 'generic' };
  const project = { path: projectRoot, name: 'Host-neutral project' };
  const interactionArguments = {
    role: 'user',
    occurredAt: '2026-07-15T20:00:00+07:00',
    timezone: 'Asia/Bangkok',
    agent,
    project,
    sessionId: 'host-neutral-session',
    text: `${privateMarker}; continue tomorrow.`,
    idempotencyKey: 'host-neutral-interaction',
  };
  const interaction = resultObject(
    'record_interaction',
    await firstClient.callTool({ name: 'record_interaction', arguments: interactionArguments }),
  );
  if (interaction.duplicate !== false || interaction.privacyMode !== 'temporal-references-only') {
    throw new Error('Initial interaction recording failed');
  }
  const duplicate = resultObject(
    'record_interaction duplicate',
    await firstClient.callTool({ name: 'record_interaction', arguments: interactionArguments }),
  );
  if (duplicate.duplicate !== true || duplicate.interactionId !== interaction.interactionId) {
    throw new Error('Interaction idempotency did not preserve the original record');
  }

  const last = resultObject(
    'get_last_interaction',
    await firstClient.callTool({
      name: 'get_last_interaction',
      arguments: {
        agent: { name: agent.name, platform: agent.platform },
        project: { path: projectRoot },
        sessionId: 'host-neutral-session',
      },
    }),
  );
  if (last.interaction?.interactionId !== interaction.interactionId || 'rawText' in (last.interaction ?? {})) {
    throw new Error('Last-interaction lookup violated identity or default privacy expectations');
  }

  const commitment = resultObject(
    'record_commitment',
    await firstClient.callTool({
      name: 'record_commitment',
      arguments: {
        title: 'Run the host-neutral follow-up',
        originalExpression: 'tomorrow',
        anchorTime: '2026-07-15T20:00:00+07:00',
        timezone: 'Asia/Bangkok',
        project: { path: projectRoot },
        sessionId: 'host-neutral-session',
        sourceInteractionId: interaction.interactionId,
      },
    }),
  );
  const commitmentId = commitment.commitment?.id;
  if (!commitmentId || commitment.commitment.originalText !== null) {
    throw new Error('Commitment creation failed or retained original text under the default privacy mode');
  }

  const commitments = resultObject(
    'list_commitments',
    await firstClient.callTool({
      name: 'list_commitments',
      arguments: { project: { path: projectRoot } },
    }),
  );
  if (!commitments.commitments?.some((item) => item.id === commitmentId)) {
    throw new Error('Commitment listing omitted the recorded commitment');
  }

  const completed = resultObject(
    'update_commitment complete',
    await firstClient.callTool({
      name: 'update_commitment',
      arguments: {
        commitmentId,
        status: 'completed',
        completedAt: '2026-07-19T23:00:00+07:00',
      },
    }),
  );
  const completedAt = completed.commitment?.completedAt;
  if (completed.commitment?.status !== 'completed' || !completedAt) {
    throw new Error('Commitment completion failed');
  }

  const repeatedCompletion = resultObject(
    'update_commitment repeated completion',
    await firstClient.callTool({
      name: 'update_commitment',
      arguments: { commitmentId, status: 'completed' },
    }),
  );
  if (repeatedCompletion.commitment?.completedAt !== completedAt) {
    throw new Error('Repeated completion rewrote the original completion timestamp');
  }

  const rescheduled = resultObject(
    'update_commitment reschedule',
    await firstClient.callTool({
      name: 'update_commitment',
      arguments: {
        commitmentId,
        status: 'rescheduled',
        newDueExpression: 'next Friday',
        anchorTime: '2026-07-19T23:00:00+07:00',
        timezone: 'Asia/Bangkok',
      },
    }),
  );
  if (
    rescheduled.commitment?.status !== 'pending' ||
    rescheduled.commitment?.completedAt !== null ||
    rescheduled.commitment?.cancelledAt !== null
  ) {
    throw new Error('Rescheduling did not reopen and clear terminal timestamps');
  }

  const cancelledCommitment = resultObject(
    'record second commitment',
    await firstClient.callTool({
      name: 'record_commitment',
      arguments: {
        title: 'Cancellation transition guard',
        anchorTime: '2026-07-19T23:00:00+07:00',
        timezone: 'Asia/Bangkok',
        project: { path: projectRoot },
      },
    }),
  );
  const cancelledId = cancelledCommitment.commitment?.id;
  if (!cancelledId) throw new Error('Second commitment creation failed');
  resultObject(
    'cancel second commitment',
    await firstClient.callTool({
      name: 'update_commitment',
      arguments: { commitmentId: cancelledId, status: 'cancelled' },
    }),
  );
  const invalidTransition = resultObject(
    'reject cancelled-to-completed transition',
    await firstClient.callTool({
      name: 'update_commitment',
      arguments: { commitmentId: cancelledId, status: 'completed' },
    }),
    true,
  );
  if (!String(invalidTransition.message).startsWith('Invalid commitment transition:')) {
    throw new Error('Invalid lifecycle transition did not return a bounded safe MCP error');
  }

  const invalidInput = resultObject(
    'reject unknown input field',
    await firstClient.callTool({
      name: 'get_current_time',
      arguments: { timezone: 'UTC', unexpected: true },
    }),
    true,
  );
  if (invalidInput.message !== 'Invalid tool input') {
    throw new Error('Strict input validation did not return the expected safe error');
  }

  const context = resultObject(
    'get_temporal_context',
    await firstClient.callTool({
      name: 'get_temporal_context',
      arguments: {
        agent: { name: agent.name, platform: agent.platform },
        project: { path: projectRoot },
        sessionId: 'host-neutral-session',
        includeCommitments: true,
      },
    }),
  );
  if (context.lastInteraction?.interactionId !== interaction.interactionId) {
    throw new Error('Temporal context did not preserve the meaningful interaction');
  }

  await firstClient.close();
  firstClient = undefined;

  secondClient = await connectClient('temporalthread-host-neutral-restart');
  const persisted = resultObject(
    'get_temporal_context after restart',
    await secondClient.callTool({
      name: 'get_temporal_context',
      arguments: {
        agent: { name: agent.name, platform: agent.platform },
        project: { path: projectRoot },
        sessionId: 'host-neutral-session',
        includeCommitments: true,
      },
    }),
  );
  if (persisted.lastInteraction?.interactionId !== interaction.interactionId) {
    throw new Error('MCP server restart did not preserve interaction continuity');
  }
  if (!persisted.commitments?.some((item) => item.id === commitmentId)) {
    throw new Error('MCP server restart did not preserve commitment continuity');
  }

  await secondClient.close();
  secondClient = undefined;

  const databasePath = initialized.databasePath;
  if (!existsSync(databasePath)) throw new Error('Host-neutral verification database was not created');
  if (readFileSync(databasePath).includes(privateMarker)) {
    throw new Error('Default privacy mode retained the complete host-neutral prompt');
  }
  if (existsSync(join(projectRoot, '.codex')) || existsSync(join(projectRoot, '.claude'))) {
    throw new Error('Host-neutral verification created host-specific configuration');
  }

  const status = JSON.parse(runCli(['status', '--json']));
  if (status.integrity !== 'ok' || status.counts.interactions !== 1 || status.counts.commitments !== 2) {
    throw new Error('Host-neutral final status failed integrity or persistence checks');
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      tools: tools.length,
      allToolsExercised: true,
      strictInputValidation: true,
      lifecycleTransitions: true,
      idempotency: true,
      restartPersistence: true,
      defaultPrivacy: true,
      hostConfigurationModified: false,
      integrity: status.integrity,
    })}\n`,
  );
} finally {
  await firstClient?.close().catch(() => undefined);
  await secondClient?.close().catch(() => undefined);
  rmSync(verificationRoot, { recursive: true, force: true });
}
