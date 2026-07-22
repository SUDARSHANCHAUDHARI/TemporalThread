import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const expectedMcpTools = [
  'calculate_elapsed_time',
  'get_current_time',
  'get_last_interaction',
  'get_temporal_context',
  'list_commitments',
  'record_commitment',
  'record_interaction',
  'resolve_relative_time',
  'update_commitment',
];

function assertToolResult(label, result) {
  if (result.isError) throw new Error(`${label} returned an MCP error`);
  if (!result.structuredContent && !result.content?.length) {
    throw new Error(`${label} returned no MCP result content`);
  }
}

export async function exerciseMcpRelease(options) {
  const consumerManifest = join(options.nodeModulesRoot, '..', 'package.json');
  const resolveFromRuntime = createRequire(realpathSync(options.dependencyResolverPath ?? consumerManifest));
  const [{ Client }, { StdioClientTransport, getDefaultEnvironment }] = await Promise.all([
    import(pathToFileURL(resolveFromRuntime.resolve('@modelcontextprotocol/sdk/client/index.js')).href),
    import(pathToFileURL(resolveFromRuntime.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href),
  ]);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [options.cliEntry, 'start'],
    cwd: options.cwd,
    env: { ...getDefaultEnvironment(), ...options.env },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => {
    // Drain diagnostics without forwarding local paths or data.
  });
  const client = new Client({ name: 'temporalthread-release-smoke', version: '0.1.0' });

  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const tools = listed.tools.map((tool) => tool.name).sort();
    if (JSON.stringify(tools) !== JSON.stringify(expectedMcpTools)) {
      throw new Error(`Expected nine TemporalThread MCP tools; discovered ${tools.length}`);
    }

    const project = { path: options.cwd, name: 'Release Smoke Project' };
    const agent = { name: 'Release smoke agent', platform: 'generic' };
    const interaction = await client.callTool({
      name: 'record_interaction',
      arguments: {
        role: 'user',
        occurredAt: '2026-07-15T20:00:00+07:00',
        timezone: 'Asia/Bangkok',
        agent,
        project,
        sessionId: 'release-smoke-session',
        text: 'RELEASE_SMOKE_PRIVATE_SENTENCE should not persist in full; continue tomorrow.',
        idempotencyKey: 'release-smoke-interaction',
      },
    });
    assertToolResult('record_interaction', interaction);

    const commitment = await client.callTool({
      name: 'record_commitment',
      arguments: {
        title: 'Run the controlled release follow-up',
        originalExpression: 'tomorrow',
        anchorTime: '2026-07-15T20:00:00+07:00',
        timezone: 'Asia/Bangkok',
        project,
        sessionId: 'release-smoke-session',
      },
    });
    assertToolResult('record_commitment', commitment);

    const context = await client.callTool({
      name: 'get_temporal_context',
      arguments: {
        agent: { name: agent.name, platform: agent.platform },
        project: { path: project.path },
        sessionId: 'release-smoke-session',
        includeCommitments: true,
      },
    });
    assertToolResult('get_temporal_context', context);
    if (!JSON.stringify(context).includes('Run the controlled release follow-up')) {
      throw new Error('Temporal context did not return the recorded commitment');
    }

    return { tools, interaction: true, commitment: true, context: true };
  } finally {
    await client.close().catch(() => undefined);
  }
}
