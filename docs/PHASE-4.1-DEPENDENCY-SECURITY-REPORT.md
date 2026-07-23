# Phase 4.1 dependency security report

Report date: 2026-07-23 (Asia/Bangkok)

Final status: **DEPENDENCY BLOCKER REMAINS**

## Scope and repository state

| Item | Result |
| --- | --- |
| Baseline commit | `8c9c843fc474527e4315dc579420cb3f09b5e3ad` |
| Final tested implementation commit | `9cfeff15f3879fa34129efec1a26b3c7009c4618` |
| Branch | `main` |
| Repository | `SUDARSHANCHAUDHARI/TemporalThread` |
| Visibility | PRIVATE, reverified after CI |
| Package version | 0.1.0, unreleased |
| npm publication | None; all eight intended registry URLs returned HTTP 404 |
| GitHub release | None |
| Local/remote Git tags | None |

Phase 4.1 changed only packed dependency verification, focused tests, and release/security documentation. It
did not add an integration, change the runtime architecture, alter dependency manifests or the lockfile,
weaken a gate, add an exclusion, change a workflow, publish, tag, release, or change repository visibility.

## Advisory result

Authoritative data was reverified on 2026-07-22:

| Field | Result |
| --- | --- |
| Advisory | [GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9) |
| Package | `@hono/node-server` |
| Affected | `<2.0.5` |
| Patched | `>=2.0.5` |
| Severity | Moderate, CVSS 5.9 |
| Attack requirements | Windows static-file server using `serveStatic` behind prefix middleware; encoded `%5C` can bypass the protected prefix |
| TemporalThread reachability | Not directly reachable: TemporalThread is stdio-only and imports no Hono static/HTTP API |
| Release impact | Blocking because the package is in the production graph and both clean-consumer audits fail |

