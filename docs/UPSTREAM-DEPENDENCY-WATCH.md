# Upstream dependency watch

Last read-only check: 2026-07-26

## Current status

| Item | Current authoritative evidence | Status |
| --- | --- | --- |
| `@modelcontextprotocol/sdk` stable release | npm `latest` is 1.29.0 | BLOCKED |
| SDK Hono dependency | SDK 1.29.0 declares `@hono/node-server: ^1.19.9` | BLOCKED |
| `@hono/node-server` stable release | npm `latest` is 2.0.11 | READ-ONLY VERIFIED |
| Patched Hono line | GHSA lists 2.0.5 as the first patched release; affected versions are `<2.0.5` | READ-ONLY VERIFIED |
| Advisory | `GHSA-frvp-7c67-39w9`, GitHub-reviewed, moderate severity | OPEN/ACTIVE |
| MCP TypeScript SDK issue | `modelcontextprotocol/typescript-sdk#2531` remains open at the check time | OPEN |

Authoritative sources:

- [npm registry metadata for the MCP TypeScript SDK](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [npm registry metadata for the Hono Node adapter](https://www.npmjs.com/package/@hono/node-server)
- [GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9)
- [MCP TypeScript SDK issue #2531](https://github.com/modelcontextprotocol/typescript-sdk/issues/2531)

## Decision

No secure stable SDK upgrade is available as of this check. SDK 1.29.0 cannot resolve Hono 2.x from its
declared range, and Hono 1.19.14 remains vulnerable under the advisory. TemporalThread therefore keeps:

- SDK 1.29.0 unchanged;
- its source-workspace override unchanged;
- the npm and pnpm packed-consumer checks unchanged;
- the secure release gate fail-closed; and
- v0.1.0 at **NO-GO**.

The functional tarballs are disposable local-test inputs only. They are not release candidates and must not be
published.

## Phase 4.3 trigger

Begin a separate Phase 4.3 dependency-upgrade task only after a stable SDK release:

1. permits a patched Hono line;
2. remains compatible with TemporalThread's Node.js and MCP stdio contract;
3. installs without a vulnerable nested Hono copy in clean npm and pnpm consumers; and
4. passes source tests, functional packing, both consumer audits, and the secure release-dry-run matrix.

Finding a new version is not itself release authorization. Publication remains blocked until Phase 4.3
produces fresh green evidence.
