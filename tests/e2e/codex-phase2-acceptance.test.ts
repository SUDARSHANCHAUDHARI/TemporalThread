import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  installCodexIntegration,
  TEMPORALTHREAD_MCP_TOOL_NAMES,
  uninstallCodexIntegration,
} from '@temporalthread/codex-integration';
import { createDefaultConfig, resolveTemporalThreadPaths, writeConfig } from '@temporalthread/config';
import { SqliteStorage } from '@temporalthread/storage-sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'));
const serverEntry = resolve('tests/fixtures/fake-clock-mcp-server.ts');
const typecheckConfig = resolve('tsconfig.typecheck.json');
const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'temporalthread-codex-acceptance-')));
  temporaryRoots.push(root);
  return root;
}

function createClient(home: string, now: string) {
  const stderr: string[] = [];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCli, '--tsconfig', typecheckConfig, serverEntry],
    cwd: process.cwd(),
    env: {
      TEMPORALTHREAD_HOME: home,
      TEMPORALTHREAD_TIMEZONE: 'Asia/Bangkok',
      TEMPORALTHREAD_LOG_LEVEL: 'silent',
      TEMPORALTHREAD_TEST_NOW: now,
      NO_COLOR: '1',
    },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', (chunk) => stderr.push(String(chunk)));
  return {
    client: new Client({ name: 'temporalthread-codex-acceptance', version: '0.1.0' }),
    transport,
    stderr,
  };
}

