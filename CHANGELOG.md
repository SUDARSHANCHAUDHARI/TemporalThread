# Changelog

All notable changes to TemporalThread will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to use [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Codex status and doctor now inspect the configured database path, including validated environment
  overrides, instead of assuming the default data path.
- Commitment status filters are applied before the requested result limit.
- Later interactions reopen ended sessions and preserve out-of-order session start timestamps.
- Storage query helpers retain their no-filter defaults after the repository refactor.

## [0.1.0] - UNRELEASED

### Added

- Local MCP stdio server with nine strictly validated temporal continuity tools.
- SQLite persistence, transactional migrations, privacy modes, export, and purge.
- Deterministic relative-time parsing, elapsed-time calculation, and commitment tracking.
- Operational CLI with initialization, diagnostics, configuration, timeline, commitments, ingestion, export,
  verified SQLite backup, and purge commands.
- Host-neutral MCP end-to-end certification that exercises all nine tools, strict input errors, privacy,
  idempotency, commitment transitions, process restart, and persistence without a host-specific integration.
- SQLite point-in-time recovery verification that creates a live snapshot, refuses overwrite, keeps source and
  restored counts independent, and runs on Linux, macOS, and Windows.
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
- Phase 4.2 manual-certification tooling with a proven disposable temp root, isolated package/Codex/data
  homes, relative controlled scenario, automated stage checks, guarded cleanup, privacy-safe result template,
  npm authority/2FA guides, and explicit release-authorization checklist.

### Changed

- Commitment updates now use an explicit state machine: repeated actions are idempotent, terminal states must
  be reopened before crossing, rescheduling reopens the item and clears terminal timestamps, and privacy-redacted
  original text remains redacted.
- Commitment updates reject fields that do not apply to the requested action: rescheduling requires the new
  due expression, anchor time, and timezone, while `completedAt` is accepted only for completion.
- SQLite migration records now include immutable SHA-256 checksums; startup rejects unknown future versions,
  changed names, checksum mismatches, incomplete migration state, and inconsistent `user_version`.
- Migration 3 converts legacy persisted `rescheduled` commitments to `pending`, repairs missing legacy
  terminal timestamps, and adds database checks for status/timestamp consistency.
- Runtime startup, initialization, status, and doctor now verify integrity, quick-check, foreign keys,
  migration version, and SQLite `user_version`.
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

- Verified SQLite backups use the online backup API, private temporary files, independent health validation,
  exclusive no-overwrite publication, and a second verification of the published file. Same-directory hard
  links are atomic where supported; other filesystems use an exclusive-copy fallback.
- Runtime database health now fails closed for structural corruption, failed quick checks, foreign-key
  violations, altered migration history, unknown future migrations, and inconsistent schema versions.
- Commitment lifecycle errors are bounded and allow-listed at the MCP boundary without exposing private data.
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
- Live-certification setup and cleanup refuse real home/repository targets, symlink escapes, and unmarked
  roots; functional tarballs remain explicitly blocked from release while SDK 1.29.0 resolves vulnerable
  Hono 1.19.14 in clean consumers.
