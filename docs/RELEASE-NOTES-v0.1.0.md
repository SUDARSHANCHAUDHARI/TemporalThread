# TemporalThread v0.1.0 release notes

Released: 2026-07-29

Release: [TemporalThread v0.1.0](https://github.com/SUDARSHANCHAUDHARI/TemporalThread/releases/tag/v0.1.0)

Source commit: `5056916c602752632f16fe61bebd814454575c3c`

## Summary

TemporalThread gives MCP-capable AI agents a persistent, local-first sense of time. It records when an
interaction happened, resolves relative phrases against their original timestamp, distinguishes exact
elapsed duration from local calendar-day difference, and tracks explicit follow-up commitments across
sessions and restarts.

## Highlights

- Local SQLite persistence for agents, projects, sessions, interactions, temporal references, and
  commitments.
- Nine strictly validated tools over local MCP stdio; no network listener, hosted service, telemetry, or
  embedded LLM.
- Deterministic elapsed-time and relative-time handling for timezone offsets, DST gaps/overlaps, midnight,
  leap day, vague ranges, out-of-order events, and idempotent retries.
- Operational CLI for initialization, MCP startup, diagnostics, status, configuration, timeline,
  commitments, generic ingestion, export, purge, and Codex integration management.
- Official-format Codex plugin plus a safe direct user/project installer, selective `temporal-awareness`
  skill, and best-effort documented lifecycle hooks.
- Generic MCP/JSONL support, partially supported Claude Code adapter/configuration, experimental OpenCode
  automation, and an Ollama example client.

## Installation

Node.js 24 or newer is required:

```sh
npm install --global temporalthread@0.1.0
temporalthread init
temporalthread doctor
```

The release consists of the unscoped `temporalthread` CLI plus seven public
`@sudarshanchaudhari/temporalthread-*` runtime packages.

## Codex integration

Codex support combines local MCP tools, the `temporal-awareness` skill, and documented `SessionStart`,
`UserPromptSubmit`, and `Stop` hooks. The installer validates the MCP process before writing, preserves
unrelated configuration, creates backups, tracks managed ownership, rolls back failed validation, refuses
unsafe symlink targets, and never approves its own trust prompts.

Lifecycle-generated SessionStart bookkeeping cannot mask the prior meaningful user/assistant interaction.
Hooks are best effort: they can be disabled, untrusted, interrupted, timed out, or absent after abnormal
termination. Firm commitments still require an explicit `record_commitment` tool call.

Automated package, installer, adapter, MCP, privacy, and lifecycle coverage exists. Real Codex CLI/desktop
trust, UI, tool and skill discovery, lifecycle delivery, and model behavior were not tested for v0.1.0.
ChatGPT web cannot access TemporalThread's local stdio process.

## Privacy and security model

| Mode | Stored message data |
| --- | --- |
| `metadata-only` | Identifiers, timestamps, timezone/offset, and hash |
| `temporal-references-only` | Metadata plus locally matched temporal phrases/resolutions; default |
| `full-local-history` | Metadata, references, preview, and complete text; explicit opt-in only |

Default smoke tests verify that complete synthetic prompt markers are absent from SQLite. Hook context is
bounded, inputs are validated, MCP stays local over stdio, and logs/errors do not include message text.
Local files remain protected by the user's operating-system account and filesystem controls;
TemporalThread is local-first, not anonymous.

## Supported platforms and requirements

- Node.js 24 or newer.
- pnpm 11.9.0 for source and release workflows.
- The released source was validated locally on macOS. Historical cross-platform evidence does not replace
  exact-release validation on Linux or Windows.
- `better-sqlite3` uses a native binary and may require a supported native toolchain when no compatible
  prebuild is available.
- Real Codex host compatibility remains uncertified.

## Uninstall and deletion

`temporalthread integrate codex uninstall --scope <project|user> --yes` removes only managed integration
content and preserves the TemporalThread database. `temporalthread purge --yes` is the separate explicit
data deletion action. Stop clients before copying or inspecting SQLite/WAL/SHM files.

## Known limitations

- Automatic capture is best effort and cannot guarantee every message or a durable session-end event.
- The English parser covers documented MVP phrases, not unrestricted natural language.
- Vague phrases remain fuzzy or unresolved rather than receiving fabricated precision.
- No import, cloud sync, reminder delivery, web dashboard, or automatic commitment completion exists.
- OpenCode live automation and real Codex host trust are not certified for v0.1.0.
- Claude Code support remains partial; Ollama is an example-client path, not native MCP hosting.
- Byte-for-byte release artifact reproducibility across operating systems is not established.
- The initial no-CI npm release does not claim npm provenance.
- Publication of an initial MVP is not evidence of production readiness.

## Checksums, manifest, and SBOM

The GitHub release contains all eight npm tarballs plus:

- `SHA256SUMS`, with one SHA-256 checksum for each tarball;
- `release-manifest.json`, bound to source commit
  `5056916c602752632f16fe61bebd814454575c3c`; and
- `temporalthread-v0.1.0.spdx.json`, an SPDX 2.3 SBOM for the eight-package production graph.

The annotated `v0.1.0` tag and release assets are treated as immutable release records. The SBOM and
tarballs are not signed, and this initial interactive publication does not claim npm provenance.

## Upgrade notes

This is the initial version, so there is no earlier published schema to upgrade. Configuration and database
migrations are versioned, and installers refuse silent downgrades. Back up the database plus WAL/SHM files
only after all clients stop.
