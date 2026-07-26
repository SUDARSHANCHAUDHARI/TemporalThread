import type {
  Commitment,
  CommitmentStatus,
  CommitmentUpdateAction,
  TemporalResolution,
} from '@temporalthread/shared-types';

export interface CommitmentTransitionInput {
  existing: Commitment;
  action: CommitmentUpdateAction;
  now: string;
  completedAt?: string;
  resolution?: TemporalResolution | null;
  timezone?: string;
  newDueExpression?: string;
}

export interface CommitmentTransitionResult {
  commitment: Commitment;
  changed: boolean;
}

const persistedStatuses = new Set<CommitmentStatus>(['pending', 'completed', 'cancelled']);

function sameCommitment(left: Commitment, right: Commitment): boolean {
  return (
    left.status === right.status &&
    left.completedAt === right.completedAt &&
    left.cancelledAt === right.cancelledAt &&
    left.dueStartUtc === right.dueStartUtc &&
    left.dueEndUtc === right.dueEndUtc &&
    left.timezone === right.timezone &&
    left.originalText === right.originalText
  );
}

function validateStoredCommitment(commitment: Commitment): void {
  if (!persistedStatuses.has(commitment.status)) {
    throw new Error(`Invalid commitment transition: unsupported stored status ${commitment.status}`);
  }
  if (commitment.status === 'pending' && (commitment.completedAt || commitment.cancelledAt)) {
    throw new Error('Invalid commitment transition: pending commitment has a terminal timestamp');
  }
  if (commitment.status === 'completed' && (!commitment.completedAt || commitment.cancelledAt)) {
    throw new Error('Invalid commitment transition: completed commitment timestamps are inconsistent');
  }
  if (commitment.status === 'cancelled' && (!commitment.cancelledAt || commitment.completedAt)) {
    throw new Error('Invalid commitment transition: cancelled commitment timestamps are inconsistent');
  }
}

export function applyCommitmentTransition(input: CommitmentTransitionInput): CommitmentTransitionResult {
  const { existing, action, now } = input;
  validateStoredCommitment(existing);

  let next: Commitment;

  if (action === 'rescheduled') {
    if (!input.resolution || !input.timezone || !input.newDueExpression) {
      throw new Error('Invalid commitment transition: rescheduling requires a resolution and timezone');
    }
    next = {
      ...existing,
      dueStartUtc: input.resolution.resolvedStartUtc,
      dueEndUtc: input.resolution.resolvedEndUtc,
      timezone: input.timezone,
      status: 'pending',
      completedAt: null,
      cancelledAt: null,
      originalText: existing.originalText === null ? null : input.newDueExpression,
      updatedAt: now,
    };
  } else if (action === 'pending') {
    next = {
      ...existing,
      status: 'pending',
      completedAt: null,
      cancelledAt: null,
      updatedAt: now,
    };
  } else if (action === 'completed') {
    if (existing.status === 'cancelled') {
      throw new Error('Invalid commitment transition: reopen a cancelled commitment before completing it');
    }
    const completedAt = input.completedAt ?? now;
    if (existing.status === 'completed') {
      if (input.completedAt && input.completedAt !== existing.completedAt) {
        throw new Error('Invalid commitment transition: completedAt cannot be rewritten');
      }
      return { commitment: existing, changed: false };
    }
    next = {
      ...existing,
      status: 'completed',
      completedAt,
      cancelledAt: null,
      updatedAt: now,
    };
  } else {
    if (existing.status === 'completed') {
      throw new Error('Invalid commitment transition: reopen a completed commitment before cancelling it');
    }
    if (existing.status === 'cancelled') {
      return { commitment: existing, changed: false };
    }
    next = {
      ...existing,
      status: 'cancelled',
      completedAt: null,
      cancelledAt: now,
      updatedAt: now,
    };
  }

  if (sameCommitment(existing, next)) return { commitment: existing, changed: false };
  return { commitment: next, changed: true };
}
