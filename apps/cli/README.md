# TemporalThread CLI

`temporalthread` is the local-first CLI and stdio MCP server for TemporalThread. It requires Node.js 24 or
newer and stores data in a local SQLite database under the platform-specific TemporalThread data directory.

Run `temporalthread init`, then `temporalthread doctor`. Codex users can run
`temporalthread integrate codex install --scope user` or choose project scope. The default
`temporal-references-only` privacy mode does not retain complete prompt text.

No package command opens a network listener or sends telemetry. Integration removal preserves the database
unless `--purge-data --yes` is explicitly supplied.
