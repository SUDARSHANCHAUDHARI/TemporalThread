import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertExactToolDiscovery } from './live-codex-certification-utils.mjs';

function structuredResult(label, result) {
  if (result.isError) throw new Error(`${label} returned an MCP error`);
  if (!result.structuredContent || typeof result.structuredContent !== 'object') {
    throw new Error(`${label} returned no structured MCP result`);
  }
  return result.structuredContent;
}

async function withCertificationClient(options, operation) {
  const consumerManifest = join(options.consumerRoot, 'package.json');
  const resolveFromConsumer = createRequire(realpathSync(consumerManifest));
  const [{ Client }, { StdioClientTransport, getDefaultEnvironment }] = await Promise.all([
    import(pathToFileURL(resolveFromConsumer.resolve('@modelcontextprotocol/sdk/client/index.js')).href),
    import(pathToFileURL(resolveFromConsumer.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href),
  ]);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [options.cliEntry, 'start'],
    cwd: options.projectRoot,
    env: { ...getDefaultEnvironment(), ...options.environment },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => {
    // Drain bounded host diagnostics without forwarding local paths or stored data.
  });
  const client = new Client({
    name: 'temporalthread-live-codex-certification',
    version: '0.1.0',
  });
  try {
    await client.connect(transport);
    return await operation(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function listExactTools(client) {
  const listed = await client.listTools();
  const tools = listed.tools.map((tool) => tool.name).sort();
  assertExactToolDiscovery(tools);
  return tools;
}

export async function seedCertificationScenario(options) {
  return withCertificationClient(options, async (client) => {
    const tools = await listExactTools(client);
    const project = {
      path: options.projectRoot,
      name: 'TemporalThread Live Codex Certification',
    };
    const agent = { name: 'Codex', platform: 'codex', version: 'manual-certification' };
    const sessionId = 'temporalthread-live-certification-seed-v1';
    const interaction = structuredResult(
      'record_interaction',
      await client.callTool({
        name: 'record_interaction',
        arguments: {
          role: 'user',
          occurredAt: options.scenario.previous,
          timezone: options.timezone,
          agent,
          project,
          sessionId,
          text: `${options.privacyMarker} Let's continue tomorrow.`,
          idempotencyKey: `live-certification:${options.certificationId}:seed-interaction`,
          privacyMode: 'temporal-references-only',
        },
      }),
    );
    const interactionId = interaction.interactionId;
    if (typeof interactionId !== 'string') throw new Error('Seed interaction did not return an id');

    const commitment = structuredResult(
      'record_commitment',
      await client.callTool({
        name: 'record_commitment',
        arguments: {
          title: 'Complete the controlled TemporalThread certification follow-up',
          originalExpression: 'in 24 hours',
          anchorTime: options.scenario.previous,
          timezone: options.timezone,
          project: { path: options.projectRoot },
          sessionId,
          sourceInteractionId: interactionId,
        },
      }),
    );
    if (commitment.commitment?.dueStartUtc !== options.scenario.due) {
      throw new Error('Seed commitment did not resolve to the controlled due instant');
    }

    const context = structuredResult(
      'get_temporal_context',
      await client.callTool({
        name: 'get_temporal_context',
        arguments: {
          agent: { name: agent.name, platform: agent.platform },
          project: { path: options.projectRoot },
          includeCommitments: true,
        },
      }),
    );
    if (context.lastInteraction?.timestamp !== options.scenario.previous) {
      throw new Error('Controlled previous interaction was not restored');
    }
    if (!Array.isArray(context.commitments) || context.commitments.length !== 1) {
      throw new Error('Controlled scenario must contain exactly one commitment');
    }

    return {
      tools,
      interactionId,
      commitmentId: commitment.commitment.id,
      previousInteractionTimestamp: context.lastInteraction.timestamp,
      previousInteractionRole: context.lastInteraction.role,
      commitmentStatus: context.commitments[0].displayStatus,
      commitmentDue: context.commitments[0].dueStartUtc,
    };
  });
}

export async function inspectCertificationMcp(options) {
  return withCertificationClient(options, async (client) => {
    const tools = await listExactTools(client);
    const context = structuredResult(
      'get_temporal_context',
      await client.callTool({
        name: 'get_temporal_context',
        arguments: {
          agent: { name: 'Codex', platform: 'codex' },
          project: { path: options.projectRoot },
          includeCommitments: true,
        },
      }),
    );
    const commitments = structuredResult(
      'list_commitments',
      await client.callTool({
        name: 'list_commitments',
        arguments: {
          project: { path: options.projectRoot },
          limit: 10,
        },
      }),
    );
    return { tools, context, commitments };
  });
}
