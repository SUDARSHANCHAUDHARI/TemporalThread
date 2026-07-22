# TemporalThread v0.1.0 release notes (draft)

Status: UNRELEASED; npm packages, tag, and GitHub release do not exist yet

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

## Codex integration

Codex support combines local MCP tools, the `temporal-awareness` skill, and documented `SessionStart`,
`UserPromptSubmit`, and `Stop` hooks. The installer validates the MCP process before writing, preserves
unrelated configuration, creates backups, tracks managed ownership, rolls back failed validation, refuses
unsafe symlink targets, and never approves its own trust prompts.

Lifecycle-generated SessionStart bookkeeping cannot mask the prior meaningful user/assistant interaction.
Hooks are best effort: they can be disabled, untrusted, interrupted, timed out, or absent after abnormal
termination. Firm commitments still require an explicit `record_commitment` tool call.

Automated package/contract tests pass, but real current Codex CLI/desktop trust, discovery, and lifecycle
delivery remain a manual release gate. ChatGPT web cannot access TemporalThread's local stdio process.

## Privacy and security model

| Mode | Stored message data |
| --- | --- |
| `metadata-only` | Identifiers, timestamps, timezone/offset, and hash |
| `temporal-references-only` | Metadata plus locally matched temporal phrases/resolutions; default |
| `full-local-history` | Metadata, references, preview, and complete text; explicit opt-in only |

Default release-candidate smoke tests verify that the complete synthetic prompt marker is absent from SQLite.
Hook context is bounded, inputs are validated, MCP stays local over stdio, and logs/errors do not include
message text. Local files remain protected by the user's operating-system account and filesystem controls;
TemporalThread is local-first, not anonymous.

## Supported platforms and requirements

- Node.js 24 or newer.
- pnpm 11.9.0 for source/release-candidate workflows.
- Linux, macOS, and Windows are covered by CI and packed installation tests.
- `better-sqlite3` uses a native binary and may require a supported native toolchain when no compatible
  prebuild is available.
- Current Codex host compatibility still requires the documented manual certification.

## Installation state

The package set is not published. Until publication is explicitly approved, use only the documented source
install. Do not present `npm install temporalthread` as an active public installation method yet, and do not
use a prior dry-run artifact as a release candidate.

The intended registry model is the `temporalthread` CLI plus seven public `@temporalthread/*` runtime
packages. Ownership of the `@temporalthread` npm scope must be established before release. The prior dry-run
artifacts are superseded and must not be installed or published as a release candidate because their fresh
consumer graph resolves vulnerable `@hono/node-server@1.19.14`.

## Uninstall and deletion

`temporalthread integrate codex uninstall --scope <project|user> --yes` removes only managed integration
content and preserves the TemporalThread database. `temporalthread purge --yes` is the separate explicit data
deletion action. Stop clients before copying or inspecting SQLite/WAL/SHM files.

## Known limitations

- Automatic capture is best effort and cannot guarantee every message or a durable session-end event.
- The English parser covers documented MVP phrases, not unrestricted natural language.
- Vague phrases remain fuzzy or unresolved rather than receiving fabricated precision.
- No import, cloud sync, reminder delivery, web dashboard, or automatic commitment completion exists.
- OpenCode live automation and real Codex host trust are not yet certified for this release candidate.
- Claude Code support remains partial; Ollama is an example-client path, not native MCP hosting.
- Byte-for-byte release artifact reproducibility across operating systems is not established.
- The current stable MCP TypeScript SDK range resolves a vulnerable Hono server in packed consumers; release
  remains blocked until a stable dependency update carries Hono 2.0.10 or newer.

## Upgrade notes

This is the initial version, so there is no earlier persisted schema to upgrade. Configuration and database
migrations are versioned, and installers refuse silent downgrades. Back up the database plus WAL/SHM files
only after all clients stop.

## Checksums

The final release must attach `SHA256SUMS` and `release-manifest.json` from the selected clean, successful
release-dry-run artifact. Do not copy local dirty-tree checksums into the final release.

## SBOM and provenance

The release tooling can produce `temporalthread-v0.1.0.spdx.json` (SPDX 2.3) for the eight-package production
graph. The prior SBOM is superseded; the security follow-up correctly stopped before creating a new candidate
SBOM. The final public npm publication should use a protected GitHub-hosted job with npm provenance and,
after bootstrap, trusted publishing/OIDC. No provenance, signed tag, or release attestation exists yet.

## Release status

This draft becomes final only after npm scope/2FA verification, green release-dry-run jobs on Ubuntu/macOS/
Windows, real Codex certification, explicit visibility/publication/release approval, and replacement of this
status with the actual release date and artifact checksums.
