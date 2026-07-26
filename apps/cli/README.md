# TemporalThread CLI

`temporalthread` is the local-first CLI and stdio MCP server for TemporalThread. It requires Node.js 24 or
newer and stores data in a local SQLite database under the platform-specific TemporalThread data directory.

Run `temporalthread init`, then `temporalthread doctor`. Codex users can run
`temporalthread integrate codex install --scope user` or choose project scope. The default
`temporal-references-only` privacy mode does not retain complete prompt text.

Useful operational commands:

```sh
temporalthread status --json
temporalthread timeline
temporalthread commitments
temporalthread backup --output /private/path/temporalthread-backup.sqlite
temporalthread export --output /private/path/temporalthread-export.json
temporalthread purge --yes
```

`backup` creates a complete point-in-time SQLite snapshot, verifies it independently, and refuses to overwrite
an existing destination. `export` creates privacy-permitted logical JSON and is not a direct restore format in
the current MVP. Runtime startup, `status`, and `doctor` check migration state, SQLite integrity, quick-check,
and foreign-key relationships.

No package command opens a network listener or sends telemetry. Integration removal preserves the database
unless `--purge-data --yes` is explicitly supplied. See the repository
[SQLite recovery guide](../../docs/SQLITE-RECOVERY.md) before restoring or repairing local data.
