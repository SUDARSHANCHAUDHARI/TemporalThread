# TemporalThread v0.1.0 release notes (draft)

Status: release candidate approved; exact artifacts, npm packages, tag, and GitHub release pending

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

Automated package/contract tests and the Phase 4.2 isolated certification-kit safety suite pass, but real
current Codex CLI/desktop trust, discovery, and lifecycle delivery remain a manual release gate. The kit
never launches Codex or approves trust. ChatGPT web cannot access TemporalThread's local stdio process.

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
- The current candidate is locally validated on macOS. Historical cross-platform evidence does not replace
  exact-candidate validation on Linux or Windows.
- `better-sqlite3` uses a native binary and may require a supported native toolchain when no compatible
  prebuild is available.
- Current Codex host compatibility still requires the documented manual certification.

## Installation state

After publication, install the CLI with `npm install --global temporalthread`. Prior dry-run artifacts are
superseded and must not be used as a release candidate.

The intended registry model is the `temporalthread` CLI plus seven public
`@sudarshanchaudhari/temporalthread-*` runtime packages under the maintainer's personal npm scope. The prior
dry-run artifacts are superseded and must not be installed or published as a release candidate.

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
- The SDK 1.30.0 packed npm and pnpm consumer graphs resolve patched Hono 2.x releases. The release verifier
  audits both managers and rejects any mixed or vulnerable nested Hono copy.
- Real Codex host behavior remains not certified; the release claim is limited to automated package,
  installer, adapter, MCP, privacy, and lifecycle coverage.

## Upgrade notes

This is the initial version, so there is no earlier persisted schema to upgrade. Configuration and database
migrations are versioned, and installers refuse silent downgrades. Back up the database plus WAL/SHM files
only after all clients stop.

## Checksums

The final release must attach `SHA256SUMS` and `release-manifest.json` generated and verified from the exact
clean release commit.

## SBOM and provenance

The release tooling produces `temporalthread-v0.1.0.spdx.json` (SPDX 2.3) for the eight-package production
graph. This no-CI initial release uses interactive write-protection 2FA and does not claim npm provenance.

## Release status

This draft becomes final after exact-commit local release verification, artifact/checksum/SBOM verification,
and successful publication. Validation claims remain limited to the operating systems and host behavior
actually tested.
