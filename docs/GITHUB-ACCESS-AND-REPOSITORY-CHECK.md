# GitHub Access and Repository Check

Audit date: 2026-07-20 (Asia/Bangkok)

Repository: `SUDARSHANCHAUDHARI/TemporalThread`

This began as a read-only local and GitHub audit except for creating this requested report. The user then
authorised the identified Windows launcher fix and publication of this report. No merge, rebase, reset,
force-push, workflow change, visibility change, package publication, tag, release, or history rewrite was
performed.

## Executive summary

The repository exists, is healthy, and remains private. The local repository is correctly connected to
`origin`, `main` tracks `origin/main`, and a fresh fetch confirmed that the local and remote commits are
identical. The local quality and security checks pass. GitHub Actions run `29755452393` is green on Ubuntu,
macOS, and Windows, including packed Codex integration validation.

The authenticated owner account can access and administer the repository. During the audit, a user-provided
GitHub screenshot confirmed that the ChatGPT Codex Connector was authorised but not installed on an account.
The user subsequently installed it for the repository and confirmed that ChatGPT access was resolved. This
resolution is user-confirmed; the local audit still cannot inspect ChatGPT's internal connector state.

The Windows packed-integration failure was fixed in commit `230be46` by launching the installed command shim
through `cmd.exe` on Windows while preserving direct process launch on macOS and Linux. A deterministic
regression test covers both platform paths.

## Local repository at the original audit snapshot

| Check | Result |
| --- | --- |
| Working directory | `$HOME/SUDARSHAN_CODE/sudarshan_repos/AIProjects/TemporalThread` |
| Project identity | TemporalThread repository confirmed by files, remote, package metadata, and Git history |
| Branch | `main` |
| Upstream | `origin/main` |
| Fetch remote | `https://github.com/SUDARSHANCHAUDHARI/TemporalThread.git` |
| Push remote | `https://github.com/SUDARSHANCHAUDHARI/TemporalThread.git` |
| Local HEAD | `3cbfbbe9ce7f9042ca6736e6052eb6b24036ebe0` |
| Remote `origin/main` | `3cbfbbe9ce7f9042ca6736e6052eb6b24036ebe0` |
| GitHub API `main` commit | `3cbfbbe9ce7f9042ca6736e6052eb6b24036ebe0` |
| Local tree | `ad4642affe38b27edd8125e40917ea6bfedf385a` |
| Remote tree | `ad4642affe38b27edd8125e40917ea6bfedf385a` |
| Ahead / behind | `0 / 0` |
| Diverged | No |
| Force push required | No |

Before this report was created, `git status` reported a clean working tree and no untracked files. The original
audit snapshot was commit `3cbfbbe`; its local and remote commit/tree hashes matched exactly. The approved
follow-up added commit `230be46` and this report without rewriting history.

## GitHub repository

| Check | Result |
| --- | --- |
| Repository exists | Yes |
| Owner and name | `SUDARSHANCHAUDHARI/TemporalThread` |
| URL | `https://github.com/SUDARSHANCHAUDHARI/TemporalThread` |
| Visibility | `PRIVATE` |
| `isPrivate` | `true` |
| Archived | No |
| Disabled | No |
| Default branch | `main` |
| Description | `Give AI agents a persistent sense of time.` |
| Issues enabled | Yes |
| GitHub Actions enabled | Yes |
| Authenticated account | Active owner account `SUDARSHANCHAUDHARI` |
| Authenticated repository access | Admin, maintain, push, triage, and pull |
| GitHub CLI | `2.96.0` |

Authentication was verified with `gh auth status` and `gh api user --jq .login`. No authentication token is
included in this report.

## Repository contents

A fresh `origin/main` tree contains 167 files, exactly matching the 167 locally tracked files and the same
Git tree hash. The repository is not empty. All expected paths are present remotely:

- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `AGENTS.md`
- `package.json`
- `pnpm-workspace.yaml`
- `apps/`
- `packages/`
- `integrations/`
- `skills/`
- `docs/`
- `tests/`
- `.github/workflows/`

No expected path is missing. No important pre-audit local file is absent from the remote. This report is
included in the approved follow-up commit.

The `.gitignore` covers dependencies, build output, coverage, generated knowledge directories, TypeScript
build metadata, SQLite databases and sidecars, environment files, local authentication/configuration files,
keystores, private keys, logs, temporary files, and macOS metadata.

## Remote README review

The README at `origin/main` was reviewed and matches the local README because the commits and tree hashes are
identical. It:

- clearly describes TemporalThread as a local-first MCP server and CLI for durable temporal continuity;
- documents Codex, Claude Code, OpenCode, Ollama, and generic integration boundaries without claiming support
  for every AI host;
- states that TemporalThread does not call an LLM, host a cloud service, collect telemetry, or open a network
  port;
- explains the three privacy modes and keeps `temporal-references-only` as the default;
- provides source installation instructions for Node.js 24 and pnpm 11.9.0;
- explicitly states that the MVP is not yet published to npm;
- does not present an unpublished npm package as available;
- contains no local username, personal email address, absolute machine path, secret, or private conversation.

## Quality commands

The commands below ran from the repository root with Node.js `v24.14.0` and pnpm `11.9.0`.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass; all 12 workspace projects already up to date |
| `pnpm format:check` | Pass; 118 files checked, no fixes required |
| `pnpm lint` | Pass; 118 files checked, no fixes required |
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass; 23 test files and 111 tests |
| `pnpm build` | Pass |
| `pnpm verify:codex-package` | Pass locally; 8 tarballs, 48 integration files, 8 plugin files, packed install/uninstall and database preservation verified |
| `pnpm audit` | Pass; no known production dependency vulnerabilities |
| `git diff --check` | Pass before report creation |

