# Phase 2 Baseline

Audit date: 2026-07-20

This document records the repository state before Phase 2 Codex integration work. Existing failures are
reported as observed; they are not treated as Phase 2 results.

## Runtime and workspace

- Required runtime: Node.js 24 or newer.
- Package manager: pnpm 11.9.0.
- Workspace projects: 11 including the private root project.
- Production transport: local MCP over stdio.
- Default privacy mode: `temporal-references-only`.
- Current branch: `feat/initial-mvp`.
- Baseline commit: `e80c10e` (`fix: harden release package contents`).

The workspace contains two applications, five library packages, and three examples:

| Area | Package | Purpose |
| --- | --- | --- |
| CLI | `temporalthread` | User CLI, host adapters, and MCP launch command |
| MCP app | `@temporalthread/mcp-server` | MCP server and stdio transport |
| Library | `@temporalthread/config` | Configuration, paths, validation, and privacy settings |
| Library | `@temporalthread/core` | Temporal continuity service and injected clock |
| Library | `@temporalthread/shared-types` | Entities and public Zod schemas |
| Library | `@temporalthread/storage-sqlite` | SQLite migrations and repository |
| Library | `@temporalthread/temporal-parser` | Deterministic relative-time parsing |
| Example | `@temporalthread/example-basic-mcp-client` | MCP client example |
| Example | `@temporalthread/example-manual-event-recording` | Embedded/manual recording example |
| Example | `@temporalthread/example-ollama-tool-client` | Ollama tool-calling example |

## Repository structure

- `apps/cli`: the single `temporalthread` executable.
- `apps/mcp-server`: MCP registration and stdio runtime.
- `packages/config`: application configuration and local paths.
- `packages/core`: orchestration, privacy decisions, elapsed time, and compact context.
- `packages/shared-types`: public schemas and domain types.
- `packages/storage-sqlite`: parameterized SQLite persistence and migrations.
- `packages/temporal-parser`: local deterministic time-expression parsing.
- `integrations`: Codex, Claude Code, OpenCode, Ollama, and generic integration material.
- `skills`: early host-specific TemporalThread skills.
- `examples`: runnable MCP, embedded, and Ollama examples.
- `tests`: unit, integration, and end-to-end tests.

The architecture already preserves the required boundaries between clock, parser, storage, core service,
MCP transport, CLI, and host integrations. Phase 2 should extend the adapter and packaging layers instead
of replacing those boundaries.

## Existing MCP tools

The MCP server exposes nine tools:

1. `get_current_time`
2. `record_interaction`
3. `get_temporal_context`
4. `get_last_interaction`
5. `calculate_elapsed_time`
6. `resolve_relative_time`
7. `record_commitment`
8. `list_commitments`
9. `update_commitment`

All tools delegate to the existing `TemporalThreadService`. Read and local-write annotations are present,
and public inputs are validated with Zod.

## Existing CLI commands

The CLI currently provides:

- `init`
- `start`
- `doctor`
- `status`
- `config`
- `timeline`
- `commitments`
- `export`
- `purge`
- `ingest`
- `hook`

There is no `integrate codex` command group yet.

## Existing Codex integration

The Phase 1 prototype contains:

- a project-scoped installer, uninstaller, and doctor under `integrations/codex`;
- a marked TOML block for the `temporal-thread` stdio MCP server;
- `SessionStart`, `UserPromptSubmit`, and `Stop` hooks;
- a project skill at `.agents/skills/temporalthread/SKILL.md`;
- a shared Codex/Claude hook adapter in the CLI;
- installer and hook integration tests.

The prototype proves the basic adapter flow, but it is not the requested production installation
experience. It supports only project scope, edits TOML as text, has no installation manifest or version
policy, and is not packaged as a current official Codex plugin.

## Baseline quality gates

Commands were run independently so that the first failure did not hide later results.

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | All 11 workspace projects were already up to date. |
| `pnpm format:check` | FAIL | Biome traversed globally ignored generated `graphify-out/cache` files and reported 55 formatting errors. |
| `pnpm lint` | FAIL | The same generated tree produced 56 errors and 3 warnings. |
| `pnpm typecheck` | PASS | TypeScript completed with no errors. |
| `pnpm test` | PASS | 13 test files and 49 tests passed. |
| `pnpm build` | PASS | TypeScript project references built successfully. |

`graphify-out/` is machine output and is excluded by the user's global Git ignore, so it does not appear
in `git status`. The repository's Biome configuration does not exclude it. The foundation fix is to keep
generated memory output outside formatting and lint scope, not to modify or commit generated files.

## Missing Phase 2 pieces

- A capability report grounded in current official Codex documentation.
- The official `temporal-awareness` skill and its validation tests.
- An official Codex plugin manifest, bundled skill, MCP configuration, hooks, and marketplace metadata.
- User, project, and manual installation modes.
- Safe parsed TOML merging and removal that preserve unrelated values.
- Dry-run and JSON output.
- Timestamped backups, atomic replacement, rollback, and malformed-config refusal.
- Installation ownership/version manifest and upgrade/no-downgrade handling.
- Nested `temporalthread integrate codex` commands.
- Full doctor coverage, including MCP handshake and tool discovery.
- Bounded hook input, fail-open behavior, safe diagnostics, and lightweight timeouts.
- Compact context that excludes internal identifiers and untrusted raw history.
- Session-stop persistence and stronger event idempotency.
- Packed-artifact installation testing.
- Codex-specific installation, integration, privacy, and troubleshooting documentation.
- The deterministic July 15 to July 19 acceptance workflow.

## Phase 2 technical debt and risks

1. The current hook adapter treats `session_id` and `cwd` as mandatory and throws on incomplete payloads,
   which conflicts with the required fail-open behavior.
2. The current fallback idempotency key hashes complete message text. It should use documented event
   identity fields and safe metadata instead.
3. Compact context currently includes session and commitment IDs. Model-visible context must not expose
   those internal values.
4. `Stop` records an assistant interaction but does not explicitly close the session. Abnormal exits will
   still remain best effort because Codex cannot guarantee delivery of a stop event.
5. Hook output and input are not bounded by an integration-specific maximum.
6. The current installer appends a marked TOML string without parsing the document, validating ownership,
   or rolling back after a failed final validation.
7. The existing skill is named `temporalthread`, is only 17 lines, and does not cover relevance,
   commitment safety, privacy, or failure behavior required by Phase 2.
8. Hook trust is manual and hash-based in Codex. Installation cannot silently approve a hook.
9. The default official hook timeout is 600 seconds; TemporalThread must set a much shorter explicit
   timeout because it is optional lifecycle automation.
10. Official plugins are not available in the IDE extension. The integration must retain direct MCP and
    skill installation as the IDE-compatible fallback.

## Stable foundation decision

Before feature implementation, Phase 2 may make the narrow repository hygiene fix that excludes
`graphify-out`, `_Graphify`, and `_RepoMem` machine output from Biome and Git tracking. No core rewrite or
schema migration is justified by the baseline. Any storage change needed to close sessions must remain a
small service/repository extension with deterministic tests.
