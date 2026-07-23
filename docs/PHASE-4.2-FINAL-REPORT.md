# Phase 4.2 final report

Report date: 2026-07-23

## Decision

**Phase 4.2: MANUAL CERTIFICATION KIT READY**

**v0.1.0: NO-GO**

The safe setup/check/cleanup tooling and owner documentation are complete and automated evidence passes.
Real Codex host behavior, npm scope authority, npm 2FA, recovery readiness, and every public-state approval
remain manual or blocked. The packed SDK/Hono dependency graph remains the technical release blocker.

## Commits

- Baseline commit: `c074628fa97b85d34cd18431b97949bf6de7cf72`
- Requested certification-kit commit: `2cc9fe74eb3270cdaec613d42c0f74a6ddc82205`
  (`chore: prepare manual release certification`)
- Final documentation implementation commit, excluding this evidence-only report:
  `3855ad4d3f857416b2167c8b4172cea3fe49d4fc`
- Final implementation commit: `a8dbc21dc60c9f95829d1b1c63224f7009523f15`
- Final report commit: the commit that introduces this file; its exact hash is reported in the Phase 4.2
  handoff because a commit cannot contain its own hash.

The clean certification exercise exposed and corrected four harness issues after the requested commit:
repository-local pnpm cache ignores, direct MCP client dependency declaration, canonical instant formatting,
and Windows device/cross-root path comparison.

## Repository changes

Created:

- `docs/PHASE-4.2-BASELINE.md`
- `docs/UPSTREAM-DEPENDENCY-WATCH.md`
- `docs/NPM-AUTHORITY-AND-2FA-CHECKLIST.md`
- `docs/NPM-SCOPE-HUMAN-ACTIONS.md`
- `docs/LIVE-CODEX-CERTIFICATION-RESULTS.md`
- `docs/V0.1.0-RELEASE-AUTHORIZATION.md`
- `docs/PHASE-4.2-OWNER-RUNBOOK.md`
- `docs/PHASE-4.2-SECURITY-REVIEW.md`
- `scripts/prepare-live-codex-certification.mjs`
- `scripts/check-live-codex-certification.mjs`
- `scripts/cleanup-live-codex-certification.mjs`
- `scripts/live-codex-certification-mcp.mjs`
- `scripts/live-codex-certification-utils.mjs`
- `scripts/live-codex-certification-utils.d.mts`
- `tests/unit/live-codex-certification.test.ts`

Modified:

- `.gitignore`
- `CHANGELOG.md`
- `package.json`
- `docs/PHASE-4-FINAL-REPORT.md`
- `docs/PHASE-4.1-DEPENDENCY-SECURITY-REPORT.md`
- `docs/V0.1.0-GO-NO-GO.md`
- `docs/LIVE-CODEX-CERTIFICATION.md`
- `docs/NPM-DISTRIBUTION-PLAN.md`
- `docs/V0.1.0-RELEASE-COMMANDS.md`
- `docs/RELEASE-NOTES-v0.1.0-DRAFT.md`

## Automated verification

| Evidence | Result |
| --- | --- |
| Node.js / pnpm | Node.js 24.14.0; pnpm 11.9.0 |
| Formatting | PASS; 135 files |
| Lint | PASS; 135 files |
| Typecheck | PASS |
| Tests | PASS; 25 files, 136 tests |
| Focused certification tests | PASS; 18 tests |
| Build | PASS |
| Source production audit | PASS; no known vulnerability |
| Functional packed verification | PASS; eight packages, 48 integration files, eight plugin files, nine MCP tools, uninstall/database preservation/purge |
| Clean copied-source verification | PASS; frozen install, build, CLI, database, doctor, nine tools, lifecycle, uninstall, preservation, purge |
| Secure packed gate | Expected fail-closed; npm and pnpm resolve SDK 1.29.0 and Hono 1.19.14 |
| Diff/local link/secret checks | PASS |
| Release artifacts/SBOM after secure failure | None |

Final normal CI run:

- Run: `29977886632`
- Commit: `a8dbc21dc60c9f95829d1b1c63224f7009523f15`
- Ubuntu / Node 24: PASS
- macOS / Node 24: PASS
- Windows / Node 24: PASS
- Every platform passed tests, build, normal packed Codex integration, and production audit.

