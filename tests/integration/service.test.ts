import { resolve } from 'node:path';
import type { TemporalThreadConfig } from '@sudarshanchaudhari/temporalthread-config';
import { FakeClock, TemporalThreadService } from '@sudarshanchaudhari/temporalthread-core';
import { SqliteStorage } from '@sudarshanchaudhari/temporalthread-storage-sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const projectAlpha = resolve('fixtures/project-alpha');
const projectBeta = resolve('fixtures/project-beta');

function configuration(overrides: Partial<TemporalThreadConfig> = {}): TemporalThreadConfig {
  return {
    databasePath: ':memory:',
    timezone: 'Asia/Bangkok',
    locale: 'en-US',
    privacyMode: 'temporal-references-only',
    sessionInactivityThresholdMinutes: 30,
    temporalContextRefreshThresholdMinutes: 30,
    maxTextBytes: 100_000,
    enabledIntegrations: ['generic'],
    logLevel: 'silent',
    ...overrides,
  };
}

function harness(overrides: Partial<TemporalThreadConfig> = {}) {
  const storage = new SqliteStorage(':memory:');
  const clock = new FakeClock('2026-07-19T13:00:00Z');
  const service = new TemporalThreadService({ storage, clock, config: configuration(overrides) });
  return { storage, clock, service };
}

const openStorage: SqliteStorage[] = [];

function trackedHarness(overrides: Partial<TemporalThreadConfig> = {}) {
  const result = harness(overrides);
  openStorage.push(result.storage);
  return result;
}

afterEach(() => {
  for (const storage of openStorage.splice(0)) storage.close();
});

