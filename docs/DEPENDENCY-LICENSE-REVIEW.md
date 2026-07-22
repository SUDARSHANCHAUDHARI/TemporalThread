# Dependency license engineering review

Review date: 2026-07-20; dependency-resolution follow-up 2026-07-22
Scope: direct and transitive production dependency metadata for the eight v0.1.0 release packages

This is an engineering review, not legal advice. It reports package-manager metadata and common
compatibility observations; counsel or the maintainer must make the final distribution decision.

## Direct production dependencies

| Package | Version | Detected license | Metadata source | Engineering observation |
| --- | --- | --- | --- | --- |
| `@modelcontextprotocol/sdk` | 1.29.0 | MIT | Installed package metadata via `pnpm licenses list --prod` | Permissive; retain its license notice |
| `@js-temporal/polyfill` | 0.5.1 | ISC | Installed package metadata via pnpm | Permissive; retain its license notice |
| `better-sqlite3` | 12.11.1 | MIT | Installed package metadata via pnpm | Permissive; native/prebuilt distribution still needs its notice |
| `commander` | 15.0.0 | MIT | Installed package metadata via pnpm | Permissive; retain its license notice |
| `smol-toml` | 1.7.0 | BSD-3-Clause | Installed package metadata via pnpm | Permissive with attribution/non-endorsement conditions |
| `ulid` | 3.0.2 | MIT | Installed package metadata via pnpm | Permissive; retain its license notice |
| `zod` | 4.4.3 | MIT | Installed package metadata via pnpm | Permissive; retain its license notice |

TemporalThread-to-TemporalThread workspace dependencies use MIT and are shipped as separately licensed
packages in the coordinated set.

## Transitive license inventory

The production graph's detected license expressions are:

- MIT;
- ISC;
- Apache-2.0;
- BSD-2-Clause;
- BSD-3-Clause;
- `(MIT OR WTFPL)`;
- `(BSD-2-Clause OR MIT OR Apache-2.0)`.

No copyleft, proprietary, `UNLICENSED`, unknown, or missing license bucket appeared in the pnpm production
license report. The generated SPDX 2.3 SBOM includes 140 local/direct/transitive package records and carries
the detected declarations without turning them into legal conclusions.

The follow-up source graph resolves `@hono/node-server@2.0.10` and `fast-uri@3.1.4`; both remain MIT-licensed.
A packed consumer instead resolves Hono 1.19.14. That difference does not change the license conclusion, but
it is a separate release-blocking security finding documented in `docs/PHASE-4-SECURITY-REVIEW.md`.

## MIT distribution observation

The detected production licenses are generally permissive and commonly combined with an MIT-licensed
application. Their copyright, license, attribution, and any Apache NOTICE obligations still apply to the
respective dependency material. This review found no metadata-level conflict that prevents TemporalThread's
own source from using MIT.

The npm tarballs do not bundle `node_modules`; dependencies are installed as their own registry packages and
carry their own license files. Each TemporalThread tarball includes TemporalThread's MIT `LICENSE`. If a
future binary, standalone executable, container, installer, or vendored dependency bundles third-party code,
repeat this review and aggregate the required notices into that artifact.

## Attribution and notices

- Preserve dependency `LICENSE`/`NOTICE` files delivered by npm.
- Do not remove copyright or attribution notices from source distributions.
- Check whether any Apache-2.0 dependency supplies a `NOTICE` file before creating a bundled distribution;
  propagate relevant notices when required.
- Include the SPDX SBOM with release-candidate artifacts for traceability.
- A separate top-level `THIRD_PARTY_NOTICES` file is not required for the current non-vendored npm tarball
  model, but is recommended if release assets later bundle dependencies.

## Limitations

- License detection relies on installed package metadata, not legal review of every source file.
- OR expressions are reported as published; this review does not select a license branch on a package
  author's behalf.
- Registry metadata can change when dependencies change; rerun the frozen-lockfile review for every release.
- Optional/platform-specific native artifacts may contain additional notices not visible in a source-only
  metadata scan.

## Release recommendation

License gate: PASS for the current non-vendored npm package model, with the attribution and repeat-review
conditions above. Distribution security gate: FAIL/BLOCKED independently. No legal guarantee is part of this
result.
