# SQLite backup and recovery

TemporalThread stores durable local state in one SQLite database. The database can be in WAL mode while local MCP clients and CLI adapters are active, so copying only the main `.sqlite` file is not a safe live-backup method.

## Create a verified snapshot

Use the built-in online backup command:

```sh
temporalthread backup --output /private/path/temporalthread-backup.sqlite
```

For machine-readable output:

```sh
temporalthread backup --output /private/path/temporalthread-backup.sqlite --json
```

The command:

1. refuses the active database as the destination;
2. refuses an existing destination rather than overwriting it;
3. refuses a symbolic-link destination;
4. uses SQLite’s online backup API while the source remains open;
5. writes to and verifies a private temporary file;
6. publishes with an exclusive no-overwrite operation—an atomic same-directory hard link where supported, or an exclusive-copy fallback on filesystems without hard links; and
7. opens the published snapshot independently and repeats integrity, quick-check, foreign-key, migration, and `user_version` verification.

The resulting file is a point-in-time SQLite recovery snapshot. Store it in a private location with appropriate disk encryption and access control.

## Backup versus export

`temporalthread backup` and `temporalthread export` serve different purposes:

| Command | Result | Primary use |
| --- | --- | --- |
| `temporalthread backup --output ...` | Complete SQLite snapshot | Exact local recovery with the matching TemporalThread version |
| `temporalthread export --output ...` | Privacy-permitted logical JSON | Review, portability, and future import tooling |

The current MVP does not implement JSON import. An export is therefore not a direct replacement for a SQLite recovery snapshot.

## Verify and inspect health

Run:

```sh
temporalthread status --json
temporalthread doctor --json
```

A healthy database reports:

- `integrity: "ok"`;
- `quickCheck: "ok"`;
- zero foreign-key violations;
- current and latest migration versions equal;
- SQLite `userVersion` equal to the latest migration; and
- `healthy: true`.

Normal runtime startup performs the same health boundary after applying known migrations. A database with structural corruption, relationship violations, incomplete migration state, an unknown future migration, or a changed migration checksum is refused.

## Test a snapshot without replacing the active database

Point a separate command or process at the snapshot:

```sh
TEMPORALTHREAD_DATABASE_PATH=/private/path/temporalthread-backup.sqlite \
  temporalthread status --json
```

Do not run two writable TemporalThread versions against the same database. A snapshot should be tested with the application version that created it or a newer compatible version.

## Restore from a snapshot

1. Stop all TemporalThread MCP servers, hooks, CLI commands, and other clients using the target database.
2. Preserve the damaged or suspect database and any `-wal` and `-shm` files. Do not repair the only copy.
3. Test the snapshot at a separate path with `TEMPORALTHREAD_DATABASE_PATH` and `temporalthread status --json`.
4. Confirm the snapshot contains the expected interaction and commitment counts without exposing private content.
5. Move the current database files aside.
6. Place a copy of the verified snapshot at the configured database path with private file permissions.
7. Start TemporalThread and run `temporalthread doctor --json`.

TemporalThread does not automatically replace, delete, salvage, or downgrade a database.

## Raw file copies

A raw filesystem copy is acceptable only when every process using the database is stopped. Copy the main database together with any matching `-wal` and `-shm` files. Prefer the built-in backup command for a live source because it creates one consistent standalone snapshot.

## Migration safety

Migration records include version, name, application time, and SHA-256 checksum. Applied migration definitions are immutable. A new build may append a new migration, but must not edit previously released migration SQL or names.

Migration 3 hardens commitment lifecycle rows. It converts the legacy persisted `rescheduled` state to `pending`, repairs missing terminal timestamps on legacy terminal rows, and adds SQLite checks so status and completion/cancellation timestamps cannot contradict one another.

There are no down migrations. Restoring an older application requires restoring a database created by the compatible version.

## Corruption response

When startup reports that the database cannot be opened, migrated, or verified:

1. stop all writers;
2. preserve the original database, WAL, and SHM files;
3. record the TemporalThread commit/version and the exact bounded error message;
4. test the newest verified snapshot at a separate path;
5. use official SQLite recovery tooling only on a copy; and
6. never share real database contents, conversation text, tokens, credentials, or personal paths in a public issue.

See [Security](SECURITY.md) for the broader threat model and [Data model](DATA-MODEL.md) for migration and lifecycle invariants.
