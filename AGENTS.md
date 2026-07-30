# TemporalThread AI agent handoff

This file is the operating contract and project handoff for every AI coding agent working on TemporalThread. Read it before changing code, tests, documentation, dependencies, workflows, releases, or repository settings.

## Project purpose

TemporalThread gives local AI agents a persistent sense of time. It is a local-first TypeScript monorepo with an MCP server over stdio, a CLI, deterministic temporal parsing, SQLite persistence, privacy modes, commitment tracking, and host-integration helpers.

The repository is public and v0.1.0 is published. The project is an **initial MVP release**, not a verified
production deployment. Do not describe it as production-ready, fully validated, or fully complete without
real usage and compatibility evidence beyond the initial release checks.

## Current repository state

- Default branch: `main`.
- Development must use a focused branch and pull request.
- Do not commit directly to `main`.
- Do not merge or enable auto-merge without explicit owner approval.
- GitHub Actions workflows are currently removed.
- Local validation is the default development workflow.
- The annotated `v0.1.0` tag points to commit `5056916c602752632f16fe61bebd814454575c3c`.
- All eight v0.1.0 packages are public on npm, and the GitHub release contains the eight tarballs,
  `SHA256SUMS`, `release-manifest.json`, and the SPDX 2.3 SBOM.
- The repository is public and private vulnerability reporting is enabled.
- No later package publication, tag, GitHub release, announcement, or repository-setting change is
  authorized by the v0.1.0 approval.
- Real Codex CLI/desktop UI, trust prompts, skill discovery, lifecycle behavior, and model behavior are not certified.
- The prior MCP SDK/Hono dependency-security blocker was cleared locally in merged pull request `#5`.

## What has been implemented

### Core temporal model

- Agents, projects, sessions, interactions, temporal references, and commitments.
- Exact elapsed-time calculations and local calendar-day differences.
- Deterministic relative-time resolution against the original event timestamp and timezone.
- Handling for documented DST, midnight, leap-day, timezone-offset, vague-expression, and out-of-order cases.
- Injectable clock boundaries for deterministic behavior.

### Privacy and local storage

- Local SQLite persistence.
- Three privacy modes:
  - `metadata-only`;
  - `temporal-references-only` as the default;
  - `full-local-history` as explicit opt-in only.
- Parameterized database access and private local file handling.
- No cloud service, telemetry, embedded LLM, or network listener in the MVP.

### MCP and CLI

Nine MCP stdio tools are implemented:

1. `get_current_time`
2. `record_interaction`
3. `get_temporal_context`
4. `get_last_interaction`
5. `calculate_elapsed_time`
6. `resolve_relative_time`
7. `record_commitment`
8. `list_commitments`
9. `update_commitment`

The CLI includes initialization, server startup, diagnostics, status, configuration, timeline, commitments, generic ingestion, export, SQLite backup, purge, and Codex integration management.

### Commitment lifecycle

- Persisted states are `pending`, `completed`, and `cancelled`.
- Rescheduling is an update action that returns a commitment to `pending` with a new due range.
- Repeated completion, cancellation, and reopening are intended to be idempotent.
- Direct completed-to-cancelled and cancelled-to-completed transitions require reopening first.
- Rescheduling clears terminal timestamps while preserving identity and privacy scope.
- SQLite lifecycle constraints were added for status/timestamp consistency.

### SQLite hardening

- Ordered migrations and migration metadata.
- Migration name and checksum validation.
- SQLite `user_version` synchronization and future-version refusal.
- Integrity, quick, and foreign-key health checks.
- Verified online backup support and point-in-time recovery tooling.
- Startup failure paths intended to close database handles safely.

### Integrations and examples

- Codex package, installer, skill, hooks, doctor, and removal support.
- Claude Code configuration and hook adapter support.
- Experimental OpenCode integration.
- Generic JSON/JSONL ingestion.
- Local Ollama tool-calling example.

### Documentation already present

The repository contains architecture, data-model, privacy, security, integration, recovery, release-gate, roadmap, and phase-report documentation. Some older phase documents are historical evidence and may describe CI or release processes that are no longer active.

## Development review status

The focused review of commitment lifecycle, migration, health-check, backup, and recovery changes was
completed in pull request `#3` and merged as `e07439e`. Confirmed defects were corrected without adding CI,
release automation, or roadmap features.

The final local validation used Node.js 24.14.0 and pnpm 11.9.0:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod --audit-level high
```

- frozen install: 12 workspace projects, already up to date;
- lint: 143 files checked;
- typecheck: passed;
- tests: 29 files and 168 tests passed;
- build: passed;
- production audit: no known vulnerabilities found.

The supported dependency upgrade was completed in pull request `#5` and merged as `612ba1e`.
`@modelcontextprotocol/sdk` 1.30.0 permits the patched Hono 2.x line, so the obsolete root Hono override was
removed. The secure packed verifier passed for all eight tarballs and nine MCP tools. Independent clean npm
and pnpm consumers both resolved SDK 1.30.0, `@hono/node-server` 2.0.12, and `fast-uri` 3.1.4, with zero
production audit findings. This is local dependency-security evidence, not release authorization.

Specialized scripts such as packed-package verification, host-neutral MCP verification, SQLite recovery verification, clean-source verification, artifact generation, and SBOM generation are not normal per-change checks. Run them only for a justified release candidate and only after owner approval.

