import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { TemporalThreadConfig } from '@temporalthread/config';
import { FakeClock, TemporalThreadService } from '@temporalthread/core';
import { createMcpServer } from '@temporalthread/mcp-server';
import { SqliteStorage } from '@temporalthread/storage-sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const config: TemporalThreadConfig = {
  databasePath: ':memory:',
  timezone: 'Asia/Bangkok',
  locale: 'en-US',
  privacyMode: 'temporal-references-only',
  sessionInactivityThresholdMinutes: 30,
  temporalContextRefreshThresholdMinutes: 30,
  maxTextBytes: 100_000,
  enabledIntegrations: ['generic'],
  logLevel: 'silent',
};

describe('MCP server tool boundary', () => {
  let storage: SqliteStorage;
  let server: ReturnType<typeof createMcpServer>;
  let client: Client;

  beforeEach(async () => {
    storage = new SqliteStorage(':memory:');
    server = createMcpServer(
      new TemporalThreadService({
        storage,
        config,
        clock: new FakeClock('2026-07-19T13:00:00Z'),
      }),
    );
    client = new Client({ name: 'temporalthread-test', version: '0.1.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    storage.close();
  });

  it('publishes exactly nine strict tools with structured output and annotations', async () => {
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      'get_current_time',
      'record_interaction',
      'get_temporal_context',
      'get_last_interaction',
      'calculate_elapsed_time',
      'resolve_relative_time',
      'record_commitment',
      'list_commitments',
      'update_commitment',
    ]);
    for (const tool of listed.tools) {
      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
      expect(tool.outputSchema).toMatchObject({ type: 'object', additionalProperties: false });
      expect(tool.annotations?.openWorldHint).toBe(false);
    }
    expect(listed.tools.find((tool) => tool.name === 'get_current_time')?.annotations?.readOnlyHint).toBe(
      true,
    );
    expect(listed.tools.find((tool) => tool.name === 'record_interaction')?.annotations?.readOnlyHint).toBe(
      false,
    );
  });

  it('executes every tool with SDK-validated structured results', async () => {
    const current = await client.callTool({ name: 'get_current_time', arguments: {} });
    expect(current.structuredContent).toMatchObject({
      utcTime: '2026-07-19T13:00:00Z',
      timezone: 'Asia/Bangkok',
      date: '2026-07-19',
    });

    const elapsed = await client.callTool({
      name: 'calculate_elapsed_time',
      arguments: { start: '2026-07-15T13:00:00Z', timezone: 'Asia/Bangkok' },
    });
    expect(elapsed.structuredContent).toMatchObject({ hours: 96, calendarDayDifference: 4 });

    const relative = await client.callTool({
      name: 'resolve_relative_time',
      arguments: {
        expression: 'tomorrow',
        anchorTime: '2026-07-15T20:00:00+07:00',
        timezone: 'Asia/Bangkok',
      },
    });
    expect(relative.structuredContent).toMatchObject({ resolvedStartUtc: '2026-07-15T17:00:00Z' });

    const recorded = await client.callTool({
      name: 'record_interaction',
      arguments: {
        role: 'user',
        occurredAt: '2026-07-15T20:00:00+07:00',
        timezone: 'Asia/Bangkok',
        agent: { name: 'Codex', platform: 'codex' },
        project: { path: '/test/project', name: 'Project' },
        sessionId: 'mcp-session',
        text: "Let's continue tomorrow.",
        idempotencyKey: 'mcp-event',
      },
    });
    const recordedContent = recorded.structuredContent as { interactionId?: unknown } | undefined;
    const interactionId = String(recordedContent?.interactionId);
    expect(recorded.structuredContent).toMatchObject({
      duplicate: false,
      privacyMode: 'temporal-references-only',
    });

    const last = await client.callTool({
      name: 'get_last_interaction',
      arguments: { sessionId: 'mcp-session' },
    });
    expect(last.structuredContent).toMatchObject({
      interaction: { interactionId, timestamp: '2026-07-15T13:00:00Z' },
    });

    const commitment = await client.callTool({
      name: 'record_commitment',
      arguments: {
        title: 'Continue',
        originalExpression: 'tomorrow',
        anchorTime: '2026-07-15T20:00:00+07:00',
        timezone: 'Asia/Bangkok',
        project: { path: '/test/project' },
        sessionId: 'mcp-session',
        sourceInteractionId: interactionId,
      },
    });
    const commitmentContent = commitment.structuredContent as { commitment?: { id?: string } } | undefined;
    const commitmentId = String(commitmentContent?.commitment?.id);
    expect(commitment.structuredContent).toMatchObject({
      commitment: { displayStatus: 'overdue', overdueCalendarDays: 3 },
    });

    const listed = await client.callTool({ name: 'list_commitments', arguments: {} });
    expect(listed.structuredContent).toMatchObject({ counts: { overdue: 1 } });

    const context = await client.callTool({
      name: 'get_temporal_context',
      arguments: { project: { path: '/test/project' } },
    });
    expect(context.structuredContent).toMatchObject({
      elapsed: { calendarDayDifference: 4 },
      commitments: [{ id: commitmentId, displayStatus: 'overdue' }],
    });

    const updated = await client.callTool({
      name: 'update_commitment',
      arguments: { commitmentId, status: 'completed' },
    });
    expect(updated.structuredContent).toMatchObject({
      action: 'completed',
      commitment: { displayStatus: 'completed' },
    });
  });

  it('rejects unknown input fields and never echoes rejected private text in service errors', async () => {
    const invalid = await client.callTool({
      name: 'get_current_time',
      arguments: { unexpected: true },
    });
    expect(invalid.isError).toBe(true);

    const privateText = 'private-value-'.repeat(10_000);
    const oversized = await client.callTool({
      name: 'record_interaction',
      arguments: {
        role: 'user',
        agent: { name: 'Codex', platform: 'codex' },
        text: privateText,
      },
    });
    expect(oversized.isError).toBe(true);
    expect(JSON.stringify(oversized)).not.toContain('private-value');
  });
});
