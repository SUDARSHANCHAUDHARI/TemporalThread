import { UpdateCommitmentInputSchema } from '@temporalthread/shared-types';
import { describe, expect, it } from 'vitest';

const commitmentId = '01K123456789ABCDEFGHJKMNPQ';

describe('UpdateCommitmentInputSchema', () => {
  it('accepts completion with an optional completion timestamp', () => {
    expect(
      UpdateCommitmentInputSchema.safeParse({
        commitmentId,
        status: 'completed',
        completedAt: '2026-07-26T12:00:00Z',
      }).success,
    ).toBe(true);

    expect(
      UpdateCommitmentInputSchema.safeParse({
        commitmentId,
        status: 'completed',
      }).success,
    ).toBe(true);
  });

  it('accepts a complete reschedule action', () => {
    expect(
      UpdateCommitmentInputSchema.safeParse({
        commitmentId,
        status: 'rescheduled',
        newDueExpression: 'tomorrow morning',
        anchorTime: '2026-07-26T12:00:00Z',
        timezone: 'Asia/Bangkok',
      }).success,
    ).toBe(true);
  });

  it('requires every reschedule field', () => {
    const result = UpdateCommitmentInputSchema.safeParse({
      commitmentId,
      status: 'rescheduled',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
      'newDueExpression',
      'anchorTime',
      'timezone',
    ]);
  });

  it('rejects reschedule-only fields for non-reschedule actions', () => {
    const result = UpdateCommitmentInputSchema.safeParse({
      commitmentId,
      status: 'pending',
      newDueExpression: 'next Friday',
      anchorTime: '2026-07-26T12:00:00Z',
      timezone: 'Asia/Bangkok',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
      'newDueExpression',
      'anchorTime',
      'timezone',
    ]);
  });

  it.each(['pending', 'cancelled', 'rescheduled'] as const)(
    'rejects completedAt when status is %s',
    (status) => {
      const result = UpdateCommitmentInputSchema.safeParse({
        commitmentId,
        status,
        completedAt: '2026-07-26T12:00:00Z',
        ...(status === 'rescheduled'
          ? {
              newDueExpression: 'tomorrow',
              anchorTime: '2026-07-26T12:00:00Z',
              timezone: 'Asia/Bangkok',
            }
          : {}),
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((issue) => issue.path[0] === 'completedAt')).toBe(true);
    },
  );
});