Local checks pass and the same required gates pass in the three-platform GitHub Actions matrix.

## Security and privacy scan

The current tracked tree and all commits in Git history were searched without printing matched values.

| Scan | Current tree | Git history |
| --- | --- | --- |
| High-confidence API/token/private-key shapes | None | None |
| `sk-`, `ghp_`, `github_pat_`, `client_secret`, `private_key`, `password`, `authorization` | None | None |
| `.env`, auth/local/secure/keystore configuration, keys, certificates | None tracked | None historically |
| SQLite/database/log files | None tracked | None historically |
| Transcript, conversation, chat, or session artifacts by path | None | None |
| Local username or absolute Unix/Windows user path | None | None |
| Email addresses in tracked content | None | None |

References to `.sqlite`, `.db`, or `.log` occur only in ignore rules, generated local database-path logic,
logging APIs, package verification, and synthetic tests. They are not tracked databases or logs. Synthetic
test text is bounded fixture data, not a private conversation.

The workflow grants only `contents: read`, references no repository secrets, and pins all third-party actions
to full commit SHAs. Repository-level Actions are enabled. The GitHub repository currently permits all action
sources, while this workflow itself uses pinned actions and least-privilege token permissions.

This was a pattern and repository-content audit, not a guarantee against every possible undisclosed secret.
No suspicious tracked or historical exposure was found, so no history rewrite or secret rotation is indicated.

## GitHub Actions

Workflow: `CI` in `.github/workflows/ci.yml`

Matrix: Node.js 24 on Ubuntu, macOS, and Windows. Each job installs with the frozen lockfile, runs lint,
typecheck, tests, build, packed Codex integration validation, and a production dependency audit.

### Latest verified code run

- Run: `29755452393`
- Commit: `230be464071fbaa54d132828c5aaaa4a7819031d`
- Status: completed
- Conclusion: success
- URL: `https://github.com/SUDARSHANCHAUDHARI/TemporalThread/actions/runs/29755452393`
- Ubuntu: pass
- macOS: pass
- Windows: pass

All three jobs passed checkout, install, formatting/lint, typecheck, all 111 tests, build, packed Codex
integration validation, and the production dependency audit.

### Prior launcher failure

- Run: `29748170508`
- Commit: `3cbfbbe9ce7f9042ca6736e6052eb6b24036ebe0`
- Status: completed
- Conclusion: failure
- Failed job: Windows
- Failed step: `Validate packed Codex integration`

The Windows job passed checkout, install, formatting/lint, typecheck, all 110 tests, and build. The packed
installer then returns `mcp-unavailable` because TemporalThread MCP startup validation does not complete.
The failure was isolated to the installed command-shim launch boundary and fixed in `230be46`. No workflow
modification was required.

### Earlier run

- Run: `29747626575`
- Commit: `a18da81bdb090cb10a0f0f51c25480b12f285e7f`
- Status: completed
- Conclusion: failure
- Failed job: Windows
- Failed step: `Check formatting and lint`
- Cause: Git for Windows checked text out with CRLF and Biome reported 118 formatting errors.

Commit `3cbfbbe` added a repository line-ending policy, and commit `230be46` fixed the Windows launcher. Run
`29755452393` confirms that both Windows failures are resolved and that GitHub Actions passes overall.

## Private repository and external 404

The following cases can be distinguished from the available evidence:

| Case | Audit result |
| --- | --- |
| Repository does not exist | Ruled out; owner-authenticated GitHub API and `gh repo view` both return it |
| Repository exists but is private | Confirmed |
| Local GitHub CLI is not authenticated | Ruled out; the owner account is active |
| Authenticated account lacks permission | Ruled out; the owner account has administrative access |
| External GitHub App was not installed | Confirmed by the user-provided GitHub permissions screenshot |
| App is installed with `TemporalThread` access | User-confirmed after completing the Codex connection flow |
| Recent app-access change was still propagating | No longer blocking; ChatGPT access now succeeds |

The GitHub CLI OAuth credential can inspect the repository but cannot list GitHub App installations. GitHub's
installation endpoint returned HTTP 403 and requires a token authorised to a GitHub App. This is an expected
credential boundary and does not indicate a repository problem.

This audit cannot independently inspect ChatGPT's, OpenAI's, or another third party's internal connector
state. The user-confirmed resolution is consistent with the diagnosed missing GitHub App installation. The
repository remained private throughout.

## Manual GitHub App access checklist

1. Open GitHub.
2. Go to **Settings**.
3. Open **Applications**.
4. Open **Installed GitHub Apps**.
5. Select the relevant ChatGPT or OpenAI GitHub App.
6. Open **Configure**.
7. Confirm the correct GitHub account is selected.
8. Confirm either **All repositories** is selected, or **Only select repositories** includes `TemporalThread`.
9. Save the configuration.
10. Wait a few minutes and retry external access.

## Recommended next steps and blockers

1. Keep the repository private; the external connector issue was resolved without changing visibility.
2. Retain the Windows launcher regression test and three-platform CI coverage.
3. Perform the documented manual live-host and release certification before a public release.

Current blockers:

- None identified for Phase 2. The remaining live-host and release-certification checks are documented manual
  follow-up work, not implementation or CI failures.
