# Phase 4 release security review

Review date: 2026-07-20; dependency-advisory follow-up 2026-07-22; Phase 4.1 evidence 2026-07-23
Scope: v0.1.0 source, history, package manifests, eight tarballs, SPDX SBOM, workflows, installer/uninstaller,
hooks, MCP stdio boundary, SQLite, export/purge, logs, diagnostics, and release tooling

## Recommendation

No release-blocking source or privacy defect was found, but the follow-up found a release-blocking difference
between the secured workspace graph and a fresh packed npm consumer. Source development is suitable to
continue; npm publication is not. This conclusion is evidence scoped to the audited commits and generated
candidate; it is not a guarantee that all vulnerabilities are absent.

## Tools and checks used

- Git tracked-file and history searches for sensitive filenames, token/private-key prefixes, personal paths,
  databases, WAL/SHM files, logs, certificates, and environment files;
- focused `rg` review for `shell: true`, `eval`, dynamic functions, child processes, environment dumping,
  output/logging, SQL construction, bounds, filesystem permissions, symlinks, and containment;
- `pnpm audit --prod --audit-level high` against the registry;
- deterministic tar parser and release verifier over all 225 packaged files;
- packed and clean-source installation in isolated paths containing spaces and Unicode;
- actual MCP stdio startup/tool discovery and native SQLite loading;
- existing 114-test suite covering privacy, malformed inputs, hooks, installer rollback/ownership, and purge;
- review of GitHub Actions permissions and immutable action pins;
- SPDX 2.3 dependency inventory generated from the pnpm production graph and license metadata.

Secret scanning reports paths/counts only and does not print discovered values.

## Findings

| Severity | Finding | Evidence and remediation |
| --- | --- | --- |
| Critical | None found | No remediation required from this review. |
| High | `fast-uri@3.1.3` advisory reached the audit feed | Locked override to 3.1.4; source and packed consumer now resolve 3.1.4. |
| Medium | Packed consumer resolves `@hono/node-server@1.19.14` | Source is overridden to 2.0.10, but publication is blocked until a stable dependency range carries the fix. |
| Medium | No application-boundary defect found | No unsafe shell interpolation, arbitrary command construction, path escape, or default full-text retention found. |
| Low | None found | Release tarballs reject sources, tests, build info, local state, links, secrets, and machine paths. |
| Informational | npm scope authority is unverified | Resolve before publication; never work around it with broad credentials. |
| Informational | Live Codex trust remains manual | Follow `docs/LIVE-CODEX-CERTIFICATION.md`; do not bypass host security. |

## Source and history review

- No sensitive filename is tracked now or appeared in the reachable Git history.
- No common GitHub, npm, OpenAI, or private-key prefix matched the current tree or history.
- No actual maintainer home path matched the tree or history. A synthetic Windows path in a unit test is a
  platform fixture, not local data.
- No environment dump, token dump, `shell: true`, JavaScript `eval`, or dynamic `Function` was found.
- Child processes use fixed executables/argument arrays with `shell: false` or Node directly. Diagnostics are
  drained or bounded and sanitized.
- No real conversation, transcript, TemporalThread database, Codex user configuration, or export is tracked.

Pattern searches cannot prove that an arbitrary high-entropy secret never existed. A final platform-native
secret scan should still run immediately before making the repository public.

## Data and SQLite review

- Public inputs use strict bounded Zod schemas. CLI ingestion is limited to 10 MiB, Codex hook input to 256
  KiB, hook text to 100,000 characters, and injected context to 7,000 bytes.
- Value-bearing SQLite operations are parameterized. Dynamic WHERE clauses select only fixed internal
  fragments and pass values separately.
- Dynamic table names in export/count helpers are reached only from fixed internal allowlists. Migration and
  purge `database.exec` strings are repository-owned constants.
- The database directory uses mode `0700` and the database uses `0600` where supported. WAL/SHM files remain
  protected by the containing private directory.
- `temporal-references-only` remains the default. The packed and clean-source smoke tests confirm the full
  synthetic prompt marker is not in SQLite.
- Exports use `0600`; purge requires explicit confirmation; integration uninstall preserves the database
  unless deletion is separately requested.

## Installer and filesystem review

- User/project scope roots are resolved explicitly and target paths must remain within the selected root.
- Existing symlink targets are refused, plugin packages reject symlinks, and tarballs reject link entries and
  path traversal.
- Writes use restrictive temporary files plus atomic rename; backups are exclusive; failed installation
  validation rolls back managed changes.
