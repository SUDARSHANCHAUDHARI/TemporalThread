# Phase 4 final report

Report status: final Phase 4 audit evidence recorded; dependency-security follow-up added 2026-07-22
Decision: **NO-GO** for the complete public v0.1.0 launch

## Baseline and repository state

| Item | Result |
| --- | --- |
| Baseline commit | `9f8015bec0f73c515579f6107d02e687ddc97507` |
| Phase 4 implementation commit | `dc2c0b44f56ec3d21294d2949a8c861238256adc` |
| Phase 4 evidence commit | `1ab308660c99dfc3d7bfbc6cb7de270970ec311b` |
| Dependency-security commit | `117a097ed44f108d5e7c4b9f5cee8fedd25774d3` |
| Branch | `main` |
| Remote | `SUDARSHANCHAUDHARI/TemporalThread` |
| Visibility | Private |
| Version | 0.1.0 |
| Tags | None |
| GitHub releases | None |
| npm publications | None visible for all eight intended names |

Phase 4 did not change visibility, publish a package, create a release/tag, modify a real Codex
configuration, create a credential, approve trust, install a GitHub App, or make an announcement.

## Delivered files

Created:

- deterministic release package/artifact/SBOM utilities and clean source/MCP smoke scripts under `scripts/`;
- manual-only `.github/workflows/release-dry-run.yml` with an Ubuntu/macOS/Windows matrix and 14-day artifacts;
- package READMEs for the six packages that lacked one;
- privacy-aware issue forms and pull request template;
- Phase 4 baseline, npm distribution, live Codex, public readiness, security, license, SBOM/provenance,
  release-note, release-command, and GO/NO-GO documents.

Changed:

- eight public package manifests, root scripts, ignored artifacts, README/contribution guidance, changelog,
  and packed Codex verification.

No runtime architecture boundary, integration set, database schema, privacy default, or public API was
rebuilt.

## Package strategy

Selected model B: publish `temporalthread` plus seven required scoped packages. Publishing only the CLI would
leave unresolved registry dependencies. The root workspace and three examples remain private.

Publication order: `shared-types`; then `config`/`temporal-parser`/`storage-sqlite`; then `core`; then
`mcp-server`/`codex-integration`; then `temporalthread`.

## Superseded clean artifact evidence

The selected Ubuntu workflow artifact was built from the clean Phase 4 implementation commit before the
2026-07-22 dependency-advisory follow-up. It contains eight tarballs, 225 files, 127,351 compressed bytes,
and 564,679 unpacked bytes. These checksums identify the historically reviewed bytes; nothing was published
from them. The artifacts are now **superseded audit evidence, not release candidates**, because a fresh
consumer install resolves vulnerable `@hono/node-server@1.19.14`.

| Package | Compressed bytes | Unpacked bytes | Files | Selected SHA-256 |
| --- | ---: | ---: | ---: | --- |
| `@temporalthread/shared-types` | 11,859 | 73,254 | 31 | `148dbe0335fabd61c1a2c7a0f6ba33f031a3b1a32c07bf077f0c64de0a17910a` |
| `@temporalthread/config` | 5,453 | 18,426 | 7 | `c8814981d91b483ca9b74125de2d1476e7d1eef8f75ab22b5e3cadb97c50e5f2` |
| `@temporalthread/temporal-parser` | 8,511 | 30,818 | 19 | `22ef61ef6ff838f5f041c6d7035c4690562b5d438bc22f8aecad95bd188981f4` |
| `@temporalthread/storage-sqlite` | 12,587 | 56,474 | 19 | `7415ae0d9ac168ab00b77199f4daa42ecb32ecd3907bf00ec5217ccfa032c9ae` |
| `@temporalthread/core` | 14,519 | 65,706 | 19 | `3b7aa81763bde083d75900f32b829cd49323455c6bb27dbe0b4a9532dbfc8d10` |
| `@temporalthread/mcp-server` | 5,902 | 19,238 | 23 | `8b802764221983d59bc7109cf9560cf35537b2dfad721eeef2546f445c1dc47a` |
| `@temporalthread/codex-integration` | 38,705 | 167,828 | 48 | `48a67f088648c0dc7cbefd1e3e48f6f76a09cc1d18720c9e1961b0470129221e` |
| `temporalthread` | 29,815 | 132,935 | 59 | `a6160a8fbfdec004831d66c49c4edda5b914abab7a57d58c1a26b1ceaeba69d9` |

