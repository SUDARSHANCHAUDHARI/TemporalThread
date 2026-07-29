import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Interaction } from '@sudarshanchaudhari/temporalthread-shared-types';
import { latestMigrationVersion, SqliteStorage } from '@sudarshanchaudhari/temporalthread-storage-sqlite';
import { describe, expect, it } from 'vitest';

const interaction = (overrides: Partial<Interaction> = {}): Interaction => ({
  id: '01J00000000000000000000001',
  idempotencyKey: 'event-1',
  sessionId: '01J00000000000000000000002',
  agentId: '01J00000000000000000000003',
  projectId: '01J00000000000000000000004',
  role: 'user',
  occurredAtUtc: '2026-07-15T13:00:00Z',
  timezone: 'Asia/Bangkok',
  utcOffsetMinutes: 420,
  messageHash: 'sha256:test',
  textPreview: null,
  rawText: null,
  privacyMode: 'temporal-references-only',
  createdAt: '2026-07-15T13:00:00Z',
  ...overrides,
});

describe('SqliteStorage', () => {
  it('migrates, persists, and orders interactions by occurrence time', () => {
    const root = mkdtempSync(join(tmpdir(), 'temporalthread-storage-'));
    const databasePath = join(root, 'thread.sqlite');
    let storage = new SqliteStorage(databasePath);
    expect(storage.getMigrationVersion()).toBe(latestMigrationVersion);
    expect(storage.integrityCheck()).toBe('ok');

    const agent = storage.upsertAgent({
      id: '01J00000000000000000000003',
      name: 'Codex',
      platform: 'codex',
      version: '0.144.5',
      seenAt: '2026-07-15T13:00:00Z',
    });
    const project = storage.upsertProject({
      id: '01J00000000000000000000004',
      name: 'TemporalThread',
      normalizedPath: '/tmp/TemporalThread',
      repositoryRemote: null,
      seenAt: '2026-07-15T13:00:00Z',
    });
    storage.createSession({
      id: '01J00000000000000000000002',
      externalSessionId: 'codex-session',
      agentId: agent.id,
      projectId: project.id,
      occurredAt: '2026-07-15T13:00:00Z',
      generated: false,
      metadata: {},
    });
    storage.insertInteraction({ interaction: interaction(), temporalReferences: [] });
    storage.insertInteraction({
      interaction: interaction({
        id: '01J00000000000000000000005',
        idempotencyKey: 'event-older',
        occurredAtUtc: '2026-07-14T13:00:00Z',
      }),
      temporalReferences: [],
    });
    storage.close();

    storage = new SqliteStorage(databasePath);
    expect(storage.getLastInteraction()?.interaction.idempotencyKey).toBe('event-1');
    expect(storage.tableCounts().interactions).toBe(2);
    storage.close();
  });

  it('deduplicates an idempotency key in the write transaction', () => {
    const storage = new SqliteStorage(':memory:');
    storage.upsertAgent({
      id: '01J00000000000000000000003',
      name: 'Codex',
      platform: 'codex',
      version: null,
      seenAt: '2026-07-15T13:00:00Z',
    });
    storage.createSession({
      id: '01J00000000000000000000002',
      externalSessionId: null,
      agentId: '01J00000000000000000000003',
      projectId: null,
      occurredAt: '2026-07-15T13:00:00Z',
      generated: true,
      metadata: {},
    });
    const noProject = interaction({ projectId: null });

    expect(storage.insertInteraction({ interaction: noProject, temporalReferences: [] }).duplicate).toBe(
      false,
    );
    expect(
      storage.insertInteraction({
        interaction: { ...noProject, id: '01J00000000000000000000009' },
        temporalReferences: [],
      }).duplicate,
    ).toBe(true);
    expect(storage.tableCounts().interactions).toBe(1);
    storage.close();
  });

  it('returns a sanitized error for a corrupt database', () => {
    const root = mkdtempSync(join(tmpdir(), 'temporalthread-storage-'));
    const databasePath = join(root, 'corrupt.sqlite');
    writeFileSync(databasePath, 'not a sqlite database', 'utf8');

    expect(() => new SqliteStorage(databasePath)).toThrow(
      'Unable to open or migrate the TemporalThread database',
    );
  });
});