`@modelcontextprotocol/sdk@1.29.0` remains the latest stable npm release. It is MIT, declares Node.js 18+
and `@hono/node-server: ^1.19.9`. `@hono/node-server@2.0.11` is current, MIT, and requires Node.js 20+.
TemporalThread requires Node.js 24, but it cannot unilaterally widen the SDK's support contract. Upstream
issue [`#2531`](https://github.com/modelcontextprotocol/typescript-sdk/issues/2531) remains open.

Phase 4.2 rechecked these sources read-only on 2026-07-23. SDK 1.29.0 is still `latest`, its Hono range is
still `^1.19.9`, Hono 2.0.11 remains current with 2.0.5 as the first advisory fix, and issue #2531 remains
open. No dependency or lockfile was changed. See `docs/UPSTREAM-DEPENDENCY-WATCH.md`.

## Root cause and exact graph

Both SDK-bearing publishable manifests declare SDK 1.29.0:

```text
temporalthread@0.1.0
├─ @temporalthread/mcp-server@0.1.0
│  └─ @modelcontextprotocol/sdk@1.29.0
│     └─ @hono/node-server@1.19.14
└─ @temporalthread/codex-integration@0.1.0
   └─ @modelcontextprotocol/sdk@1.29.0
      └─ @hono/node-server@1.19.14
```

The SDK range `^1.19.9` excludes every 2.x release, including the first fix at 2.0.5 and TemporalThread's
accepted source floor at 2.0.10. Version 1.19.14 is the highest compatible 1.x release. npm can dedupe the
identical instance, while pnpm can display the separate package paths; both managers still install 1.19.14.

The private root override changes the source workspace to Hono 2.0.10. npm and pnpm apply overrides as
root-project policy; that private root is not the root of a registry consumer. Clean consumers build new
lockfiles, so neither the root override nor `pnpm-lock.yaml` controls the distributed graph.

## Consumer and audit evidence

All eight fresh tarballs were installed outside the repository in independent npm and pnpm consumers. npm
used an isolated cache and user config. pnpm used an isolated store and test-only mappings from the eight
unpublished package names to their tarballs; no fixture declared or overrode the SDK, Hono, or `fast-uri`.

| Evidence | npm consumer | pnpm consumer |
| --- | --- | --- |
| All eight TemporalThread packages | PASS; each exactly 0.1.0 | PASS; each exactly 0.1.0 |
| SDK versions | 1.29.0 | 1.29.0 |
| Hono node-server versions | 1.19.14 | 1.19.14 |
| `fast-uri` versions | 3.1.4 | 3.1.4 |
| Secure minimum | FAIL | FAIL |
| Production audit | FAIL; five propagated moderate findings | FAIL; one underlying moderate advisory |
| High/critical findings | 0/0 | 0/0 |
| Clean-consumer security | **FAIL** | **FAIL** |

The count difference is package-manager reporting, not different exposure. Both results originate from
GHSA-frvp and both make `packedDependencySecurity` false.

## Chosen solution and rejected alternatives

Chosen action: wait for a stable supported SDK range and preserve NO-GO. This is the minimal supportable
decision, not a release fix.

- Stable SDK upgrade: preferred, but unavailable; 1.29.0 is still latest and constrained to Hono 1.x.
- Direct Hono dependency: rejected after npm installed direct 2.0.11 **and** nested 1.19.14; audit stayed
  failed.
- npm/pnpm overrides: rejected because only the consumer root controls them.
- `npm-shrinkwrap.json`: not selected for a mixed npm/pnpm CLI-plus-library graph; it would pin consumer
  resolution and security updates without cross-manager equivalence.
- Bundling: rejected as a packaging/SBOM/license/ESM/Windows/native-module redesign.
- Fork, vendor, or patch: rejected because it transfers upstream compatibility and security maintenance to
  TemporalThread.

No manifest or lockfile changed. The root source override remains necessary for a clean development graph,
but is not presented as a publication fix.

## Verifier and regression changes

The packed verifier now:

- builds and installs all eight tarballs in independent npm and pnpm consumers;
- omits the former direct root SDK dependency that distorted the consumer shape;
- isolates the npm cache/user config and pnpm store;
- inspects every SDK, Hono, `fast-uri`, and TemporalThread package version;
- requires every TemporalThread package to resolve exactly 0.1.0;
- runs both managers' production audits at a low threshold and fails on any finding;
- rejects missing, prerelease, wrong-major, or mixed secure/vulnerable versions;
- resolves the MCP smoke client from the packed MCP server's actual dependency context;
- preserves sanitized diagnostics and real CLI/MCP/Codex/privacy/export/uninstall/purge checks;
- launches npm through a fixed `cmd.exe /d /s /c npm.cmd` argument vector on Windows.

Four focused policy tests cover a clean graph, a mixed vulnerable graph, missing/non-release versions, audit
failure, and success/failure output state. The real packed verifier supplies integration coverage for clean
npm/pnpm caches, all eight tarballs, spaces/Unicode paths, CLI version/help/init, nine-tool MCP startup, Codex
install/doctor, uninstall/database preservation, purge, and child-process cleanup. Existing unit coverage
continues to verify the Windows command-shim contract.

## Local quality gates

Toolchain: Node.js 24.14.0, pnpm 11.9.0.

| Gate | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS; 12 workspaces, lockfile current |
| `pnpm format:check` | PASS; 128 supported files |
| `pnpm lint` | PASS; 128 supported files |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS; 24 files, 118 tests |
| `pnpm build` | PASS |
| `pnpm verify:codex-package` | PASS functionally; eight tarballs, 48 integration files, eight plugin files, nine tools |
| `pnpm verify:codex-package -- --require-secure-dependencies` | Expected FAIL; both consumers resolve Hono 1.19.14 and fail audit |
| `pnpm verify:clean-source` | PASS; isolated install/build/CLI/MCP/Codex/uninstall/purge |
| `pnpm run audit` | PASS; no known source production vulnerability |
| `git diff --check` | PASS |
| Focused secret/private-path scan | PASS; no value or personal machine path found |

`pnpm release:artifacts`, `pnpm release:sbom`, and `pnpm verify:release-artifacts` were intentionally not run
after the secure gate failed. The phase generated no new candidate checksums or SBOM.

Warnings recorded rather than hidden:

- the initial desktop shell selected unsupported Node.js 20.20.2; every gate was rerun with bundled Node.js
  24.14.0;
- clean install exploration reported the existing `prebuild-install@7.1.3` deprecation and npm lifecycle
  approval guidance for native `better-sqlite3`; npm package loading/CLI version and the full pnpm packed
  runtime smoke passed;
- one full test invocation overlapped a still-running parallel invocation and hit the existing five-second
  executable-probe timeout; the focused test passed immediately and the clean full rerun passed 118/118.

## GitHub CI and release dry run

Normal CI run
[`29940659504`](https://github.com/SUDARSHANCHAUDHARI/TemporalThread/actions/runs/29940659504) tested exact
commit `9cfeff1` and passed:

| Platform | Result | Job |
| --- | --- | --- |
| Ubuntu | PASS | `88993371890` |
| macOS | PASS | `88993371966` |
| Windows | PASS | `88993371918` |

The manual non-publishing release dry run
[`29940910728`](https://github.com/SUDARSHANCHAUDHARI/TemporalThread/actions/runs/29940910728) also used exact
commit `9cfeff1`. Every platform passed frozen install, format/no-diff, lint, typecheck, 118 tests, build, all
eight tarball installs, real packed CLI/MCP/Codex smoke, and then failed intentionally at the dependency
security decision:

| Platform | Result | Job |
| --- | --- | --- |
| Ubuntu | EXPECTED FAIL-CLOSED at security gate | `88994228831` |
| macOS | EXPECTED FAIL-CLOSED at security gate | `88994228934` |
| Windows | EXPECTED FAIL-CLOSED at security gate | `88994228856` |

All three reported SDK 1.29.0, Hono node-server 1.19.14, `fast-uri` 3.1.4, npm audit failure, pnpm audit
failure, and `packedDependencySecurity: false`. All downstream clean-source/artifact/SBOM/audit/upload steps
were skipped. GitHub's run-artifact API reports `total_count: 0`.

## Artifacts, SBOM, and residual risks

| Item | Result |
| --- | --- |
| Fresh release artifacts | 0 |
| Artifact IDs | None |
| Fresh tarball checksums | None; not generated |
| Fresh SBOM | None; blocked before generation |
| Historical Phase 4 artifacts | Superseded; not reusable or publishable |

Residual technical risk: the clean npm/pnpm distribution contains Hono node-server 1.19.14 until upstream
widens the SDK range or a separately approved distribution design replaces the dependency path. Practical
reachability is low in TemporalThread's stdio-only implementation, but that does not change the release gate.

Remaining manual blockers after a future dependency fix:

1. establish ownership of the `@temporalthread` npm scope;
2. verify npm 2FA and recovery access;
3. complete real Codex CLI/desktop host certification;
4. obtain explicit approval before publication, public visibility, tagging, release creation, or announcement.

Nothing was published. No GitHub release or Git tag was created. The repository remains private.

**DEPENDENCY BLOCKER REMAINS**
