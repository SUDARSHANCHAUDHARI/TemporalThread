# Phase 2 final report

Completed: 2026-07-20

Phase 2 extends the existing TemporalThread core with a production Codex integration: an official-format
plugin, the `temporal-awareness` skill, supported best-effort lifecycle hooks, safe user/project MCP
configuration, installer/uninstaller/status/doctor commands, isolated package verification, and public
documentation. It does not publish a package, submit a plugin, create a release, or modify a real user Codex
configuration.

## Delivered checkpoints

| Phase | Outcome | Commit |
| --- | --- | --- |
| 2.1 | Baseline, official Codex capability report, implementation plan | `9d68ad4` |
| 2.2 | Safe schemas, paths, manifest/version contracts, Codex adapter boundary | `2b52881` |
| 2.3 | Canonical validated `temporal-awareness` skill | `8cf3943` |
| 2.4 | Parsed, ownership-aware Codex MCP configuration | `f38aff5` |
| 2.5 | Fail-open `SessionStart`, `UserPromptSubmit`, and `Stop` lifecycle handling | `ecaa8ed` |
| 2.6 | Nested installer, uninstaller, status, doctor, print-config, and skill commands | `7ab578e` |
| 2.7 | Official plugin/marketplace package and packed-artifact verification | `38c728d` |
| 2.8 | Installation, architecture, privacy, troubleshooting, compatibility, and changelog docs | `69d4295` |
| 2.9 | Combined July acceptance test, clean-install/security/release-readiness audit, final report | This final checkpoint |
| 2.10 | Windows-safe installed launcher and green three-platform package validation | `230be46` |

## Acceptance evidence

| Requirement | Evidence | Result |
| --- | --- | --- |
| Current official Codex capabilities verified | `docs/CODEX-CAPABILITY-REPORT.md` cites current official MCP, skill, plugin, hook, config, and approval documentation | Pass |
| Existing architecture preserved | Codex code remains under the integration/CLI boundaries; core/storage received only the backward-compatible session-end behavior needed by `Stop` | Pass |
| Valid selective skill using real tools | Skill frontmatter/content tests compare every mentioned tool with the nine registered MCP tools | Pass |
| Safe MCP config | Strict TOML parsing, marked ownership, preservation of unrelated settings/servers, installed/development launch modes, and pre-mutation probe tests | Pass |
| Safe install/upgrade | User/project scope, executable preflight, real MCP handshake, backups, atomic writes, rollback, symlink refusal, ownership manifest, idempotency, no silent downgrade | Pass |
| Dry run/manual paths | Zero-write/no-database dry-run tests and `print-config` output test | Pass |
| Safe uninstall | Removes only managed MCP/hooks/skill/manifest content, preserves modified/external content and database, requires explicit `--purge-data --yes` | Pass |
| Complete doctor/status | Human/JSON `PASS`/`WARN`/`FAIL`, recommended fixes, runtime/config/MCP/tools/storage/schema/timezone/privacy/files/version/surface checks | Pass |
| Supported lifecycle automation | Strict `SessionStart`, `UserPromptSubmit`, and `Stop` schemas; 256 KiB stdin bound, 7,000-byte context bound, five-second hooks, neutral zero-exit failures | Pass |
| Default privacy | Acceptance test proves complete July prompt text is absent from SQLite and from explicit raw-history retrieval in `temporal-references-only` mode | Pass |
| July 15 → July 19 continuity | Combined E2E installs the integration, discovers tools, records/retries the July 15 event, records one commitment, restarts real stdio MCP with a July 19 fake clock, and verifies 4 days/3 hours plus 3 overdue calendar days | Pass |
| Duplicate safety | Same idempotency key returns the original interaction with `duplicate: true`; database remains at one interaction/reference and one explicitly recorded commitment | Pass |
| Packed artifact | Eight local tarballs install in an isolated project; packaged CLI/plugin validation, MCP install/doctor, uninstall, unrelated config, and database preservation all pass | Pass |
| Cross-platform design | Node-only installer, platform path resolution, Windows/macOS/Linux fixtures, spaces/Unicode tests, and CI matrix for Ubuntu/macOS/Windows | Pass; run `29755452393` succeeded on all three platforms, while live-host certification remains manual |
| Documentation matches behavior | Root README, four Codex guides, integration matrix, architecture/privacy/security/roadmap, plugin/package docs, and changelog updated | Pass |
| Unsupported behavior is honest | Docs exclude guaranteed capture/end, transcript parsing, reminder delivery, auto-completion, IDE plugin install, web/mobile local stdio, remote MCP, and cloud sync | Pass |
| Official plugin format only | `.codex-plugin/plugin.json`, relative component paths, `.mcp.json`, hook/skill copies, repository marketplace, legal/privacy/compatibility files, strict package schema | Pass |

