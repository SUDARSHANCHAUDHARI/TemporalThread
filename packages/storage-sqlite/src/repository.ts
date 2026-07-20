import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  Agent,
  AgentSelector,
  Commitment,
  ExportBundle,
  Interaction,
  InteractionRole,
  InteractionWithRelations,
  Project,
  ProjectSelector,
  PurgeResult,
  Session,
  TemporalReference,
} from '@temporalthread/shared-types';
import Database from 'better-sqlite3';
import {
  mapAgent,
  mapCommitment,
  mapInteraction,
  mapProject,
  mapSession,
  mapTemporalReference,
  type SqlRow,
} from './mapping.js';
import { latestMigrationVersion, migrate } from './migrations.js';

export interface InteractionFilters {
  agentId?: string;
  projectId?: string | null;
  sessionId?: string;
  role?: InteractionRole;
}

export interface CommitmentFilters {
  projectId?: string | null;
  dueBefore?: string;
  dueAfter?: string;
}

export interface NewSession {
  id: string;
  externalSessionId: string | null;
  agentId: string;
  projectId: string | null;
  occurredAt: string;
  generated: boolean;
  metadata: Record<string, unknown>;
}

export interface NewInteractionBundle {
  interaction: Interaction;
  temporalReferences: TemporalReference[];
}

export class SqliteStorage {
  readonly database: Database.Database;
  readonly databasePath: string;

