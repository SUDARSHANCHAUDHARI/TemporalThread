# Phase 4.2 security and privacy review

Review date: 2026-07-23

## Result

**AUTOMATED KIT REVIEW: PASS**

**LIVE HOST/ACCOUNT SECURITY: MANUAL**

**RELEASE DEPENDENCY SECURITY: BLOCKED**

## Certification-kit controls

| Risk | Control |
| --- | --- |
| Real home/repository mutation | Preparation requires a newly created system-temp child, sets isolated `HOME`, `USERPROFILE`, `CODEX_HOME`, caches/store/temp, and refuses real home/repository targets |
| Symlink/path escape | Every managed path is contained and existing components are checked; setup/cleanup refuse symlinks |
| Unsafe cleanup | Matching root marker and UUID are mandatory; target must be under system temp with a TemporalThread prefix |
| Command injection | Fixed executables/argument arrays use `spawnSync`; no `shell: true`, `eval`, or user-built command string |
| Unbounded output | Child output is capped at 20 MiB; emitted failure diagnostics are sanitized and truncated to 4,000 characters |
| Secret/account exposure | Scripts never read `.npmrc`, environment dumps, npm tokens, profiles, emails, recovery codes, or real Codex data |
| Privacy marker leakage | Marker is stored only in the disposable marker file; database bytes and privacy-permitted export are checked for absence |
| Conversation/database leakage | Synthetic text only; default privacy requires null raw text/preview; exports are temporary and removed after checking |
| Automatic trust | Preparation never starts Codex; generated launchers contain no trust bypass |
| Account mutation/publication | No npm account command, publish, tag, release, visibility, workflow, secret, or announcement action exists in the kit |
| Insecure tarball misuse | Directory and notice say `FUNCTIONAL-ONLY-NOT-FOR-RELEASE`; manifest says dependency `BLOCKED` and release use `PROHIBITED` |
| Child-process leak | Synchronous children are bounded; MCP clients close in `finally`; the safety test proves timed-out child termination |
| Manual evidence inflation | Checker reports trust/UI/model/desktop/IDE fields as `NOT OBSERVED` |

## Reviewed prohibited content

The new tracked files were reviewed for:

- absolute maintainer paths;
- npm tokens and `.npmrc` contents;
- account email and recovery data;
- private conversation or database content;
- unsafe shell interpolation and `shell: true`;
- path traversal and cleanup outside the root;
- environment dumps and unbounded diagnostics;
- privacy-marker disclosure;
- automatic Codex trust; and
- automatic npm/GitHub account mutation.

No prohibited tracked content was found. Temporary manifests contain only disposable paths, a commit, a
marker digest, timestamps, and content-free control metadata. They are not committed.

## Residual risks

- A human can still approve an unexpected Codex trust prompt; generated instructions require file review.
- Functional tarballs retain the blocked Hono dependency and must never be published.
- Live Codex model/UI behavior, npm 2FA, and account recovery cannot be proven by repository automation.
- Name availability can change at any time.
- Cleanup deliberately refuses an unprovable root, so an anomalous temporary directory may require human
  inspection rather than automatic deletion.

The security review does not clear v0.1.0 for release.