## Final verification

All commands ran with Node.js 24.14.0 and pnpm 11.9.0:

| Command/check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | 12 workspace projects; lockfile already current |
| `pnpm format:check` | 118 files checked |
| `pnpm lint` | 118 files checked |
| `pnpm typecheck` | Pass |
| `pnpm test` | 23 files, 111 tests passed |
| `pnpm build` | Pass |
| `pnpm verify:codex-package` | 8 tarballs, 48 integration files, 8 plugin files; install/uninstall/database-preservation pass |
| `pnpm run audit` | No known production dependency vulnerabilities |
| Relative Markdown link check | All links resolve |

No test read or wrote the real `~/.codex`, `~/.agents`, plugin cache, or TemporalThread database. Installer,
hook, end-to-end, and package tests use temporary homes/repositories, including spaces and Unicode.

## Security audit

No release-blocking finding was identified.

Inspected:

- tracked filenames for environment files, local properties, keystores, private keys, certificates, and
  database files;
- repository content for common cloud/GitHub/OpenAI/Slack credential and private-key patterns without
  printing secret values;
- tracked content for personal absolute paths;
- process execution for `eval`, dynamic functions, `shell: true`, and shell concatenation;
- hook stdin limits, neutral failure, prompt-safe errors/output, and fixed command arrays;
- installer containment, symlink refusal, restrictive file modes, backups, atomic writes, rollback, and
  ownership-aware removal;
- package contents for databases, secrets, personal paths, symlinks, source files, and build metadata;
- CI permissions and action pinning;
- production dependencies through the registry audit.

Static SQLite `database.exec` calls are limited to repository-owned migrations and fixed purge statements;
value-bearing queries remain parameterized. Dynamic table-name reads use internal fixed allowlists only.

Remaining security boundaries are documented: a compromised operating-system account, malicious trusted MCP
host, insecure backups, and the Codex host's own processing/retention policy are outside TemporalThread's
protection.

## Performance observation

The documented local Apple-silicon measurement used a temporary on-disk database and Node 24.14.0. Median
service operations were below 1 ms; MCP startup/tool discovery was 343 ms and the complete Codex doctor was
701.4 ms. These are observations, not guarantees. See `docs/CODEX-INTEGRATION.md` for sample counts and
qualification.

## Remaining manual verification

Automated tests and GitHub Actions validate official contracts and isolated packed installation on macOS,
Linux, and Windows, but do not grant host trust or certify a particular installed Codex release. Before a
public release:

1. Install the packed artifact on clean macOS, Linux, and Windows machines through the intended distribution
   channel.
2. Use a current Codex desktop and CLI release to review project/plugin discovery, MCP visibility, new-session
   activation, and hook hash trust prompts.
3. Confirm the IDE direct-install fallback without claiming plugin support.
4. Review package ownership/provenance and add signed/reproducible release artifacts under a separate release
   task.

These are release/host-certification steps, not missing Phase 2 implementation. Nothing was published or
released during this phase.
