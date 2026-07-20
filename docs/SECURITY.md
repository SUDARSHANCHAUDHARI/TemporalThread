# Security design

## Threat model

TemporalThread protects local conversation timing and privacy-permitted content from accidental disclosure, malformed MCP/CLI input, duplicate or out-of-order events, unsafe SQL construction, and unintended network exposure. It does not defend against an attacker who already controls the operating-system account, a malicious trusted MCP host, or physical access to an unencrypted device.

## Controls

- Local stdio is the only production transport; no port is opened.
- Zod schemas are strict and impose length/range limits. Text is also checked by UTF-8 byte size.
- All value-bearing SQL statements are parameterized. Dynamic table names are internal constants only.
- SQLite foreign keys, transactions, integrity checks, WAL, and a busy timeout protect consistency.
- Configuration and database files use mode `0600`, and their directories use `0700`, where supported.
- Configuration and installer edits use same-directory temporary files and atomic rename. Existing files receive timestamped backups.
- Host adapters use fixed executable names and argument arrays with `shell: false`; interaction text is JSON on stdin.
- MCP failures and hook logs use allow-listed messages and do not echo private text.
- CI has read-only repository permissions, pins third-party actions to full commit SHAs, audits production dependencies, and runs on three operating systems.

## Database recovery

Before upgrading or changing privacy settings, stop all TemporalThread processes and copy the SQLite database together with any `-wal` and `-shm` files. Keep the files private.

If startup reports a corrupt or inaccessible database:

1. Stop clients and preserve the original files before attempting repair.
2. Run `temporalthread doctor` and inspect file ownership, available space, and directory permissions.
3. Restore a known-good backup to a separate path and point `TEMPORALTHREAD_DATABASE_PATH` at it.
4. For SQLite-level recovery, work on a copy using the official SQLite recovery tools. Never experiment on the only copy.

Migrations are atomic but intentionally have no automatic downgrade. Roll back by restoring a pre-upgrade database and the matching application version. `temporalthread export` is the portable logical backup; the MVP does not yet implement import.

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
