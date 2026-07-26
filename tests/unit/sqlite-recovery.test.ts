import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertDatabaseHealthy,
  createVerifiedBackup,
  inspectDatabaseHealth,
  latestMigrationVersion,
  migrate,
  migrationChecksum,
  migrations,
  SqliteStorage,
  verifyDatabaseFile,
} from '@temporalthread/storage-sqlite';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryRoots: string[] = [];

function temporaryRoot(label: string): string {
  const root = mkdtempSync(join(tmpdir(), `temporalthread-sqlite-${label}-`));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('SQLite migrations and recovery', () => {
  it('creates a healthy database at the latest migration and user version', () => {
    const database = new Database(':memory:');
    try {
      expect(migrate(database)).toBe(latestMigrationVersion);
      const health = inspectDatabaseHealth(database);
      expect(health).toMatchObject({
        healthy: true,
        integrity: 'ok',
        quickCheck: 'ok',
        foreignKeyViolations: 0,
        migrationVersion: latestMigrationVersion,
        latestMigrationVersion,
        userVersion: latestMigrationVersion,
      });
      expect(assertDatabaseHealthy(database)).toEqual(health);
    } finally {
      database.close();
    }
  });

  it('rejects an unknown future migration instead of downgrading it', () => {
    const database = new Database(':memory:');
    try {
      database.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          checksum TEXT
        );
      `);
      database
        .prepare(
          'INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)',
        )
        .run(999, 'future-migration', '2026-07-26T00:00:00Z', 'future');

      expect(() => migrate(database)).toThrow('newer than or unknown to this build');
    } finally {
      database.close();
    }
  });

  it('rejects changed migration names and checksums', () => {
    const database = new Database(':memory:');
    try {
      migrate(database);
      database.prepare('UPDATE schema_migrations SET name = ? WHERE version = 1').run('tampered-name');
      expect(() => migrate(database)).toThrow('unexpected name');

      database
        .prepare('UPDATE schema_migrations SET name = ?, checksum = ? WHERE version = 1')
        .run(migrations[0]?.name, 'tampered-checksum');
      expect(() => migrate(database)).toThrow('checksum does not match');
    } finally {
      database.close();
    }
  });

  it('upgrades legacy rescheduled rows and enforces terminal timestamp consistency', () => {
    const database = new Database(':memory:');
    try {
      database.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          checksum TEXT
        );
      `);
      for (const migration of migrations.slice(0, 2)) {
        database.exec(migration.sql);
        database
          .prepare(
            'INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)',
          )
          .run(
            migration.version,
            migration.name,
            '2026-07-26T00:00:00Z',
            migrationChecksum(migration),
          );
      }
      database
        .prepare(
          `INSERT INTO commitments (
            id, source_interaction_id, project_id, session_id, title, original_text,
            due_start_utc, due_end_utc, timezone, status, completed_at, cancelled_at,
            created_at, updated_at
          ) VALUES (?, NULL, NULL, NULL, ?, NULL, NULL, NULL, ?, ?, NULL, NULL, ?, ?)`,
        )
        .run(
          'legacy-rescheduled',
          'Legacy commitment',
          'UTC',
          'rescheduled',
          '2026-07-20T00:00:00Z',
          '2026-07-21T00:00:00Z',
        );

      expect(migrate(database)).toBe(latestMigrationVersion);
      const migrated = database.prepare('SELECT * FROM commitments WHERE id = ?').get('legacy-rescheduled') as {
        status: string;
        completed_at: string | null;
        cancelled_at: string | null;
      };
      expect(migrated).toMatchObject({ status: 'pending', completed_at: null, cancelled_at: null });

      expect(() =>
        database
          .prepare(
            `INSERT INTO commitments (
              id, title, timezone, status, completed_at, cancelled_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
          )
          .run(
            'invalid-completed',
            'Invalid completed commitment',
            'UTC',
            'completed',
            '2026-07-20T00:00:00Z',
            '2026-07-21T00:00:00Z',
          ),
      ).toThrow();
    } finally {
      database.close();
    }
  });

  it('detects foreign-key violations in an otherwise readable database', () => {
    const database = new Database(':memory:');
    try {
      migrate(database);
      database.pragma('foreign_keys = OFF');
      database
        .prepare(
          `INSERT INTO sessions (
            id, external_session_id, agent_id, project_id, started_at, ended_at,
            last_interaction_at, generated_session, metadata_json
          ) VALUES (?, NULL, ?, NULL, ?, NULL, ?, 1, '{}')`,
        )
        .run('orphan-session', 'missing-agent', '2026-07-20T00:00:00Z', '2026-07-20T00:00:00Z');
      database.pragma('foreign_keys = ON');

      const health = inspectDatabaseHealth(database);
      expect(health.healthy).toBe(false);
      expect(health.foreignKeyViolations).toBe(1);
      expect(() => assertDatabaseHealthy(database)).toThrow('foreign-key check failed');
    } finally {
      database.close();
    }
  });

  it('creates a private verified backup that opens independently', async () => {
    const root = temporaryRoot('backup');
    const storage = new SqliteStorage(join(root, 'source.sqlite'));
    const backupPath = join(root, 'recovery', 'snapshot.sqlite');
    try {
      const result = await createVerifiedBackup(storage, backupPath);
      expect(result.path).toBe(backupPath);
      expect(result.bytes).toBeGreaterThan(0);
      expect(result.health.healthy).toBe(true);
      expect(existsSync(backupPath)).toBe(true);
      expect(verifyDatabaseFile(backupPath).healthy).toBe(true);
      await expect(createVerifiedBackup(storage, backupPath)).rejects.toThrow(
        'Unable to create a verified TemporalThread database backup',
      );
    } finally {
      storage.close();
    }
  });

  it('rejects a corrupted database file during verification', () => {
    const root = temporaryRoot('corrupt');
    const databasePath = join(root, 'corrupt.sqlite');
    writeFileSync(databasePath, 'not a sqlite database', 'utf8');

    expect(() => verifyDatabaseFile(databasePath)).toThrow();
  });
});
