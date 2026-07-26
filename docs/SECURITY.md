# Security design

## Threat model

TemporalThread protects local conversation timing and privacy-permitted content from accidental disclosure, malformed MCP/CLI input, duplicate or out-of-order events, unsafe SQL construction, altered migration history, and unintended network exposure. It does not defend against an attacker who already controls the operating-system account, a malicious trusted MCP host, physical access to an unencrypted device, or an administrator who deliberately replaces the local executable and database together.

## Controls

- Local stdio is the only production transport; no port is opened.
- Zod schemas are strict and impose length/range limits. Text is also checked by UTF-8 byte size.
- Commitment updates pass through explicit lifecycle rules before storage, and SQLite checks enforce matching status/timestamp invariants.
- All value-bearing SQL statements are parameterized. Dynamic table names are internal constants only.
- SQLite foreign keys, transactions, WAL, a busy timeout, integrity checks, quick checks, and foreign-key checks protect consistency.
- Migration records include immutable names and SHA-256 checksums. Unknown future versions and changed history are refused.
- Configuration, database, and verified backup files use mode `0600`, and their directories use `0700`, where supported.
- Configuration and installer edits use same-directory temporary files and atomic rename. Existing files receive timestamped backups.
- The SQLite backup command writes to a temporary file, verifies it independently, then atomically renames it; it never overwrites an existing destination.
- Host adapters use fixed executable names and argument arrays with `shell: false`; interaction text is JSON on stdin.
- MCP failures and hook logs use allow-listed messages and do not echo private text.
- CI has read-only repository permissions, pins third-party actions to full commit SHAs, audits production dependencies, and runs source tests, host-neutral MCP certification, SQLite recovery checks, and packed verification on three operating systems.

## Database recovery

Create a live verified snapshot with:

```sh
temporalthread backup --output /private/path/temporalthread-backup.sqlite
```

This uses SQLite’s online backup API, verifies the standalone snapshot, and refuses an existing or symbolic-link destination. A raw file copy should be made only after all TemporalThread processes are stopped, and it must include matching `-wal` and `-shm` files when present.

If startup reports a corrupt, incompatible, or inaccessible database:

1. Stop clients and preserve the original database, WAL, and SHM files before attempting repair.
2. Run `temporalthread doctor --json` and inspect file ownership, available space, directory permissions, migration state, integrity, and foreign-key status.
3. Test a known-good snapshot at a separate path through `TEMPORALTHREAD_DATABASE_PATH`.
4. Restore only after the snapshot reports healthy status and expected private-content-free counts.
5. For SQLite-level recovery, work on a copy using official SQLite recovery tools. Never experiment on the only copy.

Migrations are atomic, ordered, checksummed, and intentionally have no automatic downgrade. Roll back by restoring a verified pre-upgrade database and the matching application version. `temporalthread export` is a privacy-permitted logical JSON export; the MVP does not yet implement import, so export is not a direct SQLite restore mechanism.

See [SQLite backup and recovery](SQLITE-RECOVERY.md) for the complete runbook.

## Integration trust

MCP hosts and hooks execute with local user permissions. Review generated configuration, installer diffs,
plugin contents, and trust prompts. The Codex installer validates the MCP process before mutation, modifies
only a marked MCP block, exact managed hook commands, a known skill path, and a content-free ownership
manifest. It refuses symbolic-link targets and uncertain MCP ownership, backs up existing files, writes
atomically, rolls back failed validation, and preserves locally edited skills during uninstall.

Codex plugin installation does not install the CLI or approve its own hooks. The packaged artifact is checked
for required legal/privacy files, forbidden database/secret extensions, personal absolute paths, symlinks,
source/build metadata, and install/uninstall behavior in an isolated temporary environment. OpenCode
automatic capture remains experimental until verified against a compatible live release.

Report vulnerabilities according to the root [security policy](../SECURITY.md).
