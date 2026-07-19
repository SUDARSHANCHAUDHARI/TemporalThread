import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial-domain-schema',
    sql: `
      CREATE TABLE agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        version TEXT,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        UNIQUE(name, platform)
      );

      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        normalized_path TEXT NOT NULL UNIQUE,
        repository_remote TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        external_session_id TEXT,
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        last_interaction_at TEXT NOT NULL,
        generated_session INTEGER NOT NULL CHECK (generated_session IN (0, 1)),
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE UNIQUE INDEX sessions_external_identity
        ON sessions(agent_id, IFNULL(project_id, ''), external_session_id)
        WHERE external_session_id IS NOT NULL;

      CREATE TABLE interactions (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
        occurred_at_utc TEXT NOT NULL,
        timezone TEXT NOT NULL,
        utc_offset_minutes INTEGER NOT NULL,
        message_hash TEXT,
        text_preview TEXT,
        raw_text TEXT,
        privacy_mode TEXT NOT NULL CHECK (
          privacy_mode IN ('metadata-only', 'temporal-references-only', 'full-local-history')
        ),
        created_at TEXT NOT NULL
      );

      CREATE TABLE temporal_references (
        id TEXT PRIMARY KEY,
        interaction_id TEXT NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
        original_expression TEXT NOT NULL,
        normalized_expression TEXT NOT NULL,
        reference_type TEXT NOT NULL,
        anchor_time_utc TEXT NOT NULL,
        anchor_timezone TEXT NOT NULL,
        resolved_start_utc TEXT,
        resolved_end_utc TEXT,
        resolution_type TEXT NOT NULL,
        confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        parser_version TEXT NOT NULL,
        explanation TEXT NOT NULL,
        ambiguity TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE commitments (
        id TEXT PRIMARY KEY,
        source_interaction_id TEXT REFERENCES interactions(id) ON DELETE SET NULL,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        original_text TEXT,
        due_start_utc TEXT,
        due_end_utc TEXT,
        timezone TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled', 'rescheduled')),
        completed_at TEXT,
        cancelled_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'temporal-query-indexes',
    sql: `
      CREATE INDEX interactions_temporal_lookup
        ON interactions(agent_id, project_id, occurred_at_utc DESC);
      CREATE INDEX interactions_session_lookup
        ON interactions(session_id, occurred_at_utc DESC);
      CREATE INDEX temporal_references_resolution_lookup
        ON temporal_references(resolution_type, resolved_start_utc);
      CREATE INDEX commitments_due_lookup
        ON commitments(status, due_start_utc, due_end_utc);
      CREATE INDEX sessions_generated_lookup
        ON sessions(agent_id, project_id, generated_session, last_interaction_at DESC);
    `,
  },
];

export const latestMigrationVersion = migrations.at(-1)?.version ?? 0;

export function migrate(database: Database.Database): number {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    database
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all()
      .map((row) => Number((row as { version: number }).version)),
  );
  const apply = database.transaction((migration: Migration) => {
    database.exec(migration.sql);
    database
      .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(migration.version, migration.name, new Date().toISOString());
  });

  for (const migration of migrations) {
    if (!applied.has(migration.version)) apply(migration);
  }
  return latestMigrationVersion;
}