Every tarball has a README, MIT LICENSE, valid public manifest, strict compiled-file allowlist, exact packed
workspace versions, and no unexpected source/test/build/local/private files. `better-sqlite3` is the native
runtime dependency for storage and its dependents.

The three workflow artifacts have the same sorted file set, sizes, and unpacked bytes, but different tarball
hashes across operating systems. Two consecutive local builds also differed because pnpm emitted different
dependency-key ordering in some packed manifests. Byte-for-byte reproducibility is therefore not claimed;
the selected Ubuntu artifact's checksums above are authoritative for this candidate.

## Local quality gates

Node.js 24.14.0 and pnpm 11.9.0:

| Command | Duration | Result |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | 0.64 s | PASS; 12 projects, lockfile current |
| `pnpm format:check` | 1.4 s | PASS; 125 supported files |
| `pnpm lint` | 1.54 s | PASS; 125 supported files |
| `pnpm typecheck` | 2.00 s | PASS |
| `pnpm test` | 26.14 s | PASS; 23 files, 114 tests |
| `pnpm build` | 1.18 s | PASS |
| `pnpm verify:codex-package` | 20.45 s | PASS; eight tarballs, 48 integration files, eight plugin files |
| `pnpm verify:clean-source` | 22.54 s | PASS; isolated frozen install/build/full smoke |
| `pnpm release:artifacts` | 11.79 s | PASS; clean rebuild, eight tarballs, manifest/checksums |
| `pnpm release:sbom` | 3.34 s | PASS; SPDX 2.3, 140 packages, 247 relationships |
| `pnpm verify:release-artifacts` | 0.96 s | PASS; eight checksums and 225 files |
| `pnpm run audit` | 2.56 s | PASS; no known production vulnerability |
| Markdown local-link check | <1 s | PASS; 54 Markdown files, zero missing local links |
| `git diff --check` | <1 s | PASS |

Warnings were not hidden: the desktop shell initially resolved Node.js 20.20.2, which is below the repository
requirement and cannot run pnpm 11.9.0; every recorded gate was rerun with the bundled Node.js 24.14.0
runtime. An earlier frozen-install rehearsal also displayed the available pnpm 11.15.1 update, which was not
applied during the release audit.

### 2026-07-22 dependency-security follow-up

The follow-up used Node.js 24.5.0 and pnpm 11.9.0 locally. Formatting, lint, type-check, all 114 tests, build,
the full production audit, normal packed functional verification, and isolated clean-source verification
passed. The source graph resolves `@hono/node-server@2.0.10` and `fast-uri@3.1.4`, and reports no known
production vulnerabilities.

The packed consumer remains functionally correct but resolves `@hono/node-server@1.19.14` and
`fast-uri@3.1.4`. The release-only invocation
`pnpm verify:codex-package -- --require-secure-dependencies` therefore returns structured evidence with
`packedDependencySecurity: false` and exits 1. This is an expected release-blocking result, not a passing
quality gate.

### Phase 4.1 dependency-resolution attempt

Phase 4.1 independently rechecked the registry, advisory, SDK repository, and clean npm/pnpm consumer graphs.
SDK 1.29.0 remains the latest stable release and declares Hono node-server `^1.19.9`; upstream issue
`modelcontextprotocol/typescript-sdk#2531` remains open. A direct Hono 2.0.11 experiment retained nested
1.19.14, while npm/pnpm overrides remain consumer-root-only. Shrinkwrap, bundling, and a fork would add
cross-manager or architecture/maintenance risk disproportionate to this stdio-only release.

