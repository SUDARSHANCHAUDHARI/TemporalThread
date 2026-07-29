# npm distribution plan for v0.1.0

Status: BLOCKED pending owner 2FA/recovery confirmation and explicit publication approval
Registry and account check: 2026-07-29
Publication performed: no

## Decision: model B

TemporalThread must publish the unscoped CLI plus seven required packages under the maintainer's personal
scope. The packed CLI manifest contains registry dependencies on all seven
`@sudarshanchaudhari/temporalthread-*` packages, and those packages depend on one another. Publishing only
`temporalthread` would produce an uninstallable registry package.

The root workspace and all three example packages remain private and must never be published.

## Dependency-security result

Merged pull request `#5` upgraded the stable MCP SDK to 1.30.0 and removed the obsolete root Hono override.
Independent clean npm and pnpm packed consumers both resolved SDK 1.30.0, Hono 2.0.12, and `fast-uri` 3.1.4,
with zero production audit findings. The prior dependency-security blocker is cleared locally. Historical
artifacts remain superseded and must not be published.

## Intended public package set

| Order group | Package | Version | Access | Runtime purpose |
| --- | --- | --- | --- | --- |
| 1 | `@sudarshanchaudhari/temporalthread-shared-types` | 0.1.0 | Public | Schemas and domain types |
| 2 | `@sudarshanchaudhari/temporalthread-config` | 0.1.0 | Public | Configuration and local paths |
| 2 | `@sudarshanchaudhari/temporalthread-temporal-parser` | 0.1.0 | Public | Deterministic temporal parsing |
| 2 | `@sudarshanchaudhari/temporalthread-storage-sqlite` | 0.1.0 | Public | SQLite persistence; direct native dependency |
| 3 | `@sudarshanchaudhari/temporalthread-core` | 0.1.0 | Public | Service and clock abstractions |
| 4 | `@sudarshanchaudhari/temporalthread-mcp-server` | 0.1.0 | Public | Local stdio MCP transport |
| 4 | `@sudarshanchaudhari/temporalthread-codex-integration` | 0.1.0 | Public | Codex installer, plugin, hooks, and skill contracts |
| 5 | `temporalthread` | 0.1.0 | Public | User-facing CLI and MCP entry point |

Every public manifest now has a description, MIT license, Node `>=24.0.0` engine, public `publishConfig`,
repository directory, homepage, issue URL, and a strict files allowlist. Packing rewrites `workspace:*` to
the exact coordinated version `0.1.0`; verified tarballs contain no `workspace:`, `file:`, or `link:` runtime
specifier.

## Registry and ownership evidence

The authenticated npm CLI identifies the current account as `sudarshanchaudhari`. All eight final names
returned `E404` on 2026-07-29, meaning no public package was visible at check time. This is a point-in-time
observation, not a reservation.

The authenticated npm CLI identifies `sudarshanchaudhari`, and the owner approved using that existing personal
scope instead of creating a `temporalthread` organization. The coordinated repository rename uses explicit
`temporalthread-` prefixes to keep the package family identifiable. Two-factor-authentication status and
recovery readiness remain manual owner confirmations, and package-name availability is not a reservation.

## Account and provenance requirements

Before the first publication, the maintainer must:

1. Confirm the authenticated `sudarshanchaudhari` account is the intended long-term owner.
2. Verify two-factor authentication and recovery access on the owning npm account.
3. Recheck all eight names immediately before publication.
4. Make the source repository public before a provenance-bearing publish. npm states that provenance is not
   generated for a private source repository.
5. Approve the initial interactive, 2FA-protected publication explicitly.

npm trusted-publisher configuration requires an existing package. For the initial package creation, use an
explicitly approved interactive, 2FA-protected publish by the owner. No CI or GitHub Actions publishing
workflow is authorized, so the initial release will not claim npm provenance.

Official references: [trusted publishing](https://docs.npmjs.com/trusted-publishers/),
[provenance](https://docs.npmjs.com/generating-provenance-statements/), and
[public scoped packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).

The owner-only sequence, recovery boundaries, role review, and current trusted-publishing prerequisites are
documented in `docs/NPM-SCOPE-HUMAN-ACTIONS.md`; tracked statuses are in
`docs/NPM-AUTHORITY-AND-2FA-CHECKLIST.md`.

## Future publication commands

These commands are destructive public actions. They are documentation only and must not be run until account
2FA/recovery readiness, exact-candidate verification, repository visibility, and explicit publication
approval are confirmed. Run interactively from the exact approved tagged checkout; never print an OTP or
credential.

```sh
npm publish release-artifacts/sudarshanchaudhari-temporalthread-shared-types-0.1.0.tgz --access public

npm publish release-artifacts/sudarshanchaudhari-temporalthread-config-0.1.0.tgz --access public
npm publish release-artifacts/sudarshanchaudhari-temporalthread-temporal-parser-0.1.0.tgz --access public
npm publish release-artifacts/sudarshanchaudhari-temporalthread-storage-sqlite-0.1.0.tgz --access public

npm publish release-artifacts/sudarshanchaudhari-temporalthread-core-0.1.0.tgz --access public

npm publish release-artifacts/sudarshanchaudhari-temporalthread-mcp-server-0.1.0.tgz --access public
npm publish release-artifacts/sudarshanchaudhari-temporalthread-codex-integration-0.1.0.tgz --access public

npm publish release-artifacts/temporalthread-0.1.0.tgz --access public
```

Verify registry metadata after each dependency group before publishing its dependents:

```sh
npm view @sudarshanchaudhari/temporalthread-shared-types@0.1.0 name version dist.integrity repository --json
npm view @sudarshanchaudhari/temporalthread-config@0.1.0 name version dist.integrity repository --json
npm view @sudarshanchaudhari/temporalthread-temporal-parser@0.1.0 name version dist.integrity repository --json
npm view @sudarshanchaudhari/temporalthread-storage-sqlite@0.1.0 name version dist.integrity repository --json
npm view @sudarshanchaudhari/temporalthread-core@0.1.0 name version dist.integrity repository --json
npm view @sudarshanchaudhari/temporalthread-mcp-server@0.1.0 name version dist.integrity repository --json
npm view @sudarshanchaudhari/temporalthread-codex-integration@0.1.0 name version dist.integrity repository --json
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

- Account write-protection 2FA and recovery readiness remain owner-only blockers.
- No current artifact or SBOM is approved for publication.
- Name availability can change between audit and release.
- An eight-package initial publish can stop partway; dependency-order verification limits but cannot remove
  that registry transaction risk.
- `better-sqlite3` needs a compatible prebuilt binary or native build toolchain.
- Byte-for-byte cross-platform tarball reproducibility has not been established.
- npm installation does not certify current Codex trust prompts or live host behavior.
