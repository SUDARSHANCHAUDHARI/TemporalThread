# Dependency security solution decision

Decision date: 2026-07-22; outcome verified 2026-07-28

Status: **Selected upstream upgrade verified; preserve release NO-GO**

## Decision

SDK 1.30.0 is the supported upstream solution: its published range permits patched Hono 2.x releases without
leaving a vulnerable nested copy. TemporalThread will still not publish v0.1.0 without the remaining owner
and account-security approvals.

The release gate remains authoritative. SDK 1.30.0 now provides the selected supported range and passes the
clean npm and pnpm evidence. This closes the technical dependency blocker without authorizing publication.

## Decision matrix

| Option | Secure consumer graph | npm compatible | pnpm compatible | Cross-platform | Maintenance risk | Architecture impact | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stable SDK upgrade | Yes; 1.30.0 permits patched Hono 2.x | Yes; verified | Yes; verified | Local source and packed checks pass | Low | Minimal | **Selected and implemented** |
| Direct Hono dependency | No; secure direct copy plus vulnerable nested 1.19.14 | No reliable dedupe | No reliable dedupe | Irrelevant while nested copy remains | Medium | Low | Reject |
| npm `overrides` | Only when the consumer adds it at its root | Root-only | Not portable policy | Resolver-dependent | High consumer burden | Low | Reject |
| pnpm `overrides` | Only in a pnpm root/workspace | Not an npm fix | Root-only | Resolver-dependent | High consumer burden | Low | Reject |
| `npm-shrinkwrap.json` | Potentially for an npm application package | npm-specific | Not equivalent under pnpm | Requires broad retest | High; pins updates | Medium across CLI/libraries | Reject without separate design |
| Bundle MCP runtime | Potentially, if dependency is removed from the visible runtime graph | Possible | Possible | High Windows/native risk | High patch/SBOM burden | High | Reject for Phase 4.1 |
| Fork/vendor/patch SDK | Potentially | Possible | Possible | Must own all support | Very high | Medium/high | Reject |
| Wait for upstream | No release until fixed; avoids insecure consumers | Yes after supported release | Yes after supported release | Must verify three OSes | Low | None now | **Selected** |

## Stable SDK assessment

Registry metadata checked on 2026-07-22 shows `@modelcontextprotocol/sdk@1.29.0` as the latest stable release.
It is MIT-licensed, supports Node.js 18+, preserves the APIs TemporalThread uses, but declares
`@hono/node-server: ^1.19.9`. No release satisfying that range is patched for
[GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9).

The official SDK repository currently describes the next major line as beta. An alpha, beta, release
candidate, Git dependency, unpublished tarball, or fork is not acceptable for this v0.1.0 release without
separate approval. See the [official TypeScript SDK repository](https://github.com/modelcontextprotocol/typescript-sdk).

Upstream issue
[`modelcontextprotocol/typescript-sdk#2531`](https://github.com/modelcontextprotocol/typescript-sdk/issues/2531)
is open and requests a range that can resolve the patched 2.x line. It also records the compatibility reason
for caution: Hono node-server 2.x requires Node.js 20, while SDK 1.x declares Node.js 18 support. TemporalThread
requires Node.js 24, but it cannot redefine the SDK's support contract for all SDK consumers.

## Rejected workaround details

### Direct dependency

A clean npm experiment with direct `@hono/node-server@2.0.11` retained nested 1.19.14 under SDK 1.29.0.
Because 2.x is outside `^1.19.9`, neither npm nor pnpm can dedupe the vulnerable SDK copy. This is not a fix.

### Root overrides

The official [npm package.json documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)
states that overrides are considered only in the root project and ignored in installed dependencies and
workspaces. pnpm's [override setting](https://pnpm.io/settings#overrides) is likewise root-only. Requiring every
consumer to add policy manually is not a supportable npm distribution.

### Shrinkwrap

[`npm-shrinkwrap.json`](https://docs.npmjs.com/cli/v11/configuring-npm/npm-shrinkwrap-json) is publishable and
can be appropriate for registry-deployed applications, daemons, and global CLIs. The TemporalThread release,
however, includes a CLI plus seven libraries consumed through both npm and pnpm. Applying npm-specific locked
resolution across that graph would reduce consumer control, complicate coordinated workspace/native installs,
and retain security updates until manually regenerated. It is not justified solely to force an upstream
major version the SDK does not claim to support.

### Bundling

npm supports [bundled dependencies](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#bundledependencies),
but a safe TemporalThread bundle would need new license notices, source-map handling, ESM and dynamic-import
validation, accurate SBOM enumeration, security patch ownership, Windows testing, and careful exclusion of
native `better-sqlite3`. That is a packaging redesign, not a narrow dependency correction.

### Fork or patch

A local patch does not survive publication unless TemporalThread vendors or publishes a derivative SDK.
Doing so would transfer upstream compatibility and security maintenance to this project. No emergency
exploitability or explicit maintenance approval justifies that cost.

## Upstream acceptance criteria

The selected stable SDK release had to:

1. permits `@hono/node-server@2.0.10` or newer in published metadata;
2. supports Node.js 24 and the existing MCP client/server/stdio APIs;
3. preserves all nine tool schemas and discovery behavior;
4. installs without a vulnerable Hono copy in clean npm and pnpm consumers;
5. passes both production audits with no known vulnerability;
6. passes the secure packed verifier and Ubuntu/macOS/Windows release dry run.

The 1.30.0 upgrade meets criteria 1–5 locally. Criterion 6 included a historical three-platform release
dry run; GitHub Actions are now intentionally absent, so the current repository uses the documented local
source and packed-consumer gates instead. No release artifacts were regenerated.

The historical 1.29.0 tarballs remain superseded and must not be published.

## Verified outcome

On 2026-07-28, SDK 1.30.0 declared `@hono/node-server: ^1.19.9 || ^2.0.5`. TemporalThread removed its root
Hono override. Independent clean npm and pnpm packed consumers both resolved SDK 1.30.0, Hono 2.0.12, and
`fast-uri` 3.1.4; both production audits reported zero vulnerabilities. All source gates and packed functional
checks also passed. Publication remains owner-authorized work outside this decision.
