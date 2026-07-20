# Public repository readiness

Audit date: 2026-07-20
Current visibility: private
Visibility changed during Phase 4: no

## Public surface review

Reviewed `README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`,
`AGENTS.md`, architecture/privacy/security/integration/roadmap/install documents, package READMEs, issue
templates, pull request template, and release-candidate reports.

Results:

- no npm or GitHub release badge is present before publication;
- the root README advertises source installation only and explicitly says npm publication has not happened;
- package READMEs also say they are not yet published;
- no maintainer email address, real conversation, token, database, or personal machine path is present;
- repository-owner URLs appear only where needed for source, issues, security, and package metadata;
- local stdio is never claimed to work in ChatGPT web;
- Codex configuration is supported but live trust remains manual, Claude Code is partial, OpenCode is
  experimental, and Ollama is an example client;
- automatic capture is consistently best effort;
- `temporal-references-only` is documented as the default and full history as explicit opt-in;
- uninstall and purge are separate, and uninstall preserves the database by default;
- the MIT license, contribution rules, code of conduct, security policy, privacy model, architecture, support
  matrix, and roadmap are present;
- privacy-aware bug/feature issue forms and a pull request template are prepared.

Private vulnerability reporting is not currently confirmed by the API and must be enabled when the
repository becomes public. The security issue-template link is intended for that future enabled state.

## Current GitHub settings

| Setting | Current evidence |
| --- | --- |
| Visibility | Private |
| Default branch | `main` |
| Description | “Give AI agents a persistent sense of time.” |
| Topics | None |
| Issues | Enabled |
| Discussions | Disabled |
| Wiki | Disabled |
| Merge methods | Merge commit, squash, and rebase all enabled |
| Delete head branch after merge | Disabled |
| Branch protection | Not available on the current private repository plan; API returned 403 |
| Actions | Enabled; all actions allowed; SHA pinning not enforced at repository level |
| Default workflow token | Read-only; cannot approve pull requests |
| Artifact/log retention | 90-day repository default; release dry-run overrides artifacts to 14 days |

## Exact settings for a later approved public launch

Do not apply these settings during Phase 4.

| Setting | Recommended value |
| --- | --- |
| Visibility | Public, only after a final secret/history review and explicit owner approval |
| Default branch | `main` |
| Description | `Give AI agents a persistent sense of time.` |
| Homepage | Leave empty until a durable project site or documentation URL exists |
| Topics | `mcp`, `model-context-protocol`, `temporal`, `ai-agents`, `local-first`, `sqlite`, `typescript`, `codex` |
| Issues | Enabled |
| Discussions | Enable after launch for usage questions and ideas; keep defects in Issues |
| Wiki | Disabled; versioned documentation remains in `docs/` |
| Projects | Optional; leave enabled only if the maintainer will use it |
| Private vulnerability reporting | Enable immediately after public visibility |
| Merge strategy | Squash merge enabled; disable merge commits; rebase merge optional; delete head branches |
| Auto merge | Optional after branch rules are active |
| Workflow token | Keep read-only by default; grant job-level permissions only |
| Actions policy | Allow GitHub-authored and explicitly selected verified actions; continue immutable SHA pins |
| Fork pull-request workflows | Never send write tokens or secrets to untrusted fork code |
| Artifact retention | Keep the 14-day release-dry-run override; use a separately approved durable release asset for releases |

## Branch rules recommendation

After public visibility makes branch protection available, protect `main` with:

- pull requests required for external changes;
- all three uniquely named CI matrix checks required;
- conversation resolution required;
- force pushes and branch deletion disabled;
- linear history required if merge commits are disabled;
- branch rules applying to administrators when practical;
- signed release tags and tag protection for `v*`;
- no broad bypass list.

For a solo maintainer, zero mandatory external approvals is practical, but required CI and conversation
resolution should still prevent an accidental red build from merging. The Phase 4 direct push is part of the
explicit audit brief and does not set the future contribution policy.

GitHub documents the available controls in [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
and [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository).

## Launch blockers

- npm `@temporalthread` scope authority is not established.
- Real Codex CLI/desktop trust and discovery certification is incomplete.
- The final release dry-run workflow has not yet passed at the Phase 4 commit.
- Public visibility, npm publication, tag, and GitHub release each require explicit human approval.

The repository is structurally ready for review as public source once automated Phase 4 CI passes, but these
blockers prevent treating it as a complete v0.1.0 public package launch today.
