# Phase 4.1 baseline

Verification time: 2026-07-22T23:47:35+07:00

Baseline commit: `8c9c843fc474527e4315dc579420cb3f09b5e3ad`

Release status: **NO-GO**

## Repository and release state

- Branch `main` was clean and matched `origin/main` at the baseline commit.
- The remote is `SUDARSHANCHAUDHARI/TemporalThread`; the repository remains private.
- Version 0.1.0 is unreleased. No npm package, Git tag, or GitHub release exists.
- The root workspace is private and uses Node.js 24 with pnpm 11.9.0.
- The eight intended public packages remain at version 0.1.0.
- Existing Phase 4 artifacts predate the packed-consumer advisory gate and are superseded evidence, not
  release candidates.

## Dependency graph

The two publishable packages that declare the MCP SDK are:

| Package | Declared runtime dependency |
| --- | --- |
| `@temporalthread/mcp-server@0.1.0` | `@modelcontextprotocol/sdk@1.29.0` |
| `@temporalthread/codex-integration@0.1.0` | `@modelcontextprotocol/sdk@1.29.0` |

The CLI depends on both packages at the coordinated version 0.1.0. The relevant runtime paths are:

```text
temporalthread@0.1.0
├─ @temporalthread/mcp-server@0.1.0
│  └─ @modelcontextprotocol/sdk@1.29.0
│     └─ @hono/node-server@1.19.14 in a clean consumer
└─ @temporalthread/codex-integration@0.1.0
   └─ @modelcontextprotocol/sdk@1.29.0
      └─ @hono/node-server@1.19.14 in a clean consumer
```

The SDK declares `@hono/node-server: ^1.19.9`. The root workspace separately overrides
`@hono/node-server` to 2.0.10 and `fast-uri` to 3.1.4.

## Source versus distribution result

| Environment | SDK | `@hono/node-server` | `fast-uri` | Production audit |
| --- | --- | --- | --- | --- |
| Source workspace | 1.29.0 | 2.0.10 | 3.1.4 | PASS |
| Clean npm tarball consumer | 1.29.0 | 1.19.14 | 3.1.4 | FAIL; five propagated moderate findings |
| Clean pnpm tarball consumer | 1.29.0 | 1.19.14 | 3.1.4 | FAIL; one underlying moderate advisory |

Both clean consumers installed all eight tarballs copied to a temporary directory outside the repository.
They used new lockfiles and isolated cache/store directories. The pnpm fixture used overrides only to map the
eight unpublished TemporalThread package names to their local tarballs; it did not override the SDK, Hono,
or `fast-uri`.

npm deduped the identical SDK instances in its display, while pnpm displayed both package paths. Both
managers selected the same insecure Hono runtime version.

## Current advisory

[GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9) affects
`@hono/node-server` versions below 2.0.5 and is rated Moderate (CVSS 5.9). On Windows, an encoded backslash in
a static-file path can bypass prefix middleware protecting a `serveStatic` subtree. The attacker needs a
server using the affected static-file serving pattern; the issue does not provide filesystem-root escape.

TemporalThread uses local MCP stdio and does not import `serveStatic` or expose an HTTP listener, so the
affected operation is not directly reachable through TemporalThread's implementation. The package is still
present in the production distribution graph, both clean consumer audits fail, and the release policy does
not accept reachability as a substitute for a patched dependency. The finding remains release-blocking.

Authoritative package metadata checked at the verification time:

- [`@modelcontextprotocol/sdk` on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) lists 1.29.0
  as the latest stable release; it is MIT, supports Node.js 18+, and declares Hono node-server `^1.19.9`.
- [`@hono/node-server` on npm](https://www.npmjs.com/package/@hono/node-server) lists 2.0.11 as latest; the
  2.x line is MIT and requires Node.js 20+.
- [Hono node-server 2.0.5](https://github.com/honojs/node-server/releases/tag/v2.0.5) is the first advisory
  fix. TemporalThread retains 2.0.10 as its minimum accepted 2.x security baseline because the source gate
  already accounts for the later Hono advisories.

## Existing automation status

- Normal CI run
  [`29931945659`](https://github.com/SUDARSHANCHAUDHARI/TemporalThread/actions/runs/29931945659)
  passed Ubuntu, macOS, and Windows at commit `117a097`.
- Non-publishing release dry run
  [`29932142666`](https://github.com/SUDARSHANCHAUDHARI/TemporalThread/actions/runs/29932142666)
  failed closed at the packed dependency security gate on Ubuntu, macOS, and Windows. Artifact and SBOM
  generation did not run.
- At the baseline commit,
  `pnpm verify:codex-package -- --require-secure-dependencies` exits 1 and reports
  `packedDependencySecurity: false`.

## Why the workspace override does not protect consumers

npm applies `overrides` only from the install's root `package.json`; it ignores overrides in installed
dependencies and workspaces. pnpm likewise treats `overrides` as root-project configuration. TemporalThread's
private monorepo root is not included as a controlling root when users install the published packages, so
its override cannot cross the registry boundary. See the official
[npm override rules](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides) and
[pnpm override settings](https://pnpm.io/settings#overrides).

The source workspace is secure for development, but the v0.1.0 npm distribution is not an approved release
candidate. Phase 4.1 starts as **NO-GO**.
