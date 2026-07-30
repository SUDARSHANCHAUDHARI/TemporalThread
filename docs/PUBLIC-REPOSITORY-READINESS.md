# Public repository status

Last verified: 2026-07-30

Repository: [SUDARSHANCHAUDHARI/TemporalThread](https://github.com/SUDARSHANCHAUDHARI/TemporalThread)

## Current state

The repository became public for the v0.1.0 release. The public surface includes the source, documentation,
issue templates, security policy, annotated `v0.1.0` tag, and final GitHub release.

The public review found:

- no token, database, private key, maintainer machine path, or real conversation content in the reviewed
  release surface;
- package READMEs and manifests use the published personal-scope names;
- local stdio is not presented as working in ChatGPT web;
- automatic capture is described as best effort;
- `temporal-references-only` remains the default privacy mode;
- uninstall and purge remain separate operations; and
- real Codex host certification is explicitly not claimed.

## Verified GitHub settings

| Setting | Verified value |
| --- | --- |
| Visibility | Public |
| Default branch | `main` |
| Description | “Give AI agents a persistent sense of time.” |
| Topics | `ai-agents`, `codex`, `local-first`, `mcp`, `model-context-protocol`, `sqlite`, `temporal`, `typescript` |
| Issues | Enabled |
| Discussions | Disabled |
| Wiki | Disabled |
| Merge methods | Squash and rebase enabled; merge commits disabled |
| Delete head branch after merge | Enabled |
| GitHub Actions | No workflows; intentionally absent |
| Private vulnerability reporting | Enabled |
| Secret scanning | Disabled |
| Dependabot security updates | Disabled |

The `main` branch rule:

- requires pull requests;
- requires conversation resolution;
- requires linear history;
- applies to administrators;
- blocks force pushes and branch deletion; and
- has no required status checks because CI is intentionally absent.

Zero mandatory approvals is intentional for the solo-maintainer workflow. It does not permit agents to merge
or enable auto-merge without explicit owner approval.

## Release surface

The [v0.1.0 GitHub release](https://github.com/SUDARSHANCHAUDHARI/TemporalThread/releases/tag/v0.1.0)
contains eight npm tarballs, `SHA256SUMS`, `release-manifest.json`, and the SPDX 2.3 SBOM. The annotated tag
points to commit `5056916c602752632f16fe61bebd814454575c3c`.

All eight v0.1.0 packages are public on npm. The initial release used an interactive no-CI publication and
does not claim npm provenance.

## Remaining limitations

- Real Codex CLI/desktop trust, UI, skill discovery, lifecycle delivery, and model behavior remain not
  tested.
- The exact released commit does not have current Linux or Windows validation evidence.
- Secret scanning and Dependabot security updates are currently disabled. Enabling either is a separate
  repository-setting change and requires owner approval.
- GitHub Actions remain absent by policy; historical phase reports are not current CI evidence.
- Public availability does not make the project production-ready.

No repository setting should be changed merely to make this document's recommendations pass. Inspect the
current setting, explain the effect and resource implications, and obtain explicit owner approval first.
