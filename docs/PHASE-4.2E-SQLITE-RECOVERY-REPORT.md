# Phase 4.2E SQLite recovery report

Report date: 2026-07-26

## Decision

**Phase 4.2E implementation: COMPLETE**

**Final three-platform workflow result: NOT YET CONFIRMED**

**v0.1.0: NO-GO**

Phase 4.2E hardens migration history, commitment-row integrity, startup health checks, database-handle cleanup, verified online backup, point-in-time restore testing, and recovery documentation.

## Migration history

`schema_migrations` now records:

- version;
- immutable migration name;
- application timestamp; and
- SHA-256 checksum derived from version, name, and SQL.

Migration startup:

- validates strictly increasing unique migration definitions;
- adds the checksum column to legacy migration tables;
- backfills checksums for known legacy rows;
- rejects unknown/future migration versions;
- rejects changed names;
- rejects changed checksums;
- applies pending migrations transactionally; and
- synchronizes SQLite `user_version` with the latest migration.

There are no automatic down migrations.

## Migration 3

Migration 3 rebuilds `commitments` with database-level lifecycle checks:

- persisted status is limited to `pending`, `completed`, or `cancelled`;
- pending rows cannot contain terminal timestamps;
- completed rows require only `completed_at`;
- cancelled rows require only `cancelled_at`;
- legacy `rescheduled` rows become pending; and
- missing completion/cancellation timestamps on legacy terminal rows are repaired from the row’s update or creation time.

The due-date lookup index is recreated after the table replacement.

## Runtime health boundary

Runtime startup, initialization, `status`, and `doctor` inspect:

- SQLite `integrity_check`;
- SQLite `quick_check`;
- `foreign_key_check`;
- current migration version;
- latest known migration version; and
- SQLite `user_version`.

The MCP runtime closes the database handle when startup verification fails. The storage constructor also closes an opened handle when migration fails.

## Verified backup

New CLI command:

```sh
temporalthread backup --output /private/path/temporalthread-backup.sqlite
```

The backup path:

1. rejects the active database;
2. refuses an existing or symbolic-link destination;
3. performs a passive WAL checkpoint;
4. creates an online SQLite backup at a private temporary path;
5. verifies the temporary snapshot independently;
6. publishes without overwrite through an atomic same-directory hard link where supported or an exclusive-copy fallback;
7. verifies the published destination again;
8. removes incomplete output on failure; and
9. returns private-content-free path, byte count, and health metadata.

The command never overwrites an existing snapshot.

## Point-in-time recovery verification

`scripts/verify-sqlite-recovery.mjs` performs an isolated end-to-end scenario:

1. initialize a source database;
2. ingest one interaction;
3. create and verify a snapshot;
4. confirm a second snapshot at the same path is refused;
5. ingest another interaction into the source;
6. verify the source contains two interactions;
7. open the snapshot through `TEMPORALTHREAD_DATABASE_PATH`; and
8. verify the snapshot remains a healthy point-in-time database containing one interaction.

The normal CI workflow runs the scenario on Ubuntu, macOS, and Windows.

## Unit coverage

Phase 4.2E test declarations cover:

- latest migration and `user_version` health;
- unknown future migration rejection;
- migration name and checksum tamper rejection;
- legacy migration-table checksum-column creation/backfill;
- repeated migration idempotency;
- legacy rescheduled-row conversion;
- database lifecycle constraints;
- foreign-key violation detection;
- verified backup creation;
- existing-destination refusal;
- independent snapshot opening; and
- corrupted-file rejection.

## Documentation

Added or updated:

- `docs/SQLITE-RECOVERY.md`
- `docs/SECURITY.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA-MODEL.md`
- `SECURITY.md`
- `README.md`
- `apps/cli/README.md`
- `CHANGELOG.md`

## Limitations

- TemporalThread refuses corruption; it does not automatically salvage or repair data.
- A raw file copy still requires all clients to stop and must preserve matching WAL/SHM files.
- JSON export has no import command in the MVP and is not a direct restore substitute.
- Restoring an older application requires a compatible older database snapshot.
- The exact final CI result remains unconfirmed through the available GitHub connector.

## Public-state confirmation

- npm publication: NOT PERFORMED
- release artifacts/SBOM for this phase: NOT GENERATED
- Git tag: none created
- GitHub release: none created
- repository visibility: PRIVATE
- public announcement: NOT PERFORMED

The SDK/Hono packed-consumer blocker and npm authority prerequisites remain unresolved, so v0.1.0 remains **NO-GO**.
