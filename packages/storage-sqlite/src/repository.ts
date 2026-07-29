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
} from '@sudarshanchaudhari/temporalthread-shared-types';
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

    let opened: Database.Database | undefined;
    try {
      opened = new Database(databasePath, { timeout: 5_000 });
      opened.pragma('foreign_keys = ON');
      opened.pragma('busy_timeout = 5000');
      opened.pragma('synchronous = NORMAL');
      if (databasePath !== ':memory:') opened.pragma('journal_mode = WAL');
      migrate(opened);
      if (databasePath !== ':memory:' && existsSync(databasePath)) chmodSync(databasePath, 0o600);
      this.database = opened;
    } catch (error) {
      if (opened?.open) opened.close();
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
    return mapAgent(
      this.database
        .prepare('SELECT * FROM agents WHERE name = ? AND platform = ?')
        .get(input.name, input.platform) as SqlRow,
    );
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

  createSession(input: NewSession): Session {
    this.database
      .prepare(
        `INSERT INTO sessions (
           id, external_session_id, agent_id, project_id, started_at, ended_at,
           last_interaction_at, generated_session, metadata_json
         ) VALUES (
           @id, @externalSessionId, @agentId, @projectId, @occurredAt, NULL,
           @occurredAt, @generated, @metadataJson
         )`,
      )
      .run({
        ...input,
        generated: input.generated ? 1 : 0,
        metadataJson: JSON.stringify(input.metadata),
      });
    return this.getSession(input.id) as Session;
  }

  getSession(id: string): Session | null {
    const row = this.database.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    return row ? mapSession(row as SqlRow) : null;
  }

  findSessionsByExternalId(externalSessionId: string): Session[] {
    return (
      this.database
        .prepare('SELECT * FROM sessions WHERE external_session_id = ? ORDER BY last_interaction_at DESC')
        .all(externalSessionId) as SqlRow[]
    ).map(mapSession);
  }

  findExternalSession(agentId: string, projectId: string | null, externalSessionId: string): Session | null {
    const row = this.database
      .prepare(
        `SELECT * FROM sessions
         WHERE agent_id = ? AND project_id IS ? AND external_session_id = ?`,
      )
      .get(agentId, projectId, externalSessionId);
    return row ? mapSession(row as SqlRow) : null;
  }

  findGeneratedSession(
    agentId: string,
    projectId: string | null,
    occurredAt: string,
    lowerBound: string,
  ): Session | null {
    const row = this.database
      .prepare(
        `SELECT * FROM sessions
         WHERE agent_id = ?
           AND project_id IS ?
           AND generated_session = 1
           AND ended_at IS NULL
           AND last_interaction_at <= ?
           AND last_interaction_at >= ?
         ORDER BY last_interaction_at DESC
         LIMIT 1`,
      )
      .get(agentId, projectId, occurredAt, lowerBound);
    return row ? mapSession(row as SqlRow) : null;
  }

  updateSessionLastInteraction(sessionId: string, occurredAt: string): void {
    this.database
      .prepare(
        `UPDATE sessions
         SET started_at = MIN(started_at, ?),
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
    this.database
      .prepare(
        `UPDATE sessions
         SET ended_at = CASE
           WHEN ended_at IS NULL THEN MAX(last_interaction_at, ?)
           ELSE MAX(ended_at, last_interaction_at, ?)
         END
         WHERE id = ?`,
      )
      .run(endedAt, endedAt, sessionId);
    return this.getSession(sessionId);
  }

  insertInteraction(bundle: NewInteractionBundle): {
    interaction: Interaction;
    duplicate: boolean;
  } {
    const transaction = this.database.transaction((value: NewInteractionBundle) => {
      const existing = this.getInteractionByIdempotencyKey(value.interaction.idempotencyKey);
      if (existing) return { interaction: existing, duplicate: true };
      const interaction = value.interaction;
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
      for (const reference of value.temporalReferences) referenceStatement.run(reference);
      this.updateSessionLastInteraction(interaction.sessionId, interaction.occurredAtUtc);
      return { interaction, duplicate: false };
    });
    return transaction(bundle);
  }

  getInteraction(id: string): Interaction | null {
    const row = this.database.prepare('SELECT * FROM interactions WHERE id = ?').get(id);
    return row ? mapInteraction(row as SqlRow) : null;
  }

  getInteractionByIdempotencyKey(idempotencyKey: string): Interaction | null {
    const row = this.database
      .prepare('SELECT * FROM interactions WHERE idempotency_key = ?')
      .get(idempotencyKey);
    return row ? mapInteraction(row as SqlRow) : null;
  }

  getTemporalReferences(interactionId: string): TemporalReference[] {
    return (
      this.database
        .prepare('SELECT * FROM temporal_references WHERE interaction_id = ? ORDER BY created_at')
        .all(interactionId) as SqlRow[]
    ).map(mapTemporalReference);
  }

  getLastInteraction(filters: InteractionFilters = {}): InteractionWithRelations | null {
    const clauses: string[] = [];
    const parameters: unknown[] = [];
    this.addInteractionFilterClauses(filters, clauses, parameters);
    const row = this.database
      .prepare(
        `${this.interactionJoinSql()}
         ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
         ORDER BY i.occurred_at_utc DESC, i.id DESC
         LIMIT 1`,
      )
      .get(...parameters);
    return row ? this.mapInteractionWithRelations(row as SqlRow) : null;
  }

  getLastConversationalInteraction(filters: InteractionFilters): InteractionWithRelations | null {
    const clauses = ["i.role IN ('user', 'assistant')"];
    const parameters: unknown[] = [];
    this.addInteractionFilterClauses(filters, clauses, parameters);
    const row = this.database
      .prepare(
        `${this.interactionJoinSql()}
         WHERE ${clauses.join(' AND ')}
         ORDER BY i.occurred_at_utc DESC, i.id DESC
         LIMIT 1`,
      )
      .get(...parameters);
    return row ? this.mapInteractionWithRelations(row as SqlRow) : null;
  }

  listInteractions(filters: InteractionFilters = {}, limit = 100): InteractionWithRelations[] {
    const clauses: string[] = [];
    const parameters: unknown[] = [];
    this.addInteractionFilterClauses(filters, clauses, parameters);
    parameters.push(limit);
    const rows = this.database
      .prepare(
        `${this.interactionJoinSql()}
         ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
         ORDER BY i.occurred_at_utc DESC, i.id DESC
         LIMIT ?`,
      )
      .all(...parameters) as SqlRow[];
    return rows.map((row) => this.mapInteractionWithRelations(row));
  }

  getPreviousSession(session: Session): Session | null {
    const row = this.database
      .prepare(
        `SELECT * FROM sessions
         WHERE agent_id = ?
           AND project_id IS ?
           AND id <> ?
           AND last_interaction_at <= ?
         ORDER BY last_interaction_at DESC
         LIMIT 1`,
      )
      .get(session.agentId, session.projectId, session.id, session.startedAt);
    return row ? mapSession(row as SqlRow) : null;
  }

  listUnresolvedTemporalReferences(filters: InteractionFilters, limit: number): TemporalReference[] {
    const clauses = ["tr.resolution_type IN ('fuzzy', 'unresolved')"];
    const parameters: unknown[] = [];
    if (filters.agentId) {
      clauses.push('i.agent_id = ?');
      parameters.push(filters.agentId);
    }
    if (filters.projectId !== undefined) {
      clauses.push('i.project_id IS ?');
      parameters.push(filters.projectId);
    }
    if (filters.sessionId) {
      clauses.push('i.session_id = ?');
      parameters.push(filters.sessionId);
    }
    parameters.push(limit);
    const rows = this.database
      .prepare(
        `SELECT tr.* FROM temporal_references tr
         JOIN interactions i ON i.id = tr.interaction_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY i.occurred_at_utc DESC, tr.created_at DESC
         LIMIT ?`,
      )
      .all(...parameters) as SqlRow[];
    return rows.map(mapTemporalReference);
  }

  insertCommitment(commitment: Commitment): Commitment {
    this.database
      .prepare(
        `INSERT INTO commitments (
           id, source_interaction_id, project_id, session_id, title, original_text,
           due_start_utc, due_end_utc, timezone, status, completed_at, cancelled_at, created_at, updated_at
         ) VALUES (
           @id, @sourceInteractionId, @projectId, @sessionId, @title, @originalText,
           @dueStartUtc, @dueEndUtc, @timezone, @status, @completedAt, @cancelledAt, @createdAt, @updatedAt
         )`,
      )
      .run(commitment);
    return this.getCommitment(commitment.id) as Commitment;
  }

  getCommitment(id: string): Commitment | null {
    const row = this.database.prepare('SELECT * FROM commitments WHERE id = ?').get(id);
    return row ? mapCommitment(row as SqlRow) : null;
  }

  updateCommitment(commitment: Commitment): Commitment {
    this.database
      .prepare(
        `UPDATE commitments SET
           due_start_utc = @dueStartUtc,
           due_end_utc = @dueEndUtc,
           timezone = @timezone,
           status = @status,
           completed_at = @completedAt,
           cancelled_at = @cancelledAt,
           original_text = @originalText,
           updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run(commitment);
    return this.getCommitment(commitment.id) as Commitment;
  }

  listCommitments(filters: CommitmentFilters = {}, limit = 100, offset = 0): Commitment[] {
    const clauses: string[] = [];
    const parameters: unknown[] = [];
    if (filters.projectId !== undefined) {
      clauses.push('project_id IS ?');
      parameters.push(filters.projectId);
    }
    if (filters.dueBefore) {
      clauses.push('due_start_utc <= ?');
      parameters.push(filters.dueBefore);
    }
    if (filters.dueAfter) {
      clauses.push('due_end_utc >= ?');
      parameters.push(filters.dueAfter);
    }
    parameters.push(limit, offset);
    const rows = this.database
      .prepare(
        `SELECT * FROM commitments
         ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
         ORDER BY
           CASE WHEN due_start_utc IS NULL THEN 1 ELSE 0 END,
           due_start_utc ASC,
           created_at ASC,
           id ASC
         LIMIT ? OFFSET ?`,
      )
      .all(...parameters) as SqlRow[];
    return rows.map(mapCommitment);
  }

  exportAll(exportedAt: string): ExportBundle {
    return {
      exportedAt,
      formatVersion: 1,
      privacyNotice:
        'This export contains only data allowed by each interaction privacy mode. Treat it as private local data.',
      agents: (this.database.prepare('SELECT * FROM agents ORDER BY created_at').all() as SqlRow[]).map(
        mapAgent,
      ),
      projects: (this.database.prepare('SELECT * FROM projects ORDER BY created_at').all() as SqlRow[]).map(
        mapProject,
      ),
      sessions: (this.database.prepare('SELECT * FROM sessions ORDER BY started_at').all() as SqlRow[]).map(
        mapSession,
      ),
      interactions: (
        this.database.prepare('SELECT * FROM interactions ORDER BY occurred_at_utc').all() as SqlRow[]
      ).map(mapInteraction),
      temporalReferences: (
        this.database.prepare('SELECT * FROM temporal_references ORDER BY created_at').all() as SqlRow[]
      ).map(mapTemporalReference),
      commitments: (
        this.database.prepare('SELECT * FROM commitments ORDER BY created_at').all() as SqlRow[]
      ).map(mapCommitment),
    };
  }

  purgeAll(): PurgeResult {
    const before = this.tableCounts();
    this.database.transaction(() => {
      this.database.exec(`
        DELETE FROM temporal_references;
        DELETE FROM commitments;
        DELETE FROM interactions;
        DELETE FROM sessions;
        DELETE FROM projects;
        DELETE FROM agents;
      `);
    })();
    return { deleted: before };
  }

  tableCounts(): PurgeResult['deleted'] {
    const tables = [
      'agents',
      'projects',
      'sessions',
      'interactions',
      'temporal_references',
      'commitments',
    ] as const;
    return Object.fromEntries(
      tables.map((table) => {
        const row = this.database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
          count: number;
        };
        return [table === 'temporal_references' ? 'temporalReferences' : table, row.count];
      }),
    ) as PurgeResult['deleted'];
  }

  private addInteractionFilterClauses(
    filters: InteractionFilters,
    clauses: string[],
    parameters: unknown[],
  ): void {
    if (filters.agentId) {
      clauses.push('i.agent_id = ?');
      parameters.push(filters.agentId);
    }
    if (filters.projectId !== undefined) {
      clauses.push('i.project_id IS ?');
      parameters.push(filters.projectId);
    }
    if (filters.sessionId) {
      clauses.push('i.session_id = ?');
      parameters.push(filters.sessionId);
    }
    if (filters.role) {
      clauses.push('i.role = ?');
      parameters.push(filters.role);
    }
  }

  private interactionJoinSql(): string {
    return `SELECT
      i.id AS interaction_id,
      i.idempotency_key,
      i.session_id,
      i.agent_id,
      i.project_id,
      i.role,
      i.occurred_at_utc,
      i.timezone,
      i.utc_offset_minutes,
      i.message_hash,
      i.text_preview,
      i.raw_text,
      i.privacy_mode,
      i.created_at AS interaction_created_at,
      a.id AS joined_agent_id,
      a.name AS agent_name,
      a.platform AS agent_platform,
      a.version AS agent_version,
      a.created_at AS agent_created_at,
      a.last_seen_at AS agent_last_seen_at,
      p.id AS joined_project_id,
      p.name AS project_name,
      p.normalized_path,
      p.repository_remote,
      p.created_at AS project_created_at,
      p.updated_at AS project_updated_at,
      s.id AS joined_session_id,
      s.external_session_id,
      s.agent_id AS session_agent_id,
      s.project_id AS session_project_id,
      s.started_at,
      s.ended_at,
      s.last_interaction_at,
      s.generated_session,
      s.metadata_json
      FROM interactions i
      JOIN agents a ON a.id = i.agent_id
      LEFT JOIN projects p ON p.id = i.project_id
      JOIN sessions s ON s.id = i.session_id`;
  }

  private mapInteractionWithRelations(row: SqlRow): InteractionWithRelations {
    const interaction = mapInteraction({
      id: row.interaction_id,
      idempotency_key: row.idempotency_key,
      session_id: row.session_id,
      agent_id: row.agent_id,
      project_id: row.project_id,
      role: row.role,
      occurred_at_utc: row.occurred_at_utc,
      timezone: row.timezone,
      utc_offset_minutes: row.utc_offset_minutes,
      message_hash: row.message_hash,
      text_preview: row.text_preview,
      raw_text: row.raw_text,
      privacy_mode: row.privacy_mode,
      created_at: row.interaction_created_at,
    });
    const agent = mapAgent({
      id: row.joined_agent_id,
      name: row.agent_name,
      platform: row.agent_platform,
      version: row.agent_version,
      created_at: row.agent_created_at,
      last_seen_at: row.agent_last_seen_at,
    });
    const project = row.joined_project_id
      ? mapProject({
          id: row.joined_project_id,
          name: row.project_name,
          normalized_path: row.normalized_path,
          repository_remote: row.repository_remote,
          created_at: row.project_created_at,
          updated_at: row.project_updated_at,
        })
      : null;
    const session = mapSession({
      id: row.joined_session_id,
      external_session_id: row.external_session_id,
      agent_id: row.session_agent_id,
      project_id: row.session_project_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      last_interaction_at: row.last_interaction_at,
      generated_session: row.generated_session,
      metadata_json: row.metadata_json,
    });
    return { interaction, agent, project, session };
  }
}