- Ownership manifests contain hashes and paths, not prompts, conversations, tokens, or environment dumps.
- Uninstall removes only managed content and preserves unrelated Codex configuration in automated evidence.

## MCP, hooks, and process boundaries

- MCP remains local stdio and opens no listener.
- The server emits a generic startup failure rather than local paths or message text.
- Hook input is read from stdin, never command-line interpolated, and `transcript_path` is not parsed.
- Hook errors fail open with bounded neutral output. Stop never issues a block/continue decision.
- The release smoke starts a real child MCP process, lists exactly nine tools, calls write/read tools, and
  closes the client; no process mock replaces startup.
- The OpenCode example uses fixed `temporalthread ingest --json` arguments, `shell: false`, a bounded timeout,
  and bounded stderr capture. Its live host support remains experimental.

## Tarball and generated-artifact review

All eight tarballs require regular files under a single `package/` root and reject duplicate/traversal paths,
links, source trees, tests, `.tsbuildinfo`, local config, `.env`, databases, WAL/SHM, logs, coverage,
`node_modules`, `.git`, `.github`, temporary paths, secret prefixes, and machine-specific absolute paths.

Required `README.md`, `LICENSE`, `package.json`, package identity, MIT license, public access, repository
metadata, Node engine, runtime dependency specifiers, and the CLI's portable shebang are verified from the
tarball bytes. Source maps contain only relative source names and no embedded source content or absolute
developer path. Checksums are recomputed independently from `SHA256SUMS`.

## Workflow review

- Both workflows use read-only `contents` permission.
- All third-party actions are pinned to immutable commit SHAs.
- The release dry run is manual-only, has no npm/GitHub token, never publishes/tags/releases/changes
  visibility, uses a frozen lockfile, and does not accept user-provided command strings.
- Release-candidate artifacts are retained for 14 days and are not a durable release channel.
- The repository currently permits all Actions and does not enforce SHA pinning at the settings level;
  `docs/PUBLIC-REPOSITORY-READINESS.md` recommends restricting this after launch.

## Dependency and supply-chain posture

The 2026-07-22 source graph locks `@hono/node-server@2.0.10` and `fast-uri@3.1.4`; full `pnpm audit --prod`
and the repository audit gate report no known production vulnerabilities. These versions address
[GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9),
[GHSA-9mqv-5hh9-4cgg](https://github.com/advisories/GHSA-9mqv-5hh9-4cgg), and
[GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx).

A clean consumer installation of the eight packed packages still resolves `@hono/node-server@1.19.14`
through `@modelcontextprotocol/sdk@1.29.0`. npm documents that overrides are considered only in the root
project and that dependency/workspace overrides are ignored when a package is installed; see
[package.json overrides](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides). The manual
release workflow now requires secure packed dependencies and fails before artifact/SBOM creation on all three
operating systems. A stable upstream SDK range permitting Hono 2.0.10+ is the preferred fix; a shrinkwrap or
packaging redesign needs separate architecture/security approval.

Phase 4.1 strengthened this evidence by creating independent clean npm and pnpm consumers, isolating their
cache/store, omitting any direct root SDK/Hono declaration, inspecting every resolved version, and running a
low-threshold production audit for both managers. npm reports five propagated moderate findings and pnpm
reports the single underlying moderate advisory. Both resolve only Hono node-server 1.19.14. The affected
`serveStatic` operation is not imported or reachable through TemporalThread's stdio-only implementation, but
the production dependency and audit failures remain release-blocking.

Exact-commit release dry run `29940910728` reproduced that result on Ubuntu, macOS, and Windows after each
platform passed 118 tests, build, and real packed functional smoke. It uploaded no artifacts.

The production license set remains permissive; see `docs/DEPENDENCY-LICENSE-REVIEW.md`.

`better-sqlite3` is the only native runtime requirement. Frozen-lockfile installation still runs its trusted,
locked build/install path; a compromised registry package or build runner remains a supply-chain risk.

## Residual risk

- A compromised OS account or trusted MCP host can read data available to that account.
- Host trust, processing, and retention are controlled by Codex or another client, not TemporalThread.
- Local backups and exports can contain privacy-permitted data and must be protected separately.
- Registry name ownership, npm account recovery/2FA, trusted-publisher configuration, and initial publication
  are outside source control.
- The SPDX generator relies on installed pnpm metadata and does not analyze every dependency file or license
  text.
- Byte-for-byte reproducibility across operating systems is not established.

## Final security gate

Source security/privacy automated gate: PASS.
Packed npm dependency security gate: FAIL/BLOCKED.
npm account/scope gate: BLOCKED.
Real-host trust gate: MANUAL.