describe('TemporalThreadService interaction continuity', () => {
  it('ends a scoped external session idempotently and reopens it on a later interaction', () => {
    const { service, storage } = trackedHarness();
    const recorded = service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-19T10:00:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectAlpha, name: 'Alpha' },
      sessionId: 'lifecycle-session',
      idempotencyKey: 'lifecycle-start',
    });
    service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-19T10:00:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectBeta, name: 'Beta' },
      sessionId: 'lifecycle-session',
      idempotencyKey: 'lifecycle-other-project',
    });

    expect(
      service.endSession({
        sessionId: recorded.sessionId,
        endedAt: '2026-07-19T10:03:00Z',
        agent: { name: 'Codex', platform: 'codex' },
        project: { path: projectBeta },
      }),
    ).toEqual({ ended: false, endedAt: null });
    expect(storage.getSession(recorded.sessionId)?.endedAt).toBeNull();

    expect(
      service.endSession({
        sessionId: 'lifecycle-session',
        endedAt: '2026-07-19T10:05:00Z',
        agent: { name: 'Codex', platform: 'codex' },
        project: { path: projectAlpha },
      }),
    ).toEqual({ ended: true, endedAt: '2026-07-19T10:05:00Z' });
    expect(storage.getSession(recorded.sessionId)?.endedAt).toBe('2026-07-19T10:05:00Z');

    expect(
      service.endSession({
        sessionId: 'lifecycle-session',
        endedAt: '2026-07-19T10:04:00Z',
        agent: { name: 'Codex', platform: 'codex' },
        project: { path: projectAlpha },
      }),
    ).toEqual({ ended: true, endedAt: '2026-07-19T10:05:00Z' });

    service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-19T10:06:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectAlpha },
      sessionId: 'lifecycle-session',
      idempotencyKey: 'lifecycle-resume',
    });
    expect(storage.getSession(recorded.sessionId)).toMatchObject({
      endedAt: null,
      lastInteractionAt: '2026-07-19T10:06:00Z',
    });
  });

  it('anchors tomorrow to the original interaction and reports the July 19 context', () => {
    const { service } = trackedHarness();
    const recorded = service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-15T20:00:00+07:00',
      timezone: 'Asia/Bangkok',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectAlpha, name: 'Alpha' },
      sessionId: 'session-1',
      text: "Let's continue tomorrow.",
      idempotencyKey: 'acceptance-interaction',
    });

    expect(recorded.temporalReferences).toHaveLength(1);
    expect(recorded.temporalReferences[0]?.resolvedStartUtc).toBe('2026-07-15T17:00:00Z');
    expect(recorded.temporalReferences[0]?.resolvedEndUtc).toBe('2026-07-16T17:00:00Z');

    service.recordCommitment({
      title: 'Continue the project',
      originalExpression: 'tomorrow',
      anchorTime: '2026-07-15T20:00:00+07:00',
      timezone: 'Asia/Bangkok',
      project: { path: projectAlpha },
      sessionId: 'session-1',
      sourceInteractionId: recorded.interactionId,
    });
    const context = service.getTemporalContext({
      project: { path: projectAlpha },
      includeCommitments: true,
    });

    expect(context.lastInteraction?.timestamp).toBe('2026-07-15T13:00:00Z');
    expect(context.elapsed).toMatchObject({
      totalMilliseconds: 345_600_000,
      calendarDayDifference: 4,
      humanReadable: '4 days',
    });
    expect(context.resumedSession).toBe(true);
    expect(context.commitments).toHaveLength(1);
    expect(context.commitments[0]).toMatchObject({
      displayStatus: 'overdue',
      overdueCalendarDays: 3,
    });
  });

  it('enforces all privacy modes in persisted rows and retrieval responses', () => {
    const { service, storage } = trackedHarness();
    const common = {
      role: 'user' as const,
      occurredAt: '2026-07-18T13:00:00Z',
      timezone: 'UTC',
      agent: { name: 'Codex', platform: 'codex' },
      text: 'Continue tomorrow with the private details.',
    };
    const metadata = service.recordInteraction({
      ...common,
      privacyMode: 'metadata-only',
      idempotencyKey: 'privacy-metadata',
    });
    const references = service.recordInteraction({
      ...common,
      privacyMode: 'temporal-references-only',
      idempotencyKey: 'privacy-references',
    });
    const history = service.recordInteraction({
      ...common,
      privacyMode: 'full-local-history',
      idempotencyKey: 'privacy-history',
      sessionId: 'privacy-history-session',
    });

    const metadataRow = storage.getInteraction(metadata.interactionId);
    const referencesRow = storage.getInteraction(references.interactionId);
    const historyRow = storage.getInteraction(history.interactionId);
    expect(metadata.temporalReferences).toEqual([]);
    expect(metadataRow).toMatchObject({ rawText: null, textPreview: null });
    expect(metadataRow?.messageHash).toHaveLength(64);
    expect(references.temporalReferences).toHaveLength(1);
    expect(referencesRow).toMatchObject({ rawText: null, textPreview: null });
    expect(historyRow?.rawText).toBe(common.text);
    expect(historyRow?.textPreview).toBe(common.text);

    expect(
      service.getLastInteraction({ sessionId: 'privacy-history-session', includeRawText: false }),
    ).not.toHaveProperty('rawText');
    expect(
      service.getLastInteraction({ sessionId: 'privacy-history-session', includeRawText: true }),
    ).toHaveProperty('rawText', common.text);
  });

  it('deduplicates keys and orders out-of-order events by occurrence time', () => {
    const { service, storage } = trackedHarness();
    const newer = service.recordInteraction({
      role: 'assistant',
      occurredAt: '2026-07-18T12:00:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      sessionId: 'ordered-session',
      idempotencyKey: 'newer',
    });
    service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-17T12:00:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      sessionId: 'ordered-session',
      idempotencyKey: 'older',
    });
    const duplicate = service.recordInteraction({
      role: 'assistant',
      occurredAt: '2026-07-18T12:00:00Z',
      agent: { name: 'Other input is ignored', platform: 'test' },
      idempotencyKey: 'newer',
    });

    expect(duplicate).toMatchObject({ interactionId: newer.interactionId, duplicate: true });
    expect(storage.tableCounts().interactions).toBe(2);
    expect(storage.tableCounts().agents).toBe(1);
    expect(service.getLastInteraction({})?.interactionId).toBe(newer.interactionId);
  });

  it('isolates agents, projects, and same-named external sessions', () => {
    const { service } = trackedHarness();
    const alphaCodex = service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-16T10:00:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectAlpha, name: 'Alpha' },
      sessionId: 'shared-session-name',
      idempotencyKey: 'alpha-codex',
    });
    const alphaClaude = service.recordInteraction({
      role: 'assistant',
      occurredAt: '2026-07-17T10:00:00Z',
      agent: { name: 'Claude Code', platform: 'claude-code' },
      project: { path: projectAlpha, name: 'Alpha' },
      sessionId: 'shared-session-name',
      idempotencyKey: 'alpha-claude',
    });
    const betaCodex = service.recordInteraction({
      role: 'assistant',
      occurredAt: '2026-07-18T10:00:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectBeta, name: 'Beta' },
      sessionId: 'shared-session-name',
      idempotencyKey: 'beta-codex',
    });

    expect(
      service.getLastInteraction({ agent: { name: 'Codex' }, project: { path: projectAlpha } })
        ?.interactionId,
    ).toBe(alphaCodex.interactionId);
    expect(service.getLastInteraction({ agent: { name: 'Claude Code' } })?.interactionId).toBe(
      alphaClaude.interactionId,
    );
    expect(service.getLastInteraction({ project: { path: projectBeta } })?.interactionId).toBe(
      betaCodex.interactionId,
    );
    expect(() => service.getLastInteraction({ sessionId: 'shared-session-name' })).toThrow(
      'Session identifier is ambiguous',
    );
  });

  it('groups synthetic sessions only within the configured inactivity threshold', () => {
    const { service } = trackedHarness();
    const first = service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-18T10:00:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectAlpha },
      idempotencyKey: 'synthetic-1',
    });
    const nearby = service.recordInteraction({
      role: 'assistant',
      occurredAt: '2026-07-18T10:20:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectAlpha },
      idempotencyKey: 'synthetic-2',
    });
    const later = service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-18T11:00:01Z',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectAlpha },
      idempotencyKey: 'synthetic-3',
    });

    expect(nearby.sessionId).toBe(first.sessionId);
    expect(later.sessionId).not.toBe(first.sessionId);
  });

  it('detects a timezone change without rewriting historical context', () => {
    const { service } = trackedHarness();
    service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-18T09:00:00-04:00',
      timezone: 'America/New_York',
      agent: { name: 'Codex', platform: 'codex' },
      idempotencyKey: 'timezone-change',
      text: 'Continue tomorrow.',
    });
    service.recordInteraction({
      role: 'system',
      occurredAt: '2026-07-19T12:59:00Z',
      timezone: 'Asia/Bangkok',
      agent: { name: 'Codex', platform: 'codex' },
      idempotencyKey: 'timezone-lifecycle',
    });

    const context = service.getTemporalContext({});
    expect(context.timezoneChange).toEqual({
      changed: true,
      previousTimezone: 'America/New_York',
      currentTimezone: 'Asia/Bangkok',
    });
    expect(
      service.storage.getTemporalReferences(context.lastInteraction?.interactionId as string)[0],
    ).toMatchObject({ anchorTimezone: 'America/New_York' });
  });

  it.each(['user', 'assistant'] as const)(
    'uses the latest %s conversation for temporal context while retaining generic lifecycle history',
    (role) => {
      const { service } = trackedHarness();
      const conversation = service.recordInteraction({
        role,
        occurredAt: '2026-07-18T12:00:00Z',
        timezone: 'Asia/Bangkok',
        agent: { name: 'Codex', platform: 'codex' },
        project: { path: projectAlpha },
        sessionId: `conversation-${role}`,
        idempotencyKey: `conversation-${role}`,
      });
      const lifecycle = service.recordInteraction({
        role: 'system',
        occurredAt: '2026-07-19T12:59:54Z',
        timezone: 'Asia/Bangkok',
        agent: { name: 'Codex', platform: 'codex' },
        project: { path: projectAlpha },
        sessionId: `lifecycle-${role}`,
        idempotencyKey: `lifecycle-${role}`,
      });
      const operational = service.recordInteraction({
        role: 'tool',
        occurredAt: '2026-07-19T12:59:55Z',
        timezone: 'Asia/Bangkok',
        agent: { name: 'Codex', platform: 'codex' },
        project: { path: projectAlpha },
        sessionId: `lifecycle-${role}`,
        idempotencyKey: `operational-${role}`,
      });

      expect(service.getLastInteraction({ project: { path: projectAlpha } })?.interactionId).toBe(
        operational.interactionId,
      );
      expect(lifecycle.interactionId).not.toBe(operational.interactionId);
      expect(service.getTemporalContext({ project: { path: projectAlpha } })).toMatchObject({
        lastInteraction: { interactionId: conversation.interactionId, role },
        elapsed: { totalMilliseconds: 90_000_000, calendarDayDifference: 1 },
        resumedSession: true,
      });
    },
  );

  it('scopes conversational context by agent, project, and session and returns null when none matches', () => {
    const { service } = trackedHarness();
    const selected = service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-18T10:00:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectAlpha },
      sessionId: 'selected-session',
      idempotencyKey: 'selected-newer',
    });
    service.recordInteraction({
      role: 'assistant',
      occurredAt: '2026-07-17T10:00:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectAlpha },
      sessionId: 'selected-session',
      idempotencyKey: 'selected-older-out-of-order',
    });
    service.recordInteraction({
      role: 'assistant',
      occurredAt: '2026-07-19T12:00:00Z',
      agent: { name: 'Claude Code', platform: 'claude-code' },
      project: { path: projectAlpha },
      sessionId: 'other-agent-session',
      idempotencyKey: 'other-agent',
    });
    service.recordInteraction({
      role: 'assistant',
      occurredAt: '2026-07-19T12:30:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectBeta },
      sessionId: 'other-project-session',
      idempotencyKey: 'other-project',
    });
    service.recordInteraction({
      role: 'system',
      occurredAt: '2026-07-19T12:59:00Z',
      agent: { name: 'Lifecycle only', platform: 'test' },
      sessionId: 'lifecycle-only-session',
      idempotencyKey: 'lifecycle-only',
    });

    const selectors = {
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectAlpha },
      sessionId: 'selected-session',
    };
    expect(service.getTemporalContext(selectors).lastInteraction?.interactionId).toBe(selected.interactionId);
    expect(
      service.getTemporalContext({ agent: { name: 'Claude Code', platform: 'claude-code' } }).lastInteraction
        ?.role,
    ).toBe('assistant');
    expect(service.getTemporalContext({ project: { path: projectBeta } }).lastInteraction?.role).toBe(
      'assistant',
    );
    expect(service.getTemporalContext({ agent: { name: 'Lifecycle only', platform: 'test' } })).toMatchObject(
      { lastInteraction: null, elapsed: null, resumedSession: false },
    );
    expect(service.getTemporalContext({ agent: { name: 'Missing', platform: 'test' } })).toMatchObject({
      lastInteraction: null,
      elapsed: null,
      resumedSession: false,
    });
  });

  it('does not classify a future-dated last interaction as a resumed session', () => {
    const { service } = trackedHarness();
    service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-20T13:00:00Z',
      agent: { name: 'Codex', platform: 'codex' },
      idempotencyKey: 'future-event',
    });

    const context = service.getTemporalContext({});
    expect(context.elapsed?.totalMilliseconds).toBe(-86_400_000);
    expect(context.resumedSession).toBe(false);
  });
});

