# Codex integration

TemporalThread integrates with Codex through the existing local stdio MCP server, the
`temporal-awareness` skill, and best-effort documented lifecycle hooks. Node.js 24 or newer and the
`temporalthread` CLI are required.

Preview and install from the target repository:

```sh
temporalthread integrate codex install --scope project --dry-run
temporalthread integrate codex install --scope project --yes
temporalthread integrate codex doctor --scope project
```

Use `--scope user` for a user-level install. Other supported commands are `uninstall`, `status`, `doctor`,
`print-config`, `install-skill`, and `remove-skill`. Mutating non-interactive commands require `--yes`; JSON
output is available with `--json`.

The installer validates MCP before mutation, parses and preserves unrelated configuration, creates
timestamped backups, writes atomically, refuses uncertain ownership, records a content-free installation
manifest, and rolls back its current transaction on validation failure. Uninstall removes only managed
entries and preserves the TemporalThread database unless `--purge-data --yes` is explicit.

The official plugin package is under `plugin/` and contains `.codex-plugin/plugin.json`, `.mcp.json`, the same
skill, the same hooks, and its own privacy/compatibility notices. Plugin installation cannot install the CLI
or approve hook trust. The IDE extension does not install plugins; use the direct installer there.

Codex supplies documented `prompt` and `last_assistant_message` fields to hooks. TemporalThread does not parse
`transcript_path`. Capture can be missed if hooks are disabled, untrusted, interrupted, timed out, or omitted
on abnormal termination. Hooks record temporal references but do not create firm commitments; that still
requires the model to call `record_commitment`.

The default `temporal-references-only` mode stores metadata and locally parsed temporal references, not
complete prompts. `full-local-history` requires explicit opt-in. No component opens a network listener or
sends telemetry.

Official references: [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli),
[hooks](https://learn.chatgpt.com/docs/hooks), [skills](https://learn.chatgpt.com/docs/build-skills), and
[plugins](https://learn.chatgpt.com/docs/build-plugins).
