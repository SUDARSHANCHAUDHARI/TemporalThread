# Phase 4 baseline

Captured: 2026-07-20 (Asia/Bangkok)

This is the immutable starting point for the v0.1.0 release-candidate audit. Phase 4 does not publish a
package, create a tag or GitHub release, change repository visibility, or modify a real Codex installation.

## Repository state

| Item | Observed value |
| --- | --- |
| Repository | `SUDARSHANCHAUDHARI/TemporalThread` |
| Remote | `https://github.com/SUDARSHANCHAUDHARI/TemporalThread.git` |
| Visibility | Private, verified through the GitHub API |
| Default/current branch | `main` |
| Baseline commit | `9f8015bec0f73c515579f6107d02e687ddc97507` |
| Working tree | Clean and synchronized with `origin/main` |
| Local tags | None |
| Remote tags | None |
| GitHub releases | None |
| Workspace version | `0.1.0` |
| Root package | `@temporalthread/workspace`, private |
| Runtime | Node.js 24; pnpm 11.9.0 |
| Tracked files | 170 |

The latest baseline CI run is GitHub Actions run `29758836761` at the baseline commit. Its Ubuntu, macOS,
and Windows jobs all passed. A fresh local baseline test run passed 23 files and 114 tests in 25.63 seconds.

## Workspace and intended distribution graph

The source workspace contains 12 projects: one private root, eight non-private implementation packages, and
three private examples. The actual runtime dependency graph requires **distribution model B**: publish the
CLI and its seven required scoped packages. Publishing only the CLI would leave unresolved
`@temporalthread/*` registry dependencies.

| Package | Visibility intent | Direct TemporalThread dependencies |
| --- | --- | --- |
| `@temporalthread/shared-types` | Public candidate | None |
| `@temporalthread/config` | Public candidate | `shared-types` |
| `@temporalthread/temporal-parser` | Public candidate | `shared-types` |
| `@temporalthread/storage-sqlite` | Public candidate | `shared-types` |
| `@temporalthread/core` | Public candidate | `config`, `shared-types`, `storage-sqlite`, `temporal-parser` |
| `@temporalthread/mcp-server` | Public candidate | `config`, `core`, `shared-types`, `storage-sqlite`, `temporal-parser` |
| `@temporalthread/codex-integration` | Public candidate | `config`, `core`, `shared-types` |
| `temporalthread` | Public candidate | all seven scoped packages |
| `@temporalthread/workspace` | Private, never publish | None |
| Three example packages | Private, never publish | Example-specific dependencies |

The resulting dependency-order groups are: (1) `shared-types`; (2) `config`, `temporal-parser`, and
`storage-sqlite`; (3) `core`; (4) `mcp-server` and `codex-integration`; (5) `temporalthread`.

## Existing automation and verification

- `.github/workflows/ci.yml` runs on Ubuntu, macOS, and Windows with read-only repository contents access.
- CI installs with the frozen lockfile and runs lint, typecheck, 114 tests, build, packed Codex verification,
  and the production dependency audit.
- `scripts/verify-codex-package.mjs` currently builds and installs eight tarballs in isolation, validates the
  Codex plugin, exercises the CLI and MCP startup, installs/uninstalls the integration, and confirms database
  preservation.
- There is no release-dry-run workflow, durable release-artifact builder, checksum manifest, or SBOM command
  yet.

## Integrations at baseline

| Integration | Baseline status |
| --- | --- |
| Generic MCP | Supported over local stdio |
| Codex | Packaged integration, skill, documented hooks, direct installer, and automated contract tests |
| Claude Code | Partially supported through configuration, documented hooks, and a skill |
| OpenCode | Experimental |
| Ollama | Example client only; Ollama itself is not claimed as an MCP host |
| ChatGPT web | Local stdio is unsupported |

The default remains `temporal-references-only`. `full-local-history` is explicit opt-in only. Automatic host
capture is best effort and is not a transcript recorder.

## npm registry baseline

Checked on 2026-07-20 using npm CLI 11.17.0 against the public npm registry:

- npm authentication identifies the current account as `sudarshanchaudhari`.
- All eight intended package names returned `E404`, so no public package was visible under those names at
  check time. Registry state can change and an `E404` is not a reservation guarantee.
- Access to the `temporalthread` npm organization/scope returned `E403`. Ownership or publication authority
  for `@temporalthread/*` is therefore **not established**.

The unscoped name appears unpublished, but the release cannot publish the current graph until the maintainer
establishes and verifies control of the `@temporalthread` scope or explicitly approves a naming migration.
No name was reserved and nothing was published during the check.

## Initial blockers and missing evidence

| Item | Baseline classification | Required resolution |
| --- | --- | --- |
| `@temporalthread` npm scope authority | Blocked | Establish/verify organization ownership, or approve a package rename plan |
| Package metadata and tarball legal files | Incomplete | Audit and repair every intended package manifest/tarball |
| Checksums and artifact manifest | Missing | Add deterministic non-publishing artifact tooling |
| SBOM and provenance plan | Missing | Generate or document a verified release-candidate SBOM and future provenance flow |
| Cross-platform tarball clean install | Partial | Expand the packed verifier and run it in the release dry-run matrix |
| Real Codex CLI/desktop trust and discovery | Manual | Certify a packed candidate in an isolated real-host test project |
| Public repository settings | Manual approval | Prepare exact settings without applying them |
| npm publication, GitHub release/tag, visibility | Prohibited in Phase 4 | Obtain explicit approval in a later release phase |

## Baseline conclusion

The code baseline is healthy, but v0.1.0 is not yet releasable to npm. The release audit begins with one
external ownership blocker, several missing release artifacts/documents, and mandatory real-host Codex
certification. Phase 4 must resolve every automatable item and preserve honest MANUAL/BLOCKED statuses for
the remainder.