describe('TemporalThreadService commitment and data lifecycle', () => {
  it('completes, cancels, and reschedules commitments', () => {
    const { service } = trackedHarness();
    const completed = service.recordCommitment({
      title: 'Complete me',
      originalExpression: 'tomorrow',
      anchorTime: '2026-07-20T12:00:00Z',
      timezone: 'UTC',
    });
    const cancelled = service.recordCommitment({
      title: 'Cancel me',
      anchorTime: '2026-07-20T12:00:00Z',
      timezone: 'UTC',
    });
    const rescheduled = service.recordCommitment({
      title: 'Move me',
      originalExpression: 'tomorrow',
      anchorTime: '2026-07-20T12:00:00Z',
      timezone: 'UTC',
    });

    expect(
      service.updateCommitment({ commitmentId: completed.commitment.id, status: 'completed' }),
    ).toMatchObject({ action: 'completed', commitment: { displayStatus: 'completed' } });
    expect(
      service.updateCommitment({ commitmentId: cancelled.commitment.id, status: 'cancelled' }),
    ).toMatchObject({ action: 'cancelled', commitment: { displayStatus: 'cancelled' } });
    const moved = service.updateCommitment({
      commitmentId: rescheduled.commitment.id,
      status: 'rescheduled',
      newDueExpression: 'next week',
      anchorTime: '2026-07-20T12:00:00Z',
      timezone: 'UTC',
    });
    expect(moved).toMatchObject({
      action: 'rescheduled',
      commitment: { status: 'pending', dueStartUtc: '2026-07-27T00:00:00Z' },
      resolution: { normalizedExpression: 'next week' },
    });
  });

  it('treats equality with an exact due instant as due, not overdue', () => {
    const { service } = trackedHarness();
    const recorded = service.recordCommitment({
      title: 'Due now',
      originalExpression: 'in two hours',
      anchorTime: '2026-07-19T11:00:00Z',
      timezone: 'UTC',
    });

    expect(recorded.commitment).toMatchObject({
      displayStatus: 'due',
      overdueCalendarDays: 0,
    });
  });

  it('applies commitment status filtering before the requested limit', () => {
    const { service } = trackedHarness();
    service.recordCommitment({
      title: 'Earlier pending item',
      originalExpression: 'tomorrow',
      anchorTime: '2026-07-19T13:00:00Z',
      timezone: 'UTC',
    });
    const completed = service.recordCommitment({
      title: 'Completed item without a due date',
      anchorTime: '2026-07-19T13:00:00Z',
      timezone: 'UTC',
    });
    service.updateCommitment({ commitmentId: completed.commitment.id, status: 'completed' });

    expect(service.listCommitments({ status: 'completed', limit: 1 }).commitments).toEqual([
      expect.objectContaining({ id: completed.commitment.id, displayStatus: 'completed' }),
    ]);
  });

  it('exports only the persisted privacy representation and purges all domain data', () => {
    const { service, storage } = trackedHarness();
    service.recordInteraction({
      role: 'user',
      agent: { name: 'Codex', platform: 'codex' },
      text: 'Private prose about tomorrow.',
      idempotencyKey: 'export-event',
    });
    service.recordCommitment({
      title: 'Follow up',
      anchorTime: '2026-07-19T13:00:00Z',
      timezone: 'UTC',
    });

    const exported = service.exportData();
    expect(exported.interactions).toHaveLength(1);
    expect(exported.interactions[0]).toMatchObject({ rawText: null, textPreview: null });
    expect(exported.temporalReferences[0]?.originalExpression).toBe('tomorrow');
    expect(exported.commitments).toHaveLength(1);

    const purged = service.purgeData();
    expect(purged.deleted).toMatchObject({ interactions: 1, commitments: 1 });
    expect(storage.tableCounts()).toEqual({
      agents: 0,
      projects: 0,
      sessions: 0,
      interactions: 0,
      temporalReferences: 0,
      commitments: 0,
    });
  });

  it('rejects byte limits before creating database records', () => {
    const { service, storage } = trackedHarness({ maxTextBytes: 4 });

    expect(() =>
      service.recordInteraction({
        role: 'user',
        agent: { name: 'Codex', platform: 'codex' },
        text: '💥💥',
      }),
    ).toThrow('4-byte limit');
    expect(storage.tableCounts().interactions).toBe(0);
  });
});
