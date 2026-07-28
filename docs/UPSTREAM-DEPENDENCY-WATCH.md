# Upstream dependency watch

Last checked and locally verified: 2026-07-28

## Current status

| Item | Current authoritative evidence | Status |
| --- | --- | --- |
| `@modelcontextprotocol/sdk` stable release | npm `latest` is 1.30.0 | VERIFIED |
| SDK Hono dependency | SDK 1.30.0 declares `@hono/node-server: ^1.19.9 \|\| ^2.0.5` | VERIFIED |
| Clean npm and pnpm consumers | Both resolve SDK 1.30.0, Hono 2.0.12, and `fast-uri` 3.1.4 with zero audit findings | PASS |
| `@hono/node-server` stable release | npm `latest` is 2.0.12 | VERIFIED |
| Patched Hono line | GHSA lists 2.0.5 as the first patched release; affected versions are `<2.0.5` | READ-ONLY VERIFIED |
| Advisory | `GHSA-frvp-7c67-39w9`, GitHub-reviewed, moderate severity | OPEN/ACTIVE |
| MCP TypeScript SDK issue | `modelcontextprotocol/typescript-sdk#2531` remains open at the check time | OPEN |

Authoritative sources:

- [npm registry metadata for the MCP TypeScript SDK](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [npm registry metadata for the Hono Node adapter](https://www.npmjs.com/package/@hono/node-server)
- [GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9)
- [MCP TypeScript SDK issue #2531](https://github.com/modelcontextprotocol/typescript-sdk/issues/2531)

## Decision

The stable-upstream trigger has fired. TemporalThread now pins SDK 1.30.0 and no longer needs a root Hono
override. Local source validation and the fail-closed packed verifier pass, including independent clean npm
and pnpm production audits with no known vulnerabilities.

This clears the dependency-security blocker only. v0.1.0 remains **NO-GO** until the owner verifies npm
authority and account security and explicitly approves each publication or public-state action. The generated
tarballs remain disposable local-test inputs and must not be published from this task.

## Local evidence

- Node.js 24.14.0 and pnpm 11.9.0.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- `pnpm test`: 29 files and 168 tests pass.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `pnpm verify:codex-package -- --require-secure-dependencies`: eight tarballs, nine MCP tools, clean npm
  and pnpm consumers, and both production audits pass.

Finding and verifying the dependency fix is not release authorization.
