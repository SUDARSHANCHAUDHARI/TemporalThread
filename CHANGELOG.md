# Changelog

All notable changes to TemporalThread will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to use [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - UNRELEASED

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
- Manual-only release-dry-run CI for clean source/packed installation, strict tarball verification, SHA-256
  checksums, SPDX 2.3 SBOM generation, and 14-day release-candidate artifacts on all three platforms.
- Privacy-aware bug/feature issue forms, pull request template, npm distribution plan, live Codex
  certification plan, public-repository audit, dependency-license review, and v0.1.0 release gate documents.

### Changed

- Codex integration installation now parses and preserves unrelated TOML/JSON, validates the MCP executable
  and protocol before mutation, creates timestamped backups, writes atomically, tracks ownership/version,
  rolls back validation failures, preserves modified/unowned files, and refuses silent downgrades.
- Installed Codex MCP configuration now launches the package-manager command shim through `cmd.exe` on
  Windows while keeping the direct `temporalthread start` command on macOS and Linux.
- Temporal context now selects the latest meaningful user or assistant interaction, so lifecycle-generated
  `SessionStart` bookkeeping cannot reset elapsed conversation time. Generic `get_last_interaction` behavior
  remains unchanged, and real `Stop.last_assistant_message` responses remain eligible context.
- Packed-package command failures now report a bounded, sanitized logical operation, working directory, exit
  status, signal, stdout, and stderr without dumping environment variables.
- The canonical Codex skill is now `temporal-awareness`; the default remains
  `temporal-references-only`, and clear commitments still require an explicit `record_commitment` tool call.
- All eight intended public packages now have complete registry metadata, strict file allowlists, package
  READMEs/licenses, exact packed workspace versions, and independently verified artifact manifests.
- Packed verification now exercises CLI help/init/doctor/status, real nine-tool MCP stdio calls, temporal
  interaction/context/commitment behavior, default privacy, export, uninstall preservation, and explicit
  purge. A separate isolated source-copy certification uses private home/cache/store/temp directories.
- Packed dependency verification now installs all eight tarballs into independent npm and pnpm consumers
  with isolated caches/stores, audits both production graphs, reports every SDK/Hono/fast-uri version, and
  fails closed when any manager retains a vulnerable nested dependency.

### Security

- Override transitive `@hono/node-server` and `fast-uri` resolutions to patched releases after
  GHSA-frvp-7c67-39w9, GHSA-9mqv-5hh9-4cgg, and GHSA-v2hh-gcrm-f6hx were added to the registry audit feed.
- Codex hook input is limited to 256 KiB, validated from stdin, never shell-interpolated, and excluded from
  logs/errors; hook output is capped at 7,000 bytes and omits transcripts, internal IDs, hashes, and database
  paths.
- Codex MCP remains local stdio, optional at host startup, and configured with write approvals; plugin/hook
  trust remains an explicit Codex/user decision.
- Release artifact verification rejects links, path traversal, sources/tests/build metadata, local state,
  databases/logs, secret patterns, machine paths, invalid metadata, local-only dependencies, and a non-portable
  CLI entry point.