### Future fixes

When local validation fails:

1. Inspect the first failure.
2. Identify the root cause.
3. Make the smallest correction.
4. Rerun only the relevant command.
5. Rerun the essential local validation once after fixes.
6. Update the same PR.

Do not start new phases, unrelated refactors, large test expansions, or infrastructure work while fixing a specific failure.

### Owner review and merge

- Present the PR with a plain summary, files changed, risks, and local results.
- Do not merge automatically.
- Do not enable auto-merge.
- Wait for explicit owner approval before merging.

## Post-release status

The v0.1.0 publication gates are complete. The project is still not production-ready because an initial
package release is not evidence of broad production operation:

- real Codex CLI/desktop trust, UI, skill discovery, lifecycle delivery, and model behavior remain not tested;
- the exact released commit does not have current Linux or Windows validation evidence;
- no sustained real-user reliability, upgrade, support, or incident-response history has been recorded;
- byte-for-byte release artifact reproducibility across operating systems is not established; and
- the initial no-CI npm release does not claim provenance.

Real Codex host certification is currently deferred. Documentation may claim automated package and adapter coverage, but must not claim verified Codex UI, trust, skill, hook, lifecycle, or model compatibility.

## Planned features not included in the current MVP

These are future roadmap items, not missing work that should be added automatically:

- JSON import with schema-version and conflict handling;
- broader locale-aware temporal grammar;
- retention policies and more granular purge/export scopes;
- authenticated Streamable HTTP transport;
- encrypted-at-rest storage after a cross-platform key-management design;
- additional host adapters;
- broader live compatibility suites.

Do not add any of these without a separate owner-approved scope.

## GitHub Actions and CI resource policy

The owner reported that approximately 200 GitHub Actions minutes/runs were consumed in one day through repeated failing runs and multi-platform jobs. That resource use was unacceptable and must not be repeated.

Current policy:

- No GitHub Actions workflow exists now.
- Never add, restore, or enable CI without explicit owner approval first.
- Before requesting approval, explain the exact trigger, job count, operating systems, commands, timeout, expected frequency, and estimated resource use.
- Local validation is the default for this solo-maintainer project.
- A failure is not permission to add more jobs, more operating systems, more retries, or more workflows.

When the owner explicitly approves CI, **minimal CI** means at most:

- one workflow;
- one Ubuntu job;
- no operating-system matrix;
- no scheduled trigger;
- no release-artifact or SBOM generation;
- no automatic publication;
- no repeated retries;
- a strict timeout;
- only the commands the owner approved, normally lint, typecheck, test, and build.

Prefer manual `workflow_dispatch` unless the owner explicitly approves push or pull-request triggers. After one failed run, stop and inspect the failure. Do not repeatedly rerun or add more jobs to diagnose it.

## Testing policy

- Tests are useful, but do not add tests merely to increase a count or coverage percentage.
- Add or change tests only for a confirmed defect, a user-visible behavior change, a security boundary, or a critical regression.
- Keep tests deterministic and use `FakeClock` for time-dependent assertions.
- Do not create large test matrices for a small fix.
- Do not use GitHub Actions as a substitute for understanding a local failure.
- Do not run broad specialized verification when a narrow local command is enough.

## Coding boundaries

- Preserve the separation between clock, parser, storage, core service, MCP transport, CLI, and integrations.
- Keep MCP local over stdio. Do not add a listener or remote service without an approved design and security review.
- Keep `temporal-references-only` as the default privacy mode.
- Never enable `full-local-history` implicitly.
- Validate public inputs strictly.
- Parameterize database queries.
- Never include complete message text, credentials, private paths, or database contents in logs and errors.
- Treat host hooks as best effort.
- Do not parse undocumented transcript formats.
- Do not claim automatic capture when a host does not expose a reliable documented event.

## Prohibited actions without explicit approval

Do not:

- commit directly to `main`;
- merge or auto-merge a PR;
- add CI, GitHub Actions, scheduled automation, or release workflows;
- publish npm packages;
- create Git tags or GitHub releases;
- change repository visibility;
- create release artifacts or SBOMs;
- modify npm organizations, ownership, 2FA, or credentials;
- add large feature phases, dependency rewrites, forks, vendored packages, or security workarounds;
- claim the project is production-ready based only on implemented code or documentation.

## Required status language

Use evidence-based wording:

- `implemented` means code exists;
- `locally validated` means the exact local commands passed and results were recorded;
- `reviewed` means the relevant PR diff was examined;
- `release-ready` means all technical, security, packaging, and owner-approval gates passed;
- `production-ready` must not be used until release readiness and real usage evidence exist.

Current accurate status:

> Core MVP functionality is implemented and TemporalThread v0.1.0 is published on npm and GitHub. The
> release includes checksums, a manifest, and an SPDX SBOM. The project is not production-ready: real Codex
> host behavior, current Linux/Windows evidence, and sustained production usage remain unverified.

## Exact next work item

No implementation phase is queued automatically. Wait for an owner-selected follow-up such as real-host
certification, v0.1.0 feedback triage, or a separately scoped next release.

No CI, GitHub Actions, new roadmap features, release automation, direct changes to `main`, or additional
public release actions are authorized by the completed v0.1.0 work.
