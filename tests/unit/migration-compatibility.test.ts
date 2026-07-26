import {
  latestMigrationVersion,
  migrate,
  migrationChecksum,
  migrations,
} from '@temporalthread/storage-sqlite';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration metadata compatibility', () => {
  it('adds and backfills checksums for a legacy migration table', () => {
    const database = new Database(':memory:');
    try {
      const initial = migrations[0];
      if (!initial) throw new Error('Expected the initial migration');

      database.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);
      database.exec(initial.sql);
      database
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(initial.version, initial.name, '2026-07-20T00:00:00Z');

      expect(migrate(database)).toBe(latestMigrationVersion);
      const columns = database.pragma('table_info(schema_migrations)') as Array<{ name: string }>;
      expect(columns.some((column) => column.name === 'checksum')).toBe(true);
      const row = database
        .prepare('SELECT checksum FROM schema_migrations WHERE version = ?')
        .get(initial.version) as { checksum: string };
      expect(row.checksum).toBe(migrationChecksum(initial));
    } finally {
      database.close();
    }
  });

  it('keeps repeated migration runs idempotent', () => {
    const database = new Database(':memory:');
    try {
      expect(migrate(database)).toBe(latestMigrationVersion);
      const firstRows = database
        .prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version')
        .all();

      expect(migrate(database)).toBe(latestMigrationVersion);
      const secondRows = database
        .prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version')
        .all();

      expect(secondRows).toEqual(firstRows);
      expect(secondRows).toHaveLength(migrations.length);
    } finally {
      database.close();
    }
  });
});
