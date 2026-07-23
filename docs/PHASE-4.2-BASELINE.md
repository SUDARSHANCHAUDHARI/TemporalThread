# Phase 4.2 baseline

Baseline captured: 2026-07-23

## Repository state

| Item | Verified state |
| --- | --- |
| Repository | `SUDARSHANCHAUDHARI/TemporalThread` |
| Branch | `main` |
| Local/remote status | Clean; local `main` tracks `origin/main` |
| Baseline commit | `c074628fa97b85d34cd18431b97949bf6de7cf72` |
| Phase 4.1 implementation commit | `9cfeff15f3879fa34129efec1a26b3c7009c4618` |
| Visibility | Private, verified read-only through the GitHub API |
| Version | `0.1.0`, unreleased |
| Git tags | None |
| GitHub releases | None recorded by the Phase 4.1 audit |
| Overall release decision | **NO-GO** |

## Dependency blocker

The distribution security blocker remains open. Clean npm and pnpm consumers of the eight Phase 4.1
functional tarballs resolved `@modelcontextprotocol/sdk@1.29.0` with vulnerable
`@hono/node-server@1.19.14`. The workspace override to Hono 2.0.10 does not propagate to registry consumers.
The release dry run therefore fails closed before artifact or SBOM generation on Ubuntu, macOS, and Windows.

Phase 4.2 must not bypass, weaken, or relabel this gate. If a secure stable SDK becomes available, its
adoption belongs in a separate Phase 4.3 dependency-upgrade task and publication remains blocked until that
task passes.

## npm publication and authority

- None of the eight intended package names has been published by this project.
- The Phase 4.1 registry check returned `404 Not Found` for the unscoped `temporalthread` name and all seven
  scoped names.
- Name availability is only a point-in-time read-only signal and grants no ownership.
- npm account access, the authenticated username, `@temporalthread` scope authority, public scoped-package
  publish permission, write 2FA, recovery readiness, and a backup trusted owner remain unverified.
- No npm organization, package, token, trusted-publisher relationship, or publication workflow was created.

## Existing Codex evidence

Automated Phase 4/4.1 verification already covers:

- isolated functional package installation;
- project-scoped Codex installation, doctor, status, and uninstall;
- MCP stdio startup and exact nine-tool discovery;
- the canonical `temporal-awareness` skill and managed hook files;
- default `temporal-references-only` privacy;
- controlled interaction/context/commitment behavior;
- uninstall preserving the isolated database; and
- explicit purge removing isolated domain data.

This evidence does not prove real Codex CLI/desktop discovery, trust prompts, UI skill visibility, model
behavior, terminal restart `PATH`, or IDE fallback behavior. Live host certification remains manual.

## Manual items still unresolved

1. Confirm the intended npm account and username without exposing private account data.
2. Confirm `@temporalthread` scope ownership and public publish authority.
3. Confirm write-protecting npm 2FA and recovery readiness without reading or storing recovery codes.
4. Decide whether to create an npm organization and whether to add a second trusted owner.
5. Run the isolated certification project in a real Codex CLI and, when applicable, Codex desktop.
6. Review and approve only the expected project and hook trust prompts.
7. Record live results in the privacy-safe certification template.
8. Supply explicit approval for visibility, npm publication, a Git tag, a GitHub release, and announcement.

## Prohibited Phase 4.2 actions

Phase 4.2 must not:

- publish or reserve an npm package name;
- create an npm organization, membership, role, token, trusted publisher, or GitHub publishing secret;
- enable, disable, or otherwise modify npm 2FA;
- access, request, print, transmit, store, or commit recovery codes;
- create or push a Git tag or create a GitHub release;
- change repository visibility or announce the project publicly;
- modify the maintainer's real `.codex`, `.agents`, TemporalThread data, npm configuration, or account state;
- approve Codex project or hook trust;
- call functional-test tarballs release candidates;
- reuse superseded Phase 4 artifacts;
- weaken the secure packed dependency gate; or
- force-push.

## Expected Phase 4.2 decision

The expected phase result is **MANUAL CERTIFICATION KIT READY** if safe setup/check/cleanup tooling,
cross-platform tests, documentation, and automated verification pass. The overall v0.1.0 decision remains
**NO-GO** until the packed dependency blocker is resolved and every required manual approval has explicit
evidence.
