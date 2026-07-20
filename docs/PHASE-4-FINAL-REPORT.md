# Phase 4 final report

Report status: local audit complete; post-push workflow evidence pending
Decision: **NO-GO** for the complete public v0.1.0 launch

## Baseline and repository state

| Item | Result |
| --- | --- |
| Baseline commit | `9f8015bec0f73c515579f6107d02e687ddc97507` |
| Phase 4 implementation commit | Pending commit |
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

## Local artifact evidence

The final local dirty-tree candidate contains eight tarballs, 225 files, 127,351 compressed bytes, and
564,679 unpacked bytes. These checksums identify only that local candidate and are not release values; the
selected clean workflow artifact will replace this table after push.

| Package | Compressed bytes | Unpacked bytes | Files | Local SHA-256 |
| --- | ---: | ---: | ---: | --- |
| `@temporalthread/shared-types` | 11,859 | 73,254 | 31 | `a78433fd80656bcf3226db6229665de7d1b73af0fb0a59c1b784ca88ba1c2677` |
| `@temporalthread/config` | 5,453 | 18,426 | 7 | `47b67f76d04c1de2692df4b1fe6360c85fd50203eddeca0489ff7627ed949501` |
| `@temporalthread/temporal-parser` | 8,511 | 30,818 | 19 | `9df550922e3ad6d21ee55b1c322e2edd7e8bea4045a479dc6de9e4d5429c0ce9` |
| `@temporalthread/storage-sqlite` | 12,587 | 56,474 | 19 | `2441b035bf2ca39991e571b226c23db5c9549cdc0b8afc39f045d54cbd463a95` |
| `@temporalthread/core` | 14,519 | 65,706 | 19 | `bb5136173cb44af7bf09eeda879e6f5c657aef8fdad052220c9107c71b97c006` |
| `@temporalthread/mcp-server` | 5,900 | 19,238 | 23 | `73f4a106b4dd30a9903ecda00df85aac4debcd86e8fe8adb2b30234ba4abb5c6` |
| `@temporalthread/codex-integration` | 38,705 | 167,828 | 48 | `42e6287633c71bd9418452a1fa3a0f98efeeeb6413c1a619e325cdf677251cbf` |
| `temporalthread` | 29,817 | 132,935 | 59 | `bd0eeb2c34127049edd58433df80d2c740b49cfaefe6d33d6b16a2a86b68a032` |

Every tarball has a README, MIT LICENSE, valid public manifest, strict compiled-file allowlist, exact packed
workspace versions, and no unexpected source/test/build/local/private files. `better-sqlite3` is the native
runtime dependency for storage and its dependents.

Two consecutive clean local builds produced the same sorted file set but not identical tarball bytes because
pnpm emitted different dependency-key ordering in some packed manifests. Byte-for-byte reproducibility is
therefore not claimed; the selected artifact's checksum is authoritative.

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

Baseline CI run `29758836761` passed Ubuntu, macOS, and Windows at `9f8015b`. The Phase 4 implementation run
and manual `Release dry run` IDs/artifact IDs are pending the required commit/push.

| Evidence | Ubuntu | macOS | Windows |
| --- | --- | --- | --- |
| Baseline CI | PASS | PASS | PASS |
| Phase 4 CI | Pending | Pending | Pending |
| Release dry run | Pending | Pending | Pending |
| Uploaded candidate artifact | Pending | Pending | Pending |

## Dependency, license, SBOM, and provenance

- Registry audit: no known production vulnerability at the configured threshold.
- Engineering license gate: PASS for the current non-vendored npm model; direct dependencies are MIT, ISC,
  and BSD-3-Clause, with only permissive transitive metadata buckets. This is not legal advice.
- SPDX gate: PASS locally; machine-generated output stays in workflow artifacts.
- Provenance plan: protected GitHub-hosted publication with least privilege, public source, and npm OIDC after
  initial package bootstrap.
- No trusted publisher, token, environment, signed tag, attestation, or release was created.

## Package-name availability

On 2026-07-20, all eight intended names returned npm `E404`, so no public package was visible. The authenticated
account is `sudarshanchaudhari`, but organization/profile requests returned `E403`. Ownership of the required
`@temporalthread` scope and npm 2FA status are not established. Name availability is time-dependent and no
name was reserved.

## Security and privacy

Release security gate: PASS for source/artifacts. Current tree/history scans found no tracked sensitive file,
common token/private-key prefix, actual personal machine path, real conversation, or database. No unsafe
shell interpolation/eval/environment dump was found. SQL values are parameterized; fixed dynamic table names
are internal; installer containment/symlink/atomic-write/rollback controls remain tested.

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

1. `@temporalthread` npm organization ownership and npm 2FA/recovery access are BLOCKED/unverified.
2. Real current Codex certification is MANUAL and incomplete.
3. Phase 4 CI/release-dry-run evidence is pending commit/push.
4. Visibility, publication, tag, GitHub release, and announcement approvals are absent by design.

Decision: **NO-GO** for the complete public v0.1.0 launch. If Phase 4 CI passes, the repository code and
candidate artifacts are ready for owner review, but the npm authority blocker prevents CONDITIONAL GO for
the full launch.

## Exact next human action

Establish or verify the `temporalthread` npm organization under the intended owner and confirm account
2FA/recovery access—without publishing. Then execute the temporary packed candidate procedure in
`docs/LIVE-CODEX-CERTIFICATION.md` and provide the text-only results for final gate review.
