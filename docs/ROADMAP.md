# Roadmap

## 0.1 MVP

- Local SQLite continuity with three privacy modes.
- Nine MCP stdio tools, operational CLI, generic ingestion, and deterministic temporal parsing.
- Official-format Codex plugin, safe user/project installer, doctor, packed-artifact verification, and tested
  Codex/Claude Code hook adapters.
- Typed experimental OpenCode plugin and local Ollama tool-calling example.

## Next

- Publish verified npm packages and signed release artifacts.
- Live compatibility suites for Codex, Claude Code, and OpenCode host releases.
- Portable import with conflict and schema-version handling.
- Broader locale-aware expression grammar and parser conformance fixtures.
- Retention policies and scoped purge/export.
- Signed checksums and a documented reproducible release workflow.

## Later

- Opt-in authenticated Streamable HTTP transport, disabled by default.
- Additional host adapters where stable event APIs exist.
- Optional encrypted-at-rest storage after a cross-platform key-management design.

TemporalThread will remain local-first. A hosted service, analytics, telemetry, an embedded LLM, and a web dashboard are not MVP goals.
