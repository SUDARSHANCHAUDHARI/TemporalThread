# Changelog

All notable changes to TemporalThread will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to use [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Local MCP stdio server with nine strictly validated temporal continuity tools.
- SQLite persistence, transactional migrations, privacy modes, export, and purge.
- Deterministic relative-time parsing, elapsed-time calculation, and commitment tracking.
- Operational CLI with initialization, diagnostics, configuration, timeline, commitments, ingestion, export, and purge commands.
- Official-format Codex plugin with local marketplace metadata, packaged MCP/skill/hooks, privacy notice,
  compatibility guidance, package validation, and isolated packed install/uninstall verification.
- Nested `temporalthread integrate codex` install, uninstall, status, doctor, print-config, install-skill, and
  remove-skill commands for user and project scope, including dry-run and structured JSON output.
- Tested Codex lifecycle handling for `SessionStart`, `UserPromptSubmit`, and `Stop`, with bounded compact
  context, deterministic idempotency, best-effort session closure, and strict fail-open behavior.
- Tested Codex and Claude Code hook adapters, an experimental typed OpenCode plugin, and generic/Ollama
  examples.
- Cross-platform CI for Linux, macOS, and Windows.

### Changed

- Codex integration installation now parses and preserves unrelated TOML/JSON, validates the MCP executable
  and protocol before mutation, creates timestamped backups, writes atomically, tracks ownership/version,
  rolls back validation failures, preserves modified/unowned files, and refuses silent downgrades.
- The canonical Codex skill is now `temporal-awareness`; the default remains
  `temporal-references-only`, and clear commitments still require an explicit `record_commitment` tool call.

### Security

- Codex hook input is limited to 256 KiB, validated from stdin, never shell-interpolated, and excluded from
  logs/errors; hook output is capped at 7,000 bytes and omits transcripts, internal IDs, hashes, and database
  paths.
- Codex MCP remains local stdio, optional at host startup, and configured with write approvals; plugin/hook
  trust remains an explicit Codex/user decision.