The packed verifier now installs all eight tarballs into independent npm and pnpm consumers with isolated
caches/stores, adds no root SDK/Hono dependency, validates every TemporalThread package at 0.1.0, inspects all
SDK/Hono/fast-uri versions, and runs low-threshold production audits for both managers. Its functional mode
still passes CLI/MCP/Codex/privacy/export/uninstall/purge checks, including nine-tool discovery. Its secure
mode still fails closed because npm reports five propagated moderate findings and pnpm reports the single
underlying moderate advisory at Hono 1.19.14.

The updated local suite passes 24 files and 118 tests. No dependency manifest or lockfile changed because no
supportable secure fix exists, and no fresh tarball/checksum/SBOM candidate was generated after the failed
security gate. See `docs/PHASE-4.1-BASELINE.md`, `docs/PACKED-DEPENDENCY-ROOT-CAUSE.md`, and
`docs/DEPENDENCY-SECURITY-SOLUTION-DECISION.md`.

## Clean-install and packed behavior

Both an isolated clean source copy and an isolated eight-tarball consumer passed:

- frozen installation and workspace build;
- CLI version/help, initialization, database creation, doctor, and status;
- real MCP stdio startup and exact nine-tool discovery;
- temporal interaction, context, and commitment calls;
- default privacy inspection using a synthetic full-prompt marker;
- export;
- project Codex install/uninstall with unrelated configuration preserved;
- database preservation after uninstall;
- explicit purge and zero remaining domain rows;
- spaces/Unicode paths and isolated HOME/USERPROFILE/cache/store/temp/data directories.

No mock replaced MCP startup and no real Codex or TemporalThread home was written.

## Cross-platform and workflow evidence

Baseline CI run `29758836761` passed Ubuntu, macOS, and Windows at `9f8015b`. Phase 4 CI run `29763767993`
and manual release-dry-run `29763942578` both passed at exact commit `dc2c0b4`. The three downloaded artifact
sets were then independently reparsed and verified locally with clean-tree, SBOM, and exact-commit checks.

| Evidence | Ubuntu | macOS | Windows |
| --- | --- | --- | --- |
| Baseline CI | PASS | PASS | PASS |
| Phase 4 CI | PASS; job `88424655175` | PASS; job `88424655113` | PASS; job `88424655144` |
| Historical release dry run | PASS; job `88425620750` | PASS; job `88425620814` | PASS; job `88425620747` |
| Historical uploaded artifact | PASS; ID `8470037243` | PASS; ID `8470020074` | PASS; ID `8470080320` |
| Downloaded independent verification | PASS | PASS | PASS |

All artifacts expire on 2026-08-03 under the documented 14-day retention policy. GitHub reported archive
sizes of 140,559 bytes (Ubuntu), 140,552 bytes (macOS), and 140,554 bytes (Windows).

