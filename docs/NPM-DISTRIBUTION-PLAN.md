# npm distribution plan for v0.1.0

Status: prepared, not approved for execution
Registry check: 2026-07-20
Publication performed: no

## Decision: model B

TemporalThread must publish the unscoped CLI plus seven required scoped packages. The packed CLI manifest
contains registry dependencies on all seven `@temporalthread/*` packages, and those packages depend on one
another. Publishing only `temporalthread` would produce an uninstallable registry package. Bundling all
workspace code into the CLI would be an architecture and build change outside this release audit.

The root `@temporalthread/workspace` package and all three example packages remain private and must never be
published.

## Intended public package set

| Order group | Package | Version | Access | Runtime purpose |
| --- | --- | --- | --- | --- |
| 1 | `@temporalthread/shared-types` | 0.1.0 | Public | Schemas and domain types |
| 2 | `@temporalthread/config` | 0.1.0 | Public | Configuration and local paths |
| 2 | `@temporalthread/temporal-parser` | 0.1.0 | Public | Deterministic temporal parsing |
| 2 | `@temporalthread/storage-sqlite` | 0.1.0 | Public | SQLite persistence; direct native dependency |
| 3 | `@temporalthread/core` | 0.1.0 | Public | Service and clock abstractions |
| 4 | `@temporalthread/mcp-server` | 0.1.0 | Public | Local stdio MCP transport |
| 4 | `@temporalthread/codex-integration` | 0.1.0 | Public | Codex installer, plugin, hooks, and skill contracts |
| 5 | `temporalthread` | 0.1.0 | Public | User-facing CLI and MCP entry point |

Every public manifest now has a description, MIT license, Node `>=24.0.0` engine, public `publishConfig`,
repository directory, homepage, issue URL, and a strict files allowlist. Packing rewrites `workspace:*` to
the exact coordinated version `0.1.0`; verified tarballs contain no `workspace:`, `file:`, or `link:` runtime
specifier.

## Registry and ownership evidence

The authenticated npm CLI identifies the current account as `sudarshanchaudhari`. All eight intended names
returned `E404` on 2026-07-20, meaning no public package was visible at check time. This is a point-in-time
observation, not a reservation.

The npm organization lookup for `temporalthread` returned `E403`, and the account profile endpoint also
returned `E403`. Therefore:

- control of the `@temporalthread` scope is not established;
- npm two-factor-authentication status is not verifiable with the current credential;
- all scoped publication is BLOCKED;
- no package name has been reserved.

Do not rename packages automatically. If the scope cannot be obtained, the safe alternative is a separately
approved coordinated rename to a scope the maintainer controls, such as `@sudarshanchaudhari/*`; that change
would affect manifests, imports, docs, tarballs, tests, and the package order.

## Account and provenance requirements

Before the first publication, the maintainer must:

1. Establish and verify ownership of the `temporalthread` npm organization/scope.
2. Verify two-factor authentication and recovery access on the owning npm account.
3. Recheck all eight names immediately before publication.
4. Make the source repository public before a provenance-bearing publish. npm states that provenance is not
   generated for a private source repository.
5. Protect the future publication job with a GitHub environment and required approval.
6. Prefer npm trusted publishing/OIDC after each package exists. It uses short-lived credentials and requires
   `id-token: write` only in the publishing job.

npm trusted-publisher configuration requires an existing package. For the initial package creation, use an
explicitly approved bootstrap method: either an interactive 2FA-protected publish by the owner or a narrowly
scoped, short-lived granular token in a protected GitHub environment. Revoke a bootstrap token immediately
after configuring trusted publishing for all eight packages. Do not use a classic or broadly scoped token.

Official references: [trusted publishing](https://docs.npmjs.com/trusted-publishers/),
[provenance](https://docs.npmjs.com/generating-provenance-statements/), and
[public scoped packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).

## Future publication commands

These commands are destructive public actions. They are documentation only and must not be run until scope
ownership, repository visibility, manual Codex certification, release approval, and a clean release-dry-run
artifact are all confirmed.

Run from the exact tagged checkout in a protected GitHub-hosted publication job. For initial bootstrap with
a protected granular token, configure `NODE_AUTH_TOKEN` as an environment secret without printing it. With
trusted publishing, omit the token and let npm obtain the OIDC credential.

```sh
npm publish release-artifacts/temporalthread-shared-types-0.1.0.tgz --access public --provenance

npm publish release-artifacts/temporalthread-config-0.1.0.tgz --access public --provenance
npm publish release-artifacts/temporalthread-temporal-parser-0.1.0.tgz --access public --provenance
npm publish release-artifacts/temporalthread-storage-sqlite-0.1.0.tgz --access public --provenance

npm publish release-artifacts/temporalthread-core-0.1.0.tgz --access public --provenance

npm publish release-artifacts/temporalthread-mcp-server-0.1.0.tgz --access public --provenance
npm publish release-artifacts/temporalthread-codex-integration-0.1.0.tgz --access public --provenance

npm publish release-artifacts/temporalthread-0.1.0.tgz --access public --provenance
```

Verify registry metadata after each dependency group before publishing its dependents:

```sh
npm view @temporalthread/shared-types@0.1.0 name version dist.integrity repository --json
npm view @temporalthread/config@0.1.0 name version dist.integrity repository --json
npm view @temporalthread/temporal-parser@0.1.0 name version dist.integrity repository --json
npm view @temporalthread/storage-sqlite@0.1.0 name version dist.integrity repository --json
npm view @temporalthread/core@0.1.0 name version dist.integrity repository --json
npm view @temporalthread/mcp-server@0.1.0 name version dist.integrity repository --json
npm view @temporalthread/codex-integration@0.1.0 name version dist.integrity repository --json
npm view temporalthread@0.1.0 name version bin engines dist.integrity repository --json
npm install --global temporalthread@0.1.0
temporalthread --version
temporalthread --help
```

The global install must use a disposable prefix during certification so it cannot replace a real global
installation. Follow `docs/LIVE-CODEX-CERTIFICATION.md` for the isolated host test.

## Recovery from a bad release

Published versions are immutable and `0.1.0` cannot be reused after unpublishing. Prefer:

1. Stop publishing dependents if a dependency group fails verification.
2. Deprecate the affected version with a concise migration warning.
3. Fix the issue and publish a new version.
4. Update release notes and the GitHub release; never replace an existing tag or tarball.

npm recommends deprecation over unpublishing because removal can break consumers. Unpublishing is restricted
and creates a 24-hour name lock; use it only for an urgent accidental disclosure after confirming the current
policy and incident plan. See npm's [deprecation guidance](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/)
and [unpublish policy](https://docs.npmjs.com/policies/unpublish/).

## Remaining limitations and risks

- Scope ownership and account 2FA are currently unverified blockers.
- Name availability can change between audit and release.
- An eight-package initial publish can stop partway; dependency-order verification limits but cannot remove
  that registry transaction risk.
- `better-sqlite3` needs a compatible prebuilt binary or native build toolchain.
- Byte-for-byte cross-platform tarball reproducibility has not been established.
- npm installation does not certify current Codex trust prompts or live host behavior.