An earlier Windows run exposed path-namespace defects in the new tests. Those defects were corrected; the
final Windows job passed the extended-device and cross-root regression coverage.

## Upstream dependency status

Read-only evidence on 2026-07-23 still shows:

- latest stable `@modelcontextprotocol/sdk`: 1.29.0;
- declared Hono adapter range: `@hono/node-server: ^1.19.9`;
- clean npm and pnpm consumers resolve Hono 1.19.14;
- first patched Hono adapter version for `GHSA-frvp-7c67-39w9`: 2.0.5;
- current Hono stable release: 2.0.11; and
- MCP TypeScript SDK issue `#2531`: open.

No dependency was changed. A separate Phase 4.3 is required after a secure stable SDK release appears.

## npm authority and account prerequisites

| Requirement | Phase 4.2 status |
| --- | --- |
| Authenticated npm account | READ-ONLY VERIFIED |
| Intended npm username | READ-ONLY VERIFIED as `sudarshanchaudhari` |
| `@temporalthread` scope ownership | BLOCKED; no organization membership or readable scope authority was found |
| Publish permission | BLOCKED |
| Eight intended names | READ-ONLY VERIFIED absent at the check time; not reserved |
| Write-protection 2FA | MANUAL |
| Recovery codes/readiness | MANUAL; no code was requested, read, printed, or stored |
| Recovery account access | MANUAL |
| Backup trusted owner | MANUAL owner decision |
| Public scoped access / trusted publishing | BLOCKED until package ownership exists |

No npm organization, package, member, role, token, 2FA setting, recovery setting, or trusted publisher was
created or modified.

## Certification-kit evidence

Preparation from clean commit `16f8e1ad6642a41fd8ed482d67baf4c73e24a88f` produced one disposable
system-temp root and reported:

- certification kit: PREPARED;
- dependency security: BLOCKED;
- release use: PROHIBITED;
- MCP tools: exactly nine;
- privacy: PASS;
- real user directories modified: false;
- host launched: false; and
- trust approved: false.

The controlled lifecycle then passed:

1. installed check and automated adapter lifecycle;
2. project-scoped uninstall;
3. uninstalled check with database and unrelated configuration preserved;
4. explicit purge under Node.js 24;
5. purged check with zero interactions and commitments;
6. guarded marker/UUID-bound cleanup; and
7. a second cleanup reporting the root already removed.

The temporary project used a spaces/Unicode path, isolated `HOME`, `USERPROFILE`, `CODEX_HOME`,
`TEMPORALTHREAD_HOME`, npm cache, pnpm store, and process temp. The privacy marker was absent from prohibited
database/export fields. The test host was not launched, no trust prompt was approved, no real configuration
was modified, and no temporary path or marker was committed.

## Manual and authorization status

Live Codex CLI/desktop certification is **MANUAL REQUIRED**, not PASS. The following were not observed:

- project and hook trust prompts;
- MCP and skill visibility in the real Codex UI;
- model use of restored temporal context;
- real desktop behavior; and
- IDE fallback behavior.

Every public action remains `NOT APPROVED` or `BLOCKED` in
`docs/V0.1.0-RELEASE-AUTHORIZATION.md`. Technical evidence does not imply owner approval.

## Exact next human action

From a clean current `main` checkout with Node.js 24 and pnpm 11.9.0, run:

```sh
pnpm run certify:codex:prepare
```

Then review the generated files and follow `docs/PHASE-4.2-OWNER-RUNBOOK.md` to launch Codex manually,
approve only expected trust prompts, and record privacy-safe results in
`docs/LIVE-CODEX-CERTIFICATION-RESULTS.md`. This may complete host evidence but cannot authorize publication
or clear the dependency blocker.

Separately, the owner must verify npm scope authority, write-protection 2FA, and recovery readiness using
`docs/NPM-AUTHORITY-AND-2FA-CHECKLIST.md`. Do not reveal recovery codes.

## Public-state confirmation

- npm publication: NOT PERFORMED
- npm scope/name reservation: NOT PERFORMED
- Git tag: none created or pushed
- GitHub release: none created
- release artifact/SBOM: none generated after the blocked secure gate
- repository visibility: PRIVATE
- public announcement: NOT PERFORMED

Phase 4.2 is complete as **MANUAL CERTIFICATION KIT READY**. v0.1.0 remains **NO-GO**.