The 2026-07-22 source CI run
[`29931945659`](https://github.com/SUDARSHANCHAUDHARI/TemporalThread/actions/runs/29931945659) passed at exact
commit `117a097` on Ubuntu (job `88963660016`), macOS (job `88963660052`), and Windows (job `88963660133`).
Its formatting, lint, type-check, 114-test, build, normal packed-functional, and source-audit gates were all
green.

The subsequent non-publishing release dry run
[`29932142666`](https://github.com/SUDARSHANCHAUDHARI/TemporalThread/actions/runs/29932142666) failed closed at
the new packed-dependency security gate on Ubuntu (job `88964364351`), macOS (job `88964364562`), and Windows
(job `88964364478`). Every job passed formatting, lint, type-check, tests, and build first, then reported
`@hono/node-server@1.19.14`, `fast-uri@3.1.4`, and `packedDependencySecurity: false`. Later artifact, SBOM,
audit, and upload steps were skipped, so this run produced no candidate artifact.

## Dependency, license, SBOM, and provenance

- Source registry audit: no known production vulnerability after locked overrides to
  `@hono/node-server@2.0.10` and `fast-uri@3.1.4`.
- Packed npm-consumer dependency gate: FAIL/BLOCKED because root workspace overrides are not part of the
  published package manifests and the current stable MCP SDK range resolves `@hono/node-server@1.19.14`.
- Engineering license gate: PASS for the current non-vendored npm model; direct dependencies are MIT, ISC,
  and BSD-3-Clause, with only permissive transitive metadata buckets. This is not legal advice.
- Historical SPDX gate: PASS locally and in the three commit-`dc2c0b4` workflow jobs; those artifacts are
  superseded. The current release-candidate SBOM gate is BLOCKED because run `29932142666` stopped before
  generation.
- Provenance plan: protected GitHub-hosted publication with least privilege, public source, and npm OIDC after
  initial package bootstrap.
- No trusted publisher, token, environment, signed tag, attestation, or release was created.

## Package-name availability

On 2026-07-20, all eight intended names returned npm `E404`, so no public package was visible. The authenticated
account is `sudarshanchaudhari`, but organization/profile requests returned `E403`. Ownership of the required
`@temporalthread` scope and npm 2FA status are not established. Name availability is time-dependent and no
name was reserved.

## Security and privacy

Release security gate: PASS for source and FAIL/BLOCKED for the packed npm distribution. Current tree/history
scans found no tracked sensitive file, common token/private-key prefix, actual personal machine path, real
conversation, or database. No unsafe shell interpolation/eval/environment dump was found. SQL values are
parameterized; fixed dynamic table names are internal; installer containment/symlink/atomic-write/rollback
controls remain tested.

Default privacy remains `temporal-references-only`, complete prompts are absent in the clean/packed smoke,
MCP remains local stdio, context is bounded, transcript parsing is absent, and capture claims remain best
effort. Residual OS-account, trusted-host, backup, native dependency, registry, and host-retention risks are
documented.

## Documentation and public repository review

Public docs contain no active npm install claim, premature npm/release badge, maintainer email, real
conversation, secret, or actual local machine path. Codex/Claude/OpenCode/Ollama/ChatGPT web support claims,
privacy modes, uninstall versus purge, and limitations match implementation. Exact future repository
settings and release commands are prepared but not applied.

## Manual certification still required

Automated tests do not certify a current real Codex host. `codex-cli 0.144.5` was observed read-only, but
project/hook trust, real MCP/skill visibility, SessionStart/Stop delivery, controlled temporal behavior,
desktop/IDE fallback, terminal-restart PATH, real-host uninstall, and database preservation remain MANUAL.

## Blockers and decision

1. The packed npm consumer resolves vulnerable `@hono/node-server@1.19.14`; the current stable
   `@modelcontextprotocol/sdk@1.29.0` range does not carry the source workspace override.
2. `@temporalthread` npm organization ownership and npm 2FA/recovery access are BLOCKED/unverified.
3. Real current Codex certification is MANUAL and incomplete.
4. Visibility, publication, tag, GitHub release, and announcement approvals are absent by design.

Decision: **NO-GO** for the complete public v0.1.0 launch. The repository source is green for owner review,
but there is no current security-cleared release artifact. The packed dependency and npm authority blockers
prevent CONDITIONAL GO for the full launch.

## Exact next human action

Do not publish the existing tarballs. Track or request a stable `@modelcontextprotocol/sdk` release whose
production range permits patched `@hono/node-server@2.0.10` or newer, update the dependency, and rerun the
three-platform release dry run. A larger packaging or shrinkwrap workaround requires separate architecture
and security approval. After the dependency gate is green, establish/verify npm scope and 2FA authority and
complete the text-only live Codex certification.
