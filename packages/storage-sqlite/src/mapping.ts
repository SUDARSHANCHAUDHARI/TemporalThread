import type {
  Agent,
  Commitment,
  Interaction,
  Project,
  Session,
  TemporalReference,
} from '@temporalthread/shared-types';

export type SqlRow = Record<string, unknown>;

const text = (row: SqlRow, key: string): string => String(row[key]);
const nullableText = (row: SqlRow, key: string): string | null =>
  row[key] === null || row[key] === undefined ? null : String(row[key]);

export function mapAgent(row: SqlRow): Agent {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    platform: text(row, 'platform'),
    version: nullableText(row, 'version'),
    createdAt: text(row, 'created_at'),
    lastSeenAt: text(row, 'last_seen_at'),
  };
}

export function mapProject(row: SqlRow): Project {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    normalizedPath: text(row, 'normalized_path'),
    repositoryRemote: nullableText(row, 'repository_remote'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export function mapSession(row: SqlRow): Session {
  return {
    id: text(row, 'id'),
    externalSessionId: nullableText(row, 'external_session_id'),
    agentId: text(row, 'agent_id'),
    projectId: nullableText(row, 'project_id'),
    startedAt: text(row, 'started_at'),
    endedAt: nullableText(row, 'ended_at'),
    lastInteractionAt: text(row, 'last_interaction_at'),
    generatedSession: Number(row.generated_session) === 1,
    metadata: JSON.parse(text(row, 'metadata_json')) as Record<string, unknown>,
  };
}

export function mapInteraction(row: SqlRow): Interaction {
  return {
    id: text(row, 'id'),
    idempotencyKey: text(row, 'idempotency_key'),
    sessionId: text(row, 'session_id'),
    agentId: text(row, 'agent_id'),
    projectId: nullableText(row, 'project_id'),
    role: text(row, 'role') as Interaction['role'],
    occurredAtUtc: text(row, 'occurred_at_utc'),
    timezone: text(row, 'timezone'),
    utcOffsetMinutes: Number(row.utc_offset_minutes),
    messageHash: nullableText(row, 'message_hash'),
    textPreview: nullableText(row, 'text_preview'),
    rawText: nullableText(row, 'raw_text'),
    privacyMode: text(row, 'privacy_mode') as Interaction['privacyMode'],
    createdAt: text(row, 'created_at'),
  };
}

export function mapTemporalReference(row: SqlRow): TemporalReference {
  return {
    id: text(row, 'id'),
    interactionId: text(row, 'interaction_id'),
    originalExpression: text(row, 'original_expression'),
    normalizedExpression: text(row, 'normalized_expression'),
    referenceType: text(row, 'reference_type') as TemporalReference['referenceType'],
    anchorTimeUtc: text(row, 'anchor_time_utc'),
    anchorTimezone: text(row, 'anchor_timezone'),
    resolvedStartUtc: nullableText(row, 'resolved_start_utc'),
    resolvedEndUtc: nullableText(row, 'resolved_end_utc'),
    resolutionType: text(row, 'resolution_type') as TemporalReference['resolutionType'],
    confidence: Number(row.confidence),
    parserVersion: text(row, 'parser_version'),
    explanation: text(row, 'explanation'),
    ambiguity: nullableText(row, 'ambiguity'),
    createdAt: text(row, 'created_at'),
  };
}

export function mapCommitment(row: SqlRow): Commitment {
  return {
    id: text(row, 'id'),
    sourceInteractionId: nullableText(row, 'source_interaction_id'),
    projectId: nullableText(row, 'project_id'),
    sessionId: nullableText(row, 'session_id'),
    title: text(row, 'title'),
    originalText: nullableText(row, 'original_text'),
    dueStartUtc: nullableText(row, 'due_start_utc'),
    dueEndUtc: nullableText(row, 'due_end_utc'),
    timezone: text(row, 'timezone'),
    status: text(row, 'status') as Commitment['status'],
    completedAt: nullableText(row, 'completed_at'),
    cancelledAt: nullableText(row, 'cancelled_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}
