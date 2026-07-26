import { applyCommitmentTransition } from '@temporalthread/core';
import type { Commitment, TemporalResolution } from '@temporalthread/shared-types';
import { describe, expect, it } from 'vitest';

const createdAt = '2026-07-20T00:00:00Z';
const now = '2026-07-26T12:00:00Z';

function commitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: '01K123456789ABCDEFGHJKMNPQ',
    sourceInteractionId: null,
    projectId: null,
    sessionId: null,
    title: 'Follow up',
    originalText: 'tomorrow',
    dueStartUtc: '2026-07-21T00:00:00Z',
    dueEndUtc: '2026-07-21T23:59:59Z',
    timezone: 'UTC',
    status: 'pending',
    completedAt: null,
    cancelledAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

const resolution: TemporalResolution = {
  originalExpression: 'next Friday',
  normalizedExpression: 'next friday',
  referenceType: 'relative',
  anchorTimeUtc: now,
  anchorTimezone: 'Asia/Bangkok',
  resolvedStartUtc: '2026-07-30T17:00:00Z',
  resolvedEndUtc: '2026-07-31T16:59:59.999999999Z',
  resolutionType: 'range',
  confidence: 1,
  explanation: 'Resolved next Friday in the supplied timezone.',
  ambiguity: null,
  parserVersion: '1',
};

describe('applyCommitmentTransition', () => {
  it('completes a pending commitment', () => {
    const result = applyCommitmentTransition({ existing: commitment(), action: 'completed', now });

    expect(result.changed).toBe(true);
    expect(result.commitment).toMatchObject({
      status: 'completed',
      completedAt: now,
      cancelledAt: null,
      updatedAt: now,
    });
  });

  it('allows an explicit historical completion timestamp', () => {
    const completedAt = '2026-07-19T23:59:59Z';
    const result = applyCommitmentTransition({
      existing: commitment(),
      action: 'completed',
      now,
      completedAt,
    });

    expect(result.commitment.completedAt).toBe(completedAt);
  });

  it('treats repeated completion as idempotent', () => {
    const existing = commitment({ status: 'completed', completedAt: now, updatedAt: now });
    const result = applyCommitmentTransition({ existing, action: 'completed', now: '2026-07-27T00:00:00Z' });

    expect(result).toEqual({ commitment: existing, changed: false });
  });

  it('rejects rewriting a completion timestamp', () => {
    const existing = commitment({ status: 'completed', completedAt: now, updatedAt: now });

    expect(() =>
      applyCommitmentTransition({
        existing,
        action: 'completed',
        now: '2026-07-27T00:00:00Z',
        completedAt: '2026-07-26T13:00:00Z',
      }),
    ).toThrow('completedAt cannot be rewritten');
  });

  it('cancels a pending commitment and treats repeated cancellation as idempotent', () => {
    const first = applyCommitmentTransition({ existing: commitment(), action: 'cancelled', now });
    expect(first.commitment).toMatchObject({ status: 'cancelled', cancelledAt: now, completedAt: null });

    const second = applyCommitmentTransition({
      existing: first.commitment,
      action: 'cancelled',
      now: '2026-07-27T00:00:00Z',
    });
    expect(second).toEqual({ commitment: first.commitment, changed: false });
  });

  it('requires reopening before crossing between terminal states', () => {
    expect(() =>
      applyCommitmentTransition({
        existing: commitment({ status: 'cancelled', cancelledAt: now, updatedAt: now }),
        action: 'completed',
        now,
      }),
    ).toThrow('reopen a cancelled commitment');

    expect(() =>
      applyCommitmentTransition({
        existing: commitment({ status: 'completed', completedAt: now, updatedAt: now }),
        action: 'cancelled',
        now,
      }),
    ).toThrow('reopen a completed commitment');
  });

  it('reopens completed and cancelled commitments to pending', () => {
    for (const existing of [
      commitment({ status: 'completed', completedAt: now, updatedAt: now }),
      commitment({ status: 'cancelled', cancelledAt: now, updatedAt: now }),
    ]) {
      const result = applyCommitmentTransition({
        existing,
        action: 'pending',
        now: '2026-07-27T00:00:00Z',
      });
      expect(result.commitment).toMatchObject({
        status: 'pending',
        completedAt: null,
        cancelledAt: null,
      });
    }
  });

  it('treats reopening an already pending commitment as idempotent', () => {
    const existing = commitment();
    expect(applyCommitmentTransition({ existing, action: 'pending', now })).toEqual({
      commitment: existing,
      changed: false,
    });
  });

  it('reschedules from any valid lifecycle state and clears terminal timestamps', () => {
    for (const existing of [
      commitment(),
      commitment({ status: 'completed', completedAt: now, updatedAt: now }),
      commitment({ status: 'cancelled', cancelledAt: now, updatedAt: now }),
    ]) {
      const result = applyCommitmentTransition({
        existing,
        action: 'rescheduled',
        now: '2026-07-27T00:00:00Z',
        resolution,
        timezone: 'Asia/Bangkok',
        newDueExpression: 'next Friday',
      });
      expect(result.commitment).toMatchObject({
        status: 'pending',
        completedAt: null,
        cancelledAt: null,
        dueStartUtc: resolution.resolvedStartUtc,
        dueEndUtc: resolution.resolvedEndUtc,
        timezone: 'Asia/Bangkok',
        originalText: 'next Friday',
      });
    }
  });

  it('preserves privacy when rescheduling a commitment without stored original text', () => {
    const result = applyCommitmentTransition({
      existing: commitment({ originalText: null }),
      action: 'rescheduled',
      now,
      resolution,
      timezone: 'Asia/Bangkok',
      newDueExpression: 'next Friday',
    });

    expect(result.commitment.originalText).toBeNull();
  });

  it('rejects inconsistent stored lifecycle timestamps', () => {
    expect(() =>
      applyCommitmentTransition({
        existing: commitment({ status: 'pending', completedAt: now }),
        action: 'pending',
        now,
      }),
    ).toThrow('pending commitment has a terminal timestamp');
  });
});
