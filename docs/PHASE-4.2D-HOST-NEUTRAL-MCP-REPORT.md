# Phase 4.2D host-neutral MCP report

Report date: 2026-07-26

## Decision

**Phase 4.2D implementation: COMPLETE**

**Final three-platform workflow result: NOT YET CONFIRMED**

**v0.1.0: NO-GO**

Phase 4.2D adds a host-neutral end-to-end certification path. It launches the real TemporalThread stdio server through the MCP TypeScript client without Codex, Claude Code, OpenCode, or another agent-specific host. This validates the product’s core MCP contract independently from deferred manual host certification.

## Isolation

The certification creates one disposable system-temporary root containing:

- isolated `HOME` and `USERPROFILE`;
- isolated `TEMPORALTHREAD_HOME`;
- isolated process temp directories;
- a project path containing spaces and Unicode; and
- a generic-only initialization.

It removes API-key and npm-token environment variables from child processes, suppresses private diagnostic forwarding, modifies no real host configuration, and deletes the temporary root in `finally`.

## Real protocol coverage

The script starts `temporalthread start` through `StdioClientTransport` and uses a real MCP `Client`. It verifies the exact set of nine tools:

1. `get_current_time`
2. `record_interaction`
3. `get_temporal_context`
4. `get_last_interaction`
5. `calculate_elapsed_time`
6. `resolve_relative_time`
7. `record_commitment`
8. `list_commitments`
9. `update_commitment`

Every tool is called during the controlled scenario.

## Controlled scenario

The certification verifies:

- `Asia/Bangkok` current-time context;
- a deterministic 99-hour elapsed interval and four-calendar-day difference;
- historical resolution of “tomorrow”;
- interaction persistence with an explicit idempotency key;
- duplicate interaction retry returning the original interaction ID;
- default `temporal-references-only` privacy behavior;
- no raw text in `get_last_interaction`;
- commitment creation and listing;
- commitment completion;
- repeated completion retaining the first completion timestamp;
- completed commitment rescheduling back to pending;
- cancellation and safe rejection of direct cancelled-to-completed transition;
- strict rejection of an unknown MCP input field;
- temporal context selecting the meaningful interaction; and
- persistence after closing the first MCP client and starting a second server process.

The final database inspection verifies the private marker is absent and no `.codex` or `.claude` project configuration was created.

## Commands and CI

Local command:

```sh
pnpm build
pnpm verify:host-neutral-mcp
```

The normal CI workflow runs this command after build on:

- Ubuntu
- macOS
- Windows

It runs before the packed Codex integration verification and production dependency audit.

## Implementation

Key files:

- `scripts/verify-host-neutral-mcp.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- `README.md`

## Interpretation

This phase provides automated proof for TemporalThread’s generic stdio MCP behavior. It does not prove:

- Codex authentication or trust prompts;
- Codex/Claude/OpenCode UI discovery;
- host lifecycle event delivery;
- a model’s decision to call a tool; or
- desktop/IDE-specific integration behavior.

Those claims remain deferred or host-specific. Documentation continues to describe Codex real-host behavior as not tested.

## Remaining blockers

- The final workflow run for the current exact commit must be observed before changing this report to PASS.
- The packed SDK/Hono dependency-security gate remains blocked.
- npm scope authority, write-protection 2FA, recovery readiness, and every public-state approval remain manual or blocked.
- No release artifact, package publication, Git tag, GitHub release, visibility change, or announcement was performed.
