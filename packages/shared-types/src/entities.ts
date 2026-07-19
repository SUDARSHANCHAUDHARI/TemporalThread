import type {
  CommitmentStatus,
  InteractionRole,
  PrivacyMode,
  ReferenceType,
  ResolutionType,
} from './enums.js';

export interface Agent {
  id: string;
  name: string;
  platform: string;
  version: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface Project {
  id: string;
  name: string;
  normalizedPath: string;
  repositoryRemote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  externalSessionId: string | null;
  agentId: string;
  projectId: string | null;
  startedAt: string;
  endedAt: string | null;
  lastInteractionAt: string;
  generatedSession: boolean;
  metadata: Record<string, unknown>;
}

export interface Interaction {
  id: string;
  idempotencyKey: string;
  sessionId: string;
  agentId: string;
  projectId: string | null;
  role: InteractionRole;
  occurredAtUtc: string;
  timezone: string;
  utcOffsetMinutes: number;
  messageHash: string | null;
  textPreview: string | null;
  rawText: string | null;
  privacyMode: PrivacyMode;
  createdAt: string;
}

export interface TemporalReference {
  id: string;
  interactionId: string;
  originalExpression: string;
  normalizedExpression: string;
  referenceType: ReferenceType;
  anchorTimeUtc: string;
  anchorTimezone: string;
  resolvedStartUtc: string | null;
  resolvedEndUtc: string | null;
  resolutionType: ResolutionType;
  confidence: number;
  parserVersion: string;
  explanation: string;
  ambiguity: string | null;
  createdAt: string;
}

export interface Commitment {
  id: string;
  sourceInteractionId: string | null;
  projectId: string | null;
  sessionId: string | null;
  title: string;
  originalText: string | null;
  dueStartUtc: string | null;
  dueEndUtc: string | null;
  timezone: string;
  status: CommitmentStatus;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSelector {
  name: string;
  platform?: string;
}

export interface ProjectSelector {
  path?: string;
  name?: string;
}

export interface AgentInput extends AgentSelector {
  platform: string;
  version?: string;
}

export interface ProjectInput {
  path: string;
  name?: string;
  repositoryRemote?: string;
}

export interface TemporalResolution {
  originalExpression: string;
  normalizedExpression: string;
  referenceType: ReferenceType;
  anchorTimeUtc: string;
  anchorTimezone: string;
  resolvedStartUtc: string | null;
  resolvedEndUtc: string | null;
  resolutionType: ResolutionType;
  confidence: number;
  explanation: string;
  ambiguity: string | null;
  parserVersion: string;
}
