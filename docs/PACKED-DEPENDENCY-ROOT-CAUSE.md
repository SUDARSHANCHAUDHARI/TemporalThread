# Packed dependency root cause

Verified: 2026-07-22

Baseline: `8c9c843fc474527e4315dc579420cb3f09b5e3ad`

## Exact dependency path

`@temporalthread/mcp-server@0.1.0` and `@temporalthread/codex-integration@0.1.0` each declare the exact
runtime dependency `@modelcontextprotocol/sdk@1.29.0`. The SDK declares
`@hono/node-server: ^1.19.9` in its published package metadata.

The CLI therefore has two logical paths:

```text
temporalthread@0.1.0
→ @temporalthread/mcp-server@0.1.0
→ @modelcontextprotocol/sdk@1.29.0
→ @hono/node-server@1.19.14

temporalthread@0.1.0
→ @temporalthread/codex-integration@0.1.0
→ @modelcontextprotocol/sdk@1.29.0
→ @hono/node-server@1.19.14
```

npm may display a single deduplicated SDK/Hono instance under one root package. pnpm displays the separate
paths. Deduplication changes presentation and disk layout, not the selected version or advisory result.

## Why 1.19.14 is selected

The caret range `^1.19.9` accepts versions from 1.19.9 up to, but not including, 2.0.0. Version 1.19.14 is
the highest available compatible 1.x release. The first patched Hono node-server is 2.0.5, and the current
release is 2.0.11, so no patched version satisfies the SDK's declared range.

Hono node-server 2.0.10 does **not** satisfy `^1.19.9`. Adding 2.0.11 directly to a clean npm consumer was
tested and produced two installed copies: direct 2.0.11 plus nested 1.19.14 under the SDK. The audit remained
failed. A direct dependency therefore cannot reliably dedupe or remove the vulnerable nested copy.

The Hono package's peer dependency on `hono@^4` does not widen the SDK's direct node-server dependency.
There is no peer-resolution mechanism that makes node-server 2.x compatible with `^1.19.9`.

## Reproduction boundaries

The clean-consumer proof did not use the monorepo lockfile or install graph:

1. All eight packages were freshly packed.
2. The tarballs were placed under a new operating-system temporary directory outside the repository.
3. npm installed all eight tarballs into a new project with a new package lock and isolated cache.
4. pnpm installed all eight tarballs into a second new project with a new lock and isolated store.
5. The pnpm fixture mapped only unpublished `@temporalthread/*` names to the corresponding local tarballs.
6. Neither fixture declared the MCP SDK, Hono, or `fast-uri` at its root or overrode their resolution.
7. Both installed trees and both production audits were read after installation.

Results:

| Manager | SDK versions | Hono node-server versions | Audit result |
| --- | --- | --- | --- |
| npm 11 | 1.29.0 | 1.19.14 | FAIL; five moderate affected/propagated nodes |
| pnpm 11.9.0 | 1.29.0 | 1.19.14 | FAIL; one moderate advisory |

The different counts are reporting-model differences: npm includes packages affected through the vulnerable
node, while pnpm reports the underlying advisory. Both point to
[GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9).

## Why the source graph differs

The private workspace root declares:

```json
{
  "pnpm": {
    "overrides": {
      "@hono/node-server": "2.0.10",
      "fast-uri": "3.1.4"
    }
  }
}
```

This changes the source lockfile/install graph and makes the source audit clean. It is not copied into any of
the eight package manifests as consumer-root policy. npm explicitly considers overrides only in the root
project, and pnpm overrides are also root-only. A consumer's root is the consumer project, not TemporalThread's
unpublished workspace root.

The clean consumers also create their own lockfiles, so refreshing or committing the source `pnpm-lock.yaml`
cannot alter the published SDK range. The distribution must be fixed through publishable dependency metadata
or an upstream release.

## Reachability and release impact

TemporalThread imports the SDK's MCP client/server and stdio transports. It does not import Hono node-server,
`serveStatic`, or Streamable HTTP and does not open a network listener. The vulnerable static-file operation
is therefore not directly reachable through current TemporalThread code.

This lowers practical exploitability but does not clear the distribution: Hono 1.19.14 remains a production
runtime dependency and clean npm/pnpm audits fail. The release security gate correctly preserves **NO-GO**.
