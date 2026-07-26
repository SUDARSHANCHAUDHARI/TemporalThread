import {
  chmodSync,
  constants,
  copyFileSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { latestMigrationVersion } from './migrations.js';
import type { SqliteStorage } from './repository.js';

export interface DatabaseHealth {
  healthy: boolean;
  integrity: string;
  quickCheck: string;
  foreignKeyViolations: number;
  migrationVersion: number;
  latestMigrationVersion: number;
  userVersion: number;
}

export interface DatabaseBackupResult {
  path: string;
  bytes: number;
  health: DatabaseHealth;
}

function pragmaText(database: Database.Database, pragma: string): string {
  return String(database.pragma(pragma, { simple: true }));
}

function migrationVersion(database: Database.Database): number {
  const table = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
    )
    .get();
  if (!table) return 0;
  const row = database.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as {
    version: number | null;
  };
  return row.version ?? 0;
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error ? String(error.code) : undefined;
}

function publishWithoutOverwrite(temporary: string, destination: string): void {
  try {
    // Same-directory hard-link publication is atomic and fails when the destination already exists.
    linkSync(temporary, destination);
    return;
  } catch (error) {
    const code = errorCode(error);
    if (code === 'EEXIST') throw error;
    if (
      !['EACCES', 'EPERM', 'EXDEV', 'ENOSYS', 'ENOTSUP', 'EOPNOTSUPP'].includes(code ?? '')
    ) {
      throw error;
    }
  }

  // Some filesystems do not support hard links. COPYFILE_EXCL preserves the no-overwrite guarantee; the
  // copied destination is verified again before the temporary source is removed.
  copyFileSync(temporary, destination, constants.COPYFILE_EXCL);
}

function activeDatabasePaths(databasePath: string): Set<string> {
  const active = resolve(databasePath);
  return new Set([active, `${active}-wal`, `${active}-shm`, `${active}-journal`]);
}

export function inspectDatabaseHealth(database: Database.Database): DatabaseHealth {
  const integrity = pragmaText(database, 'integrity_check');
  const quickCheck = pragmaText(database, 'quick_check');
  const foreignKeyViolations = (database.pragma('foreign_key_check') as unknown[]).length;
  const currentMigrationVersion = migrationVersion(database);
  const userVersion = Number(database.pragma('user_version', { simple: true }));
  return {
    healthy:
      integrity === 'ok' &&
      quickCheck === 'ok' &&
      foreignKeyViolations === 0 &&
      currentMigrationVersion === latestMigrationVersion &&
      userVersion === latestMigrationVersion,
    integrity,
    quickCheck,
    foreignKeyViolations,
    migrationVersion: currentMigrationVersion,
    latestMigrationVersion,
    userVersion,
  };
}

export function assertDatabaseHealthy(database: Database.Database): DatabaseHealth {
  const health = inspectDatabaseHealth(database);
  if (health.integrity !== 'ok' || health.quickCheck !== 'ok') {
    throw new Error('TemporalThread database integrity check failed');
  }
  if (health.foreignKeyViolations !== 0) {
    throw new Error('TemporalThread database foreign-key check failed');
  }
  if (health.migrationVersion !== health.latestMigrationVersion) {
    throw new Error('TemporalThread database migration version is incomplete');
  }
  if (health.userVersion !== health.latestMigrationVersion) {
    throw new Error('TemporalThread database user version is inconsistent');
  }
  return health;
}

export function verifyDatabaseFile(databasePath: string): DatabaseHealth {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    database.pragma('foreign_keys = ON');
    return assertDatabaseHealthy(database);
  } finally {
    database.close();
  }
}

export async function createVerifiedBackup(
  storage: SqliteStorage,
  destinationPath: string,
): Promise<DatabaseBackupResult> {
  const destination = resolve(destinationPath);
  if (
    storage.databasePath !== ':memory:' &&
    activeDatabasePaths(storage.databasePath).has(destination)
  ) {
    throw new Error('Backup destination must not use the active database or its sidecar paths');
  }
  if (existsSync(destination)) {
    const existing = lstatSync(destination);
    if (existing.isSymbolicLink()) throw new Error('Backup destination must not be a symbolic link');
    throw new Error('Backup destination already exists');
  }

  const parent = dirname(destination);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const temporary = `${destination}.temporary-${process.pid}-${Date.now()}`;
  let published = false;
  try {
    storage.database.pragma('wal_checkpoint(PASSIVE)');
    await storage.database.backup(temporary);
    chmodSync(temporary, 0o600);
    verifyDatabaseFile(temporary);

    publishWithoutOverwrite(temporary, destination);
    published = true;
    chmodSync(destination, 0o600);
    const health = verifyDatabaseFile(destination);
    rmSync(temporary, { force: true });
    return { path: destination, bytes: statSync(destination).size, health };
  } catch (error) {
    rmSync(temporary, { force: true });
    if (published) rmSync(destination, { force: true });
    throw new Error('Unable to create a verified TemporalThread database backup', {
      cause: error,
    });
  }
}
