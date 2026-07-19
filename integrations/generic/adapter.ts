export type GenericInteractionEvent = {
  eventType?: 'interaction';
  role: 'user' | 'assistant' | 'system' | 'tool';
  occurredAt?: string;
  timezone?: string;
  agent: { name: string; platform: string; version?: string };
  project?: { path: string; name?: string; repositoryRemote?: string };
  sessionId?: string;
  text?: string;
  idempotencyKey?: string;
  privacyMode?: 'metadata-only' | 'temporal-references-only' | 'full-local-history';
};

export type GenericContextQuery = {
  agent?: { name?: string; platform?: string };
  project?: { path?: string; name?: string };
  sessionId?: string;
  includeCommitments?: boolean;
  maximumCommitments?: number;
};

export interface TemporalThreadAdapter {
  recordInteraction(event: GenericInteractionEvent): Promise<unknown>;
  getTemporalContext(query?: GenericContextQuery): Promise<unknown>;
}
