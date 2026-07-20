# TemporalThread Codex plugin

TemporalThread gives Codex local temporal continuity through one skill, one local stdio MCP server, and
best-effort lifecycle hooks. The plugin contains no remote connector and sends no data to TemporalThread or
another cloud service.

## Requirements

- Node.js 24 or newer.
- The `temporalthread` CLI installed and available on `PATH`.
- A local Codex surface with plugin support. The IDE extension does not currently install plugins; use
  `temporalthread integrate codex install` there instead.

Install the plugin from the repository marketplace, start a new Codex session, review the MCP definition,
and explicitly trust the hook definition when Codex prompts. Plugin installation cannot install the CLI or
approve its own hooks.

Run `temporalthread integrate codex doctor --scope user` to diagnose the CLI, MCP handshake, database,
privacy mode, skill, and hooks. See `PRIVACY.md` and `COMPATIBILITY.md` before enabling full local history.

Removing the plugin does not remove the TemporalThread database. Use the CLI's explicit purge option only
when local TemporalThread data should also be deleted.