function content<T>(result: unknown): T {
  if (!result || typeof result !== 'object' || !('structuredContent' in result)) {
    throw new Error('MCP result is missing structured content');
  }
  return result.structuredContent as T;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Codex Phase 2 acceptance flow', () => {
  it('installs, survives an MCP restart, restores July context, and safely uninstalls', async () => {
    const root = temporaryRoot();
    const home = join(root, 'home');
    const project = join(root, 'Project Ω with spaces');
    mkdirSync(join(project, '.codex'), { recursive: true });
    const unrelatedCodexConfig = 'model = "gpt-5"\n';
    writeFileSync(join(project, '.codex', 'config.toml'), unrelatedCodexConfig, 'utf8');

    const environment = {
      ...process.env,
      TEMPORALTHREAD_HOME: home,
      TEMPORALTHREAD_TIMEZONE: 'Asia/Bangkok',
      TEMPORALTHREAD_LOG_LEVEL: 'silent',
    };
    const temporalPaths = resolveTemporalThreadPaths(environment);
    const defaultConfig = createDefaultConfig(temporalPaths, environment);
    writeConfig({ ...defaultConfig, enabledIntegrations: ['codex'] }, temporalPaths);

    const installed = await installCodexIntegration({
      scope: 'project',
      projectRoot: project,
      privacyMode: 'temporal-references-only',
      supportedSurface: 'codex-cli',
      installedAt: '2026-07-15T20:00:00+07:00',
      probe: async () => ({
        ok: true,
        toolNames: [...TEMPORALTHREAD_MCP_TOOL_NAMES],
        durationMs: 1,
      }),
    });
    expect(installed).toMatchObject({
      action: 'installed',
      components: ['mcp', 'skill', 'hooks'],
      databasePreserved: true,
    });
    expect(readFileSync(join(project, '.codex', 'config.toml'), 'utf8')).toContain(
      '[mcp_servers.temporal-thread]',
    );

    const first = createClient(home, '2026-07-15T13:00:00Z');
    await first.client.connect(first.transport);
    expect((await first.client.listTools()).tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([...TEMPORALTHREAD_MCP_TOOL_NAMES]),
    );
    const interactionArguments = {
      role: 'user',
      occurredAt: '2026-07-15T20:00:00+07:00',
      timezone: 'Asia/Bangkok',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: project, name: 'TemporalThread' },
      sessionId: 'codex-phase2-session',
      text: "Let's continue tomorrow.",
      idempotencyKey: 'codex-phase2-july-15-turn',
    };
    const recorded = content<{
      interactionId: string;
      duplicate: boolean;
      temporalReferences: Array<{ resolvedStartUtc: string; resolvedEndUtc: string }>;
    }>(await first.client.callTool({ name: 'record_interaction', arguments: interactionArguments }));
    expect(recorded).toMatchObject({
      duplicate: false,
      temporalReferences: [
        { resolvedStartUtc: '2026-07-15T17:00:00Z', resolvedEndUtc: '2026-07-16T17:00:00Z' },
      ],
    });

    const retried = content<{ interactionId: string; duplicate: boolean }>(
      await first.client.callTool({ name: 'record_interaction', arguments: interactionArguments }),
    );
    expect(retried).toEqual(
      expect.objectContaining({ interactionId: recorded.interactionId, duplicate: true }),
    );

    await first.client.callTool({
      name: 'record_commitment',
      arguments: {
        title: 'Continue TemporalThread',
        originalExpression: 'tomorrow',
        anchorTime: '2026-07-15T20:00:00+07:00',
        timezone: 'Asia/Bangkok',
        project: { path: project },
        sessionId: 'codex-phase2-session',
        sourceInteractionId: recorded.interactionId,
      },
    });
    const commitmentsBeforeRestart = content<{ commitments: unknown[] }>(
      await first.client.callTool({
        name: 'list_commitments',
        arguments: { project: { path: project } },
      }),
    );
    expect(commitmentsBeforeRestart.commitments).toHaveLength(1);
    await first.client.close();
    expect(first.stderr.join('')).toBe('');

    const resumed = createClient(home, '2026-07-19T16:00:00Z');
    await resumed.client.connect(resumed.transport);
    const context = content<{
      lastInteraction: { timestamp: string } | null;
      elapsed: {
        totalMilliseconds: number;
        humanReadable: string;
        calendarDayDifference: number;
      } | null;
      resumedSession: boolean;
      commitments: Array<{ displayStatus: string; overdueCalendarDays: number | null }>;
    }>(
      await resumed.client.callTool({
        name: 'get_temporal_context',
        arguments: { project: { path: project }, includeCommitments: true },
      }),
    );
    expect(context).toMatchObject({
      lastInteraction: { timestamp: '2026-07-15T13:00:00Z' },
      elapsed: {
        totalMilliseconds: 356_400_000,
        humanReadable: '4 days, 3 hours',
        calendarDayDifference: 4,
      },
      resumedSession: true,
      commitments: [{ displayStatus: 'overdue', overdueCalendarDays: 3 }],
    });
    const last = content<{ interaction: Record<string, unknown> | null }>(
      await resumed.client.callTool({
        name: 'get_last_interaction',
        arguments: { project: { path: project }, includeRawText: true },
      }),
    );
    expect(last.interaction).not.toHaveProperty('rawText');
    await resumed.client.close();
    expect(resumed.stderr.join('')).toBe('');

    const storage = new SqliteStorage(temporalPaths.databasePath);
    try {
      expect(storage.tableCounts()).toMatchObject({
        interactions: 1,
        temporalReferences: 1,
        commitments: 1,
      });
      expect(storage.listInteractions()[0]?.interaction.rawText).toBeNull();
    } finally {
      storage.close();
    }

    const uninstalled = await uninstallCodexIntegration({
      scope: 'project',
      projectRoot: project,
      installedAt: '2026-07-19T23:05:00+07:00',
    });
    expect(uninstalled.databasePreserved).toBe(true);
    expect(readFileSync(join(project, '.codex', 'config.toml'), 'utf8')).toBe(unrelatedCodexConfig);
    expect(existsSync(join(project, '.agents', 'skills', 'temporal-awareness', 'SKILL.md'))).toBe(false);
    expect(existsSync(temporalPaths.databasePath)).toBe(true);
  });
});
