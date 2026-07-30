# npm distribution record for v0.1.0

Status: **PUBLISHED**

Registry verification: 2026-07-30

Publication model: unscoped CLI plus seven packages in the maintainer's personal npm scope

## Published package graph

TemporalThread v0.1.0 uses the `temporalthread` CLI plus seven required
`@sudarshanchaudhari/temporalthread-*` runtime packages. Publishing only the CLI would have produced an
uninstallable registry package, so the initial publication followed dependency order.

The root workspace and all example packages remain private and are not part of the npm distribution.

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

Every public manifest has a description, MIT license, Node `>=24.0.0` engine, public `publishConfig`,
repository directory, homepage, issue URL, and a strict files allowlist. Packed workspace references were
rewritten to the exact coordinated version `0.1.0`; verified tarballs contain no `workspace:`, `file:`, or
`link:` runtime specifier.

## Dependency-security result

Merged pull request `#5` upgraded the stable MCP SDK to 1.30.0 and removed the obsolete root Hono override.
Independent clean npm and pnpm packed consumers both resolved SDK 1.30.0,
`@hono/node-server` 2.0.12, and `fast-uri` 3.1.4, with zero production audit findings.

## Registry and ownership result

- The owner used the authenticated `sudarshanchaudhari` personal scope.
- All eight exact v0.1.0 packages resolve publicly.
- `temporalthread@0.1.0` exposes the expected CLI bin, requires Node 24 or newer, and depends on the seven
  coordinated runtime packages.
- The owner confirmed write-protection 2FA and recovery readiness privately before publication.
- No npm organization was created.
- No trusted publisher or GitHub Actions publishing workflow was configured.
- The initial interactive no-CI release does not claim npm provenance.

See [npm authority and account-security record](NPM-AUTHORITY-AND-2FA-CHECKLIST.md) for the disclosure-safe
account boundary.

## Release verification

Read-only consumers can verify the public metadata:

```sh
npm view temporalthread@0.1.0 name version bin engines dist.integrity repository --json
npm view @sudarshanchaudhari/temporalthread-codex-integration@0.1.0 \
  name version dist.integrity repository --json
```

Use an unrelated temporary prefix to test installation without replacing a real global installation:

```sh
npm install --prefix <temporary-prefix> temporalthread@0.1.0
<temporary-prefix>/node_modules/.bin/temporalthread --version
<temporary-prefix>/node_modules/.bin/temporalthread --help
```

On Windows, invoke the generated `.cmd` shim.

## Future releases

Never republish or reuse version 0.1.0. A later release must:

1. select a new semantic version;
2. obtain explicit owner approval for that version's public actions;
3. recheck account access and package ownership without exposing secrets;
4. validate the exact candidate and packed npm/pnpm consumer graphs;
5. generate new version-specific checksums, manifest, and SBOM only after approval;
6. publish in dependency order and verify each group before its dependents; and
7. create an immutable tag and GitHub release only for the reviewed bytes.

Trusted publishing and npm provenance may be considered only through a separately reviewed and
owner-approved CI design. No such workflow is authorized by v0.1.0.

## Recovery from a bad release

Published versions are immutable. Prefer:

1. Stop publishing dependents if a future dependency group fails verification.
2. Deprecate the affected version with a concise migration warning after incident approval.
3. Fix the issue and publish a new version.
4. Update release notes without replacing an existing tag or tarball.

npm recommends deprecation over unpublishing because removal can break consumers. Use unpublishing only for
an urgent accidental disclosure after confirming the current policy and incident plan. See npm's
[deprecation guidance](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/)
and [unpublish policy](https://docs.npmjs.com/policies/unpublish/).

## Remaining limitations and risks

- The initial release has no npm provenance or trusted-publisher attestation.
- An eight-package future publish can stop partway; dependency-order verification limits but cannot remove
  that registry transaction risk.
- `better-sqlite3` needs a compatible prebuilt binary or native build toolchain.
- Byte-for-byte cross-platform tarball reproducibility has not been established.
- npm installation does not certify current Codex trust prompts or live host behavior.
