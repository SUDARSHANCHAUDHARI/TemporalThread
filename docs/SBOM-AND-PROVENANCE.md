# SBOM and provenance plan

Status: SBOM tooling implemented; exact v0.1.0 SBOM generation owner-approved

## SBOM result

TemporalThread generates SPDX 2.3 JSON without adding a permanent dependency:

```sh
pnpm release:sbom -- --output release-artifacts/temporalthread-v0.1.0.spdx.json
```

The generator reads `pnpm list -r --prod --depth Infinity --json` plus
`pnpm licenses list --prod --json`, removes installation paths, walks only the eight release packages, and
emits deterministic package/relationship ordering. The historical commit-`dc2c0b4` candidate contains 140
local, direct, and transitive package records and 247 relationships.

The SBOM is generated locally from the exact clean release commit and attached to the GitHub release rather
than committed. Its namespace binds the version, source commit, and production graph digest. A dirty source
tree is explicitly marked and must not be used for publication evidence.

The historical SBOM is no longer an approved release candidate. The 2026-07-22 packed-consumer security gate
showed that the workspace SBOM/source graph can contain overridden `@hono/node-server@2.0.10` while a registry
consumer resolves vulnerable 1.19.14. Release dry run `29932142666` stopped before generating or uploading a
new SBOM. A future candidate must bind the source graph and separately verify the installed packed-consumer
graph before its SBOM and checksums are accepted.

Merged PR #5 cleared the blocker with SDK 1.30.0, and merged PR #7 verified the final personal-scope package
graph in clean npm and pnpm consumers. Fresh artifact/SBOM generation remains downstream of exact-commit
verification.

## Scope and limitations

- Format: SPDX 2.3 JSON; data license CC0-1.0.
- Scope: the production graph reachable from the eight intended npm packages.
- License source: installed pnpm package metadata.
- Package files are not analyzed, so concluded licenses remain `NOASSERTION`.
- The generator does not resolve legal ambiguity in OR expressions.
- Optional/platform-specific artifacts can vary after installation.
- The SBOM is not signed and is not an npm or GitHub provenance attestation.
- Byte-for-byte tarball reproducibility across operating systems is not established.

`scripts/verify-release-artifacts.mjs` validates the SPDX document shape and requires all eight local packages
at 0.1.0. Release review should also compare the package count/license buckets with the frozen lockfile and
open a sample of direct dependency records.

## Artifact integrity

`scripts/build-release-artifacts.mjs` writes sorted `SHA256SUMS` entries for all eight tarballs and a manifest
containing package name/version, compressed and unpacked sizes, file count, runtime dependencies, native
requirements, and sorted file paths. The independent verifier reparses every tarball and recomputes every
checksum.

Checksums prove that an artifact matches the reviewed bytes; they do not identify who produced it. Publish
checksums and the SBOM as GitHub release assets only after the same tagged commit passes final approval.

## Future npm provenance

Preferred steady state:

1. The repository is public and the tag points to the reviewed source commit.
2. Each public npm package has a trusted-publisher relationship restricted to this GitHub repository, the
   exact future publish workflow filename, the `npm publish` action, and a protected `npm-production`
   environment.
3. The publication job runs only on GitHub-hosted runners with:

   ```yaml
   permissions:
     contents: read
     id-token: write
   ```

4. Dependencies install from the frozen lockfile without a write token.
5. The job downloads or rebuilds and verifies the reviewed artifact, checks the tag/manifest source commit,
   then publishes in dependency order.
6. npm trusted publishing obtains short-lived OIDC credentials and automatically produces provenance for a
   public package from a public repository.
7. Registry metadata, integrity, provenance, clean installation, and checksums are verified before creating
   the final GitHub release.

Official npm documentation says trusted publishing requires npm CLI 11.5.1+ and Node 22.14+; TemporalThread's
Node 24 and npm 11 toolchain meets that minimum. It also says provenance is unavailable for private source
repositories, so the repository must become public before a provenance-bearing v0.1.0 publish. See
[trusted publishing](https://docs.npmjs.com/trusted-publishers/) and
[generating provenance](https://docs.npmjs.com/generating-provenance-statements/).

## Initial package bootstrap

Trusted-publisher configuration requires an existing package. The first creation of eight new names therefore
needs a separately approved bootstrap:

- verify the authenticated `sudarshanchaudhari` personal scope and npm 2FA;
- make the reviewed repository public;
- use interactive owner publication with write-protection 2FA;
- do not claim provenance for the initial no-CI release;
- consider trusted publishing only after separate CI approval.

No token, environment, trusted-publisher relationship, or publishing workflow is created for v0.1.0.

## GitHub release provenance

For the later approved release:

- create a signed tag where available, otherwise an annotated tag with documented commit verification;
- build from the exact tag with a clean tree;
- attach the eight tarballs, `SHA256SUMS`, `release-manifest.json`, and SPDX SBOM;
- consider GitHub artifact attestations in a separately reviewed workflow with only the permissions their
  official action requires;
- never replace an existing tag or release asset with different bytes.

## Recovery

If registry verification fails, stop the dependency-order publish, deprecate affected versions when
appropriate, fix forward with a new immutable version, and revoke any bootstrap credential. Do not reuse a
published version or rewrite a release tag. Follow `docs/NPM-DISTRIBUTION-PLAN.md` and npm's current
[unpublish policy](https://docs.npmjs.com/policies/unpublish/) before any removal.

## Current gate status

| Gate | Status |
| --- | --- |
| SPDX generation | PASS locally |
| SBOM structural verification | PASS locally |
| Tarball SHA-256 generation/verification | PASS locally |
| Historical clean source association | SUPERSEDED for commit `dc2c0b44f56ec3d21294d2949a8c861238256adc`; no tag created |
| Current packed-consumer dependency gate | PASS locally; SDK 1.30.0 and Hono 2.0.12 in npm and pnpm consumers |
| Current release-candidate SBOM | APPROVED; generate after the release-finalization PR is merged |
| npm provenance | NOT CLAIMED for the initial no-CI release |
| npm personal scope/2FA | Authenticated identity and owner confirmation complete |
| Trusted publisher | Not configured; future public action |
| Signed tag/GitHub release | Owner-approved; pending exact-candidate verification |
