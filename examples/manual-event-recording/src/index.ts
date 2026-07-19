import { loadConfig, resolveTemporalThreadPaths } from '@temporalthread/config';
import { SystemClock, TemporalThreadService } from '@temporalthread/core';
import type { GetTemporalContextInput, RecordInteractionInput } from '@temporalthread/shared-types';
import { SqliteStorage } from '@temporalthread/storage-sqlite';

interface TemporalThreadAdapter {
  recordInteraction(event: RecordInteractionInput): Promise<unknown>;
  getTemporalContext(query?: GetTemporalContextInput): Promise<unknown>;
}

class EmbeddedAdapter implements TemporalThreadAdapter {
  readonly #storage: SqliteStorage;
  readonly #service: TemporalThreadService;

  constructor() {
    const paths = resolveTemporalThreadPaths();
    const config = loadConfig(paths);
    this.#storage = new SqliteStorage(config.databasePath);
    this.#service = new TemporalThreadService({ storage: this.#storage, config, clock: new SystemClock() });
  }

  async recordInteraction(event: RecordInteractionInput): Promise<unknown> {
    return this.#service.recordInteraction(event);
  }

  async getTemporalContext(query: GetTemporalContextInput = {}): Promise<unknown> {
    return this.#service.getTemporalContext(query);
  }

  close(): void {
    this.#storage.close();
  }
}

const adapter = new EmbeddedAdapter();
try {
  const sessionId = process.env.AGENT_SESSION_ID ?? 'manual-example-session';
  await adapter.recordInteraction({
    role: 'user',
    occurredAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    agent: { name: 'Custom local agent', platform: 'generic' },
    project: { path: process.cwd() },
    sessionId,
    text: process.argv.slice(2).join(' ') || 'Continue this tomorrow.',
    idempotencyKey: `${sessionId}:user:1`,
  });
  const context = await adapter.getTemporalContext({ sessionId, includeCommitments: true });
  process.stdout.write(`${JSON.stringify(context, null, 2)}\n`);
} finally {
  adapter.close();
}