  constructor(databasePath: string) {
    this.databasePath = databasePath;
    if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });

    try {
      this.database = new Database(databasePath, { timeout: 5_000 });
      this.database.pragma('foreign_keys = ON');
      this.database.pragma('busy_timeout = 5000');
      this.database.pragma('synchronous = NORMAL');
      if (databasePath !== ':memory:') this.database.pragma('journal_mode = WAL');
      migrate(this.database);
      if (databasePath !== ':memory:' && existsSync(databasePath)) chmodSync(databasePath, 0o600);
    } catch (error) {
      throw new Error('Unable to open or migrate the TemporalThread database', { cause: error });
    }
  }

  close(): void {
    if (this.database.open) this.database.close();
  }

  getMigrationVersion(): number {
    const row = this.database.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as {
      version: number | null;
    };
    return row.version ?? 0;
  }

  getLatestMigrationVersion(): number {
    return latestMigrationVersion;
  }

  integrityCheck(): string {
    const row = this.database.pragma('integrity_check', { simple: true });
    return String(row);
  }

  upsertAgent(input: {
    id: string;
    name: string;
    platform: string;
    version: string | null;
    seenAt: string;
  }): Agent {
    this.database
      .prepare(
        `INSERT INTO agents (id, name, platform, version, created_at, last_seen_at)
         VALUES (@id, @name, @platform, @version, @seenAt, @seenAt)
         ON CONFLICT(name, platform) DO UPDATE SET
           version = COALESCE(excluded.version, agents.version),
           last_seen_at = MAX(agents.last_seen_at, excluded.last_seen_at)`,
      )
      .run(input);
    const row = this.database
      .prepare('SELECT * FROM agents WHERE name = ? AND platform = ?')
      .get(input.name, input.platform) as SqlRow;
    return mapAgent(row);
  }

  findAgent(selector: AgentSelector): Agent | null {
    const row = selector.platform
      ? this.database
          .prepare('SELECT * FROM agents WHERE name = ? AND platform = ? ORDER BY last_seen_at DESC LIMIT 1')
          .get(selector.name, selector.platform)
      : this.database
          .prepare('SELECT * FROM agents WHERE name = ? ORDER BY last_seen_at DESC LIMIT 1')
          .get(selector.name);
    return row ? mapAgent(row as SqlRow) : null;
  }

  upsertProject(input: {
    id: string;
    name: string;
    normalizedPath: string;
    repositoryRemote: string | null;
    seenAt: string;
  }): Project {
    this.database
      .prepare(
        `INSERT INTO projects (id, name, normalized_path, repository_remote, created_at, updated_at)
         VALUES (@id, @name, @normalizedPath, @repositoryRemote, @seenAt, @seenAt)
         ON CONFLICT(normalized_path) DO UPDATE SET
           name = excluded.name,
           repository_remote = COALESCE(excluded.repository_remote, projects.repository_remote),
           updated_at = MAX(projects.updated_at, excluded.updated_at)`,
      )
      .run(input);
    return mapProject(
      this.database
        .prepare('SELECT * FROM projects WHERE normalized_path = ?')
        .get(input.normalizedPath) as SqlRow,
    );
  }

  findProject(selector: ProjectSelector & { normalizedPath?: string }): Project | null {
    const row = selector.normalizedPath
      ? this.database.prepare('SELECT * FROM projects WHERE normalized_path = ?').get(selector.normalizedPath)
      : this.database
          .prepare('SELECT * FROM projects WHERE name = ? ORDER BY updated_at DESC LIMIT 1')
          .get(selector.name);
    return row ? mapProject(row as SqlRow) : null;
  }

  findExternalSession(agentId: string, projectId: string | null, externalSessionId: string): Session | null {
    const row = this.database
      .prepare(
        `SELECT * FROM sessions
         WHERE agent_id = ? AND IFNULL(project_id, '') = IFNULL(?, '') AND external_session_id = ?`,
      )
      .get(agentId, projectId, externalSessionId);
    return row ? mapSession(row as SqlRow) : null;
  }

  findSessionsByExternalId(externalSessionId: string): Session[] {
    return this.database
      .prepare(
        `SELECT * FROM sessions
         WHERE external_session_id = ?
         ORDER BY last_interaction_at DESC, id DESC`,
      )
      .all(externalSessionId)
      .map((row) => mapSession(row as SqlRow));
  }

  findGeneratedSession(
    agentId: string,
    projectId: string | null,
    occurredAt: string,
    earliestAllowed: string,
  ): Session | null {
    const row = this.database
      .prepare(
        `SELECT * FROM sessions
         WHERE agent_id = ?
           AND IFNULL(project_id, '') = IFNULL(?, '')
           AND generated_session = 1
           AND last_interaction_at <= ?
           AND last_interaction_at >= ?
         ORDER BY last_interaction_at DESC
         LIMIT 1`,
      )
      .get(agentId, projectId, occurredAt, earliestAllowed);
    return row ? mapSession(row as SqlRow) : null;
  }

  createSession(input: NewSession): Session {
    this.database
      .prepare(
        `INSERT INTO sessions (
          id, external_session_id, agent_id, project_id, started_at, ended_at,
          last_interaction_at, generated_session, metadata_json
        ) VALUES (@id, @externalSessionId, @agentId, @projectId, @occurredAt, NULL,
          @occurredAt, @generated, @metadataJson)`,
      )
      .run({
        ...input,
        generated: input.generated ? 1 : 0,
        metadataJson: JSON.stringify(input.metadata),
      });
    return mapSession(this.database.prepare('SELECT * FROM sessions WHERE id = ?').get(input.id) as SqlRow);
  }

  touchSession(sessionId: string, occurredAt: string): void {
    this.database
      .prepare(
        `UPDATE sessions SET
          started_at = MIN(started_at, ?),
          last_interaction_at = MAX(last_interaction_at, ?),
          ended_at = CASE
            WHEN ended_at IS NOT NULL AND ended_at <= ? THEN NULL
            ELSE ended_at
          END
         WHERE id = ?`,
      )
      .run(occurredAt, occurredAt, occurredAt, sessionId);
  }

  endSession(sessionId: string, endedAt: string): Session | null {
    const result = this.database
      .prepare(
        `UPDATE sessions SET
          ended_at = MAX(COALESCE(ended_at, @endedAt), last_interaction_at, @endedAt),
          last_interaction_at = MAX(last_interaction_at, @endedAt)
         WHERE id = @sessionId`,
      )
      .run({ sessionId, endedAt });
    return result.changes === 0 ? null : this.getSession(sessionId);
  }

  getSession(sessionId: string): Session | null {
    const row = this.database.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    return row ? mapSession(row as SqlRow) : null;
  }

  getPreviousSession(current: Session): Session | null {
    const row = this.database
      .prepare(
        `SELECT * FROM sessions
         WHERE id <> ?
           AND agent_id = ?
           AND IFNULL(project_id, '') = IFNULL(?, '')
           AND last_interaction_at < ?
         ORDER BY last_interaction_at DESC, id DESC
         LIMIT 1`,
      )
      .get(current.id, current.agentId, current.projectId, current.startedAt);
    return row ? mapSession(row as SqlRow) : null;
  }

  getAgentById(agentId: string): Agent | null {
    const row = this.database.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    return row ? mapAgent(row as SqlRow) : null;
  }

  getProjectById(projectId: string): Project | null {
    const row = this.database.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    return row ? mapProject(row as SqlRow) : null;
  }

  getInteraction(interactionId: string): Interaction | null {
    const row = this.database.prepare('SELECT * FROM interactions WHERE id = ?').get(interactionId);
    return row ? mapInteraction(row as SqlRow) : null;
  }

  getInteractionByIdempotencyKey(idempotencyKey: string): Interaction | null {
    const row = this.database
      .prepare('SELECT * FROM interactions WHERE idempotency_key = ?')
      .get(idempotencyKey);
    return row ? mapInteraction(row as SqlRow) : null;
  }

  insertInteraction(bundle: NewInteractionBundle): { interaction: Interaction; duplicate: boolean } {
    const insert = this.database.transaction(() => {
      const existing = this.getInteractionByIdempotencyKey(bundle.interaction.idempotencyKey);
      if (existing) return { interaction: existing, duplicate: true };

      const interaction = bundle.interaction;
      this.database
        .prepare(
          `INSERT INTO interactions (
            id, idempotency_key, session_id, agent_id, project_id, role, occurred_at_utc,
            timezone, utc_offset_minutes, message_hash, text_preview, raw_text, privacy_mode, created_at
          ) VALUES (
            @id, @idempotencyKey, @sessionId, @agentId, @projectId, @role, @occurredAtUtc,
            @timezone, @utcOffsetMinutes, @messageHash, @textPreview, @rawText, @privacyMode, @createdAt
          )`,
        )
        .run(interaction);

      const referenceStatement = this.database.prepare(
        `INSERT INTO temporal_references (
          id, interaction_id, original_expression, normalized_expression, reference_type,
          anchor_time_utc, anchor_timezone, resolved_start_utc, resolved_end_utc,
          resolution_type, confidence, parser_version, explanation, ambiguity, created_at
        ) VALUES (
          @id, @interactionId, @originalExpression, @normalizedExpression, @referenceType,
          @anchorTimeUtc, @anchorTimezone, @resolvedStartUtc, @resolvedEndUtc,
          @resolutionType, @confidence, @parserVersion, @explanation, @ambiguity, @createdAt
        )`,
      );
      for (const reference of bundle.temporalReferences) referenceStatement.run(reference);
      this.touchSession(interaction.sessionId, interaction.occurredAtUtc);
      return { interaction, duplicate: false };
    });
    return insert();
  }

  getTemporalReferences(interactionId: string): TemporalReference[] {
    return this.database
      .prepare('SELECT * FROM temporal_references WHERE interaction_id = ? ORDER BY created_at, id')
      .all(interactionId)
      .map((row) => mapTemporalReference(row as SqlRow));
  }

  private interactionWhere(
    filters: InteractionFilters,
    tableAlias = '',
  ): {
    clause: string;
    parameters: Array<string | number | null>;
  } {
    const prefix = tableAlias ? `${tableAlias}.` : '';
    const conditions: string[] = [];
    const parameters: Array<string | number | null> = [];
    if (filters.agentId) {
      conditions.push(`${prefix}agent_id = ?`);
      parameters.push(filters.agentId);
    }
    if (Object.hasOwn(filters, 'projectId')) {
      if (filters.projectId === null) conditions.push(`${prefix}project_id IS NULL`);
      else {
        conditions.push(`${prefix}project_id = ?`);
        parameters.push(filters.projectId ?? null);
      }
    }
    if (filters.sessionId) {
      conditions.push(`${prefix}session_id = ?`);
      parameters.push(filters.sessionId);
    }
    if (filters.role) {
      conditions.push(`${prefix}role = ?`);
      parameters.push(filters.role);
    }
    return { clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', parameters };
  }

  getLastInteraction(filters: InteractionFilters = {}): InteractionWithRelations | null {
    const where = this.interactionWhere(filters);
    const row = this.database
      .prepare(
        `SELECT * FROM interactions ${where.clause}
         ORDER BY occurred_at_utc DESC, id DESC LIMIT 1`,
      )
      .get(...where.parameters);
    if (!row) return null;

    const interaction = mapInteraction(row as SqlRow);
    const agent = this.getAgentById(interaction.agentId);
    const project = interaction.projectId ? this.getProjectById(interaction.projectId) : null;
    const session = this.getSession(interaction.sessionId);
    if (!agent || !session) throw new Error('Database relationship integrity failure');
    return { interaction, agent, project, session };
  }

  listInteractions(filters: InteractionFilters = {}, limit = 100): InteractionWithRelations[] {
    const where = this.interactionWhere(filters);
    const rows = this.database
      .prepare(
        `SELECT * FROM interactions ${where.clause}
         ORDER BY occurred_at_utc DESC, id DESC LIMIT ?`,
      )
      .all(...where.parameters, limit);
    return rows.map((row) => {
      const interaction = mapInteraction(row as SqlRow);
      const agent = this.getAgentById(interaction.agentId);
      const project = interaction.projectId ? this.getProjectById(interaction.projectId) : null;
      const session = this.getSession(interaction.sessionId);
      if (!agent || !session) throw new Error('Database relationship integrity failure');
      return { interaction, agent, project, session };
    });
  }

  listUnresolvedTemporalReferences(filters: InteractionFilters = {}, limit = 5): TemporalReference[] {
    const where = this.interactionWhere(filters, 'i');
    const unresolvedCondition = "r.resolution_type IN ('unresolved', 'fuzzy')";
    const clause = where.clause
      ? `${where.clause} AND ${unresolvedCondition}`
      : `WHERE ${unresolvedCondition}`;
    return this.database
      .prepare(
        `SELECT r.* FROM temporal_references r
         INNER JOIN interactions i ON i.id = r.interaction_id
         ${clause}
         ORDER BY i.occurred_at_utc DESC, r.id DESC LIMIT ?`,
      )
      .all(...where.parameters, limit)
      .map((row) => mapTemporalReference(row as SqlRow));
  }

  insertCommitment(commitment: Commitment): Commitment {
    this.database
      .prepare(
        `INSERT INTO commitments (
          id, source_interaction_id, project_id, session_id, title, original_text,
          due_start_utc, due_end_utc, timezone, status, completed_at, cancelled_at,
          created_at, updated_at
        ) VALUES (
          @id, @sourceInteractionId, @projectId, @sessionId, @title, @originalText,
          @dueStartUtc, @dueEndUtc, @timezone, @status, @completedAt, @cancelledAt,
          @createdAt, @updatedAt
        )`,
      )
      .run(commitment);
    return this.getCommitment(commitment.id) as Commitment;
  }

  getCommitment(commitmentId: string): Commitment | null {
    const row = this.database.prepare('SELECT * FROM commitments WHERE id = ?').get(commitmentId);
    return row ? mapCommitment(row as SqlRow) : null;
  }

  updateCommitment(commitment: Commitment): Commitment {
    const result = this.database
      .prepare(
        `UPDATE commitments SET
          source_interaction_id = @sourceInteractionId,
          project_id = @projectId,
          session_id = @sessionId,
          title = @title,
          original_text = @originalText,
          due_start_utc = @dueStartUtc,
          due_end_utc = @dueEndUtc,
          timezone = @timezone,
          status = @status,
          completed_at = @completedAt,
          cancelled_at = @cancelledAt,
          updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run(commitment);
    if (result.changes !== 1) throw new Error('Commitment not found');
    return this.getCommitment(commitment.id) as Commitment;
  }

  listCommitments(filters: CommitmentFilters = {}, limit = 100): Commitment[] {
    const conditions: string[] = [];
    const parameters: Array<string | number | null> = [];
    if (Object.hasOwn(filters, 'projectId')) {
      if (filters.projectId === null) conditions.push('project_id IS NULL');
      else {
        conditions.push('project_id = ?');
        parameters.push(filters.projectId ?? null);
      }
    }
    if (filters.dueBefore) {
      conditions.push('COALESCE(due_start_utc, due_end_utc) <= ?');
      parameters.push(filters.dueBefore);
    }
    if (filters.dueAfter) {
      conditions.push('COALESCE(due_end_utc, due_start_utc) >= ?');
      parameters.push(filters.dueAfter);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.database
      .prepare(
        `SELECT * FROM commitments ${where}
         ORDER BY COALESCE(due_start_utc, '9999-12-31T23:59:59Z'), created_at
         LIMIT ?`,
      )
      .all(...parameters, limit)
      .map((row) => mapCommitment(row as SqlRow));
  }

  exportAll(exportedAt: string): ExportBundle {
    const all = (table: string): SqlRow[] =>
      this.database.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as SqlRow[];
    return {
      exportedAt,
      formatVersion: 1,
      privacyNotice:
        'This export contains only data permitted by the privacy mode used for each interaction.',
      agents: all('agents').map(mapAgent),
      projects: all('projects').map(mapProject),
      sessions: all('sessions').map(mapSession),
      interactions: all('interactions').map(mapInteraction),
      temporalReferences: all('temporal_references').map(mapTemporalReference),
      commitments: all('commitments').map(mapCommitment),
    };
  }

  tableCounts(): PurgeResult['deleted'] {
    const count = (table: string): number =>
      Number(
        (this.database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count,
      );
    return {
      agents: count('agents'),
      projects: count('projects'),
      sessions: count('sessions'),
      interactions: count('interactions'),
      temporalReferences: count('temporal_references'),
      commitments: count('commitments'),
    };
  }

  purgeAll(): PurgeResult {
    const purge = this.database.transaction(() => {
      const deleted = this.tableCounts();
      this.database.exec(`
        DELETE FROM commitments;
        DELETE FROM temporal_references;
        DELETE FROM interactions;
        DELETE FROM sessions;
        DELETE FROM agents;
        DELETE FROM projects;
      `);
      return { deleted };
    });
    return purge();
  }
}
