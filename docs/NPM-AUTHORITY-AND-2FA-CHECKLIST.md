# npm authority and 2FA checklist

Read-only review date: 2026-07-29

No npm account, organization, package, role, 2FA setting, recovery method, token, or trusted publisher was
changed. No `.npmrc`, token, email address, recovery code, or complete account profile was printed or stored.

Allowed status vocabulary: `PASS`, `READ-ONLY VERIFIED`, `MANUAL`, `BLOCKED`, `NOT PERFORMED`.

| Requirement | Status | Evidence type | Evidence | Human action |
| --- | --- | --- | --- | --- |
| npm account access | READ-ONLY VERIFIED | Authenticated CLI identity check | `npm whoami` succeeded on 2026-07-29 | Confirm this is the account intended to own the project. |
| npm username | READ-ONLY VERIFIED | Authenticated CLI identity check | Username: `sudarshanchaudhari` | Confirm spelling and long-term account ownership. |
| Personal scope selected | PASS | Owner decision plus authenticated identity | Owner approved `@sudarshanchaudhari/temporalthread-*`; no npm organization is required | Preserve the coordinated package names. |
| Package publish permission | MANUAL | Personal-scope bootstrap requirement | Packages do not exist yet; the authenticated owner must complete the first 2FA-protected publish | Confirm immediately before publication. |
| Package name availability | READ-ONLY VERIFIED | Public registry metadata | All eight final names returned E404 on 2026-07-29 | Recheck immediately before publication; availability is not reservation. |
| 2FA enabled for writes | MANUAL | Safe CLI field check inconclusive | The requested 2FA field could not be confirmed without broader profile disclosure | Verify the account's authorization/write protection personally in npm account settings. |
| Recovery codes stored safely | MANUAL | Owner attestation required | Not inspected; codes are prohibited from this repository and session | Confirm offline/password-manager storage without revealing any code. |
| Recovery email/account access | MANUAL | Owner attestation required | Not inspected; no email address was requested or printed | Confirm recovery access personally and record only `CONFIRMED`, never the address. |
| Backup trusted owner | MANUAL | Owner decision required | No second owner was established in Phase 4.2 | Decide whether a trusted second owner is appropriate; use least privilege. |
| Organization requirement | NOT APPLICABLE | Personal npm scope selected | No `temporalthread` organization will be created | None. |
| Public scoped package access | BLOCKED | Packages not created | No package settings exist yet | Publish each scoped package with explicit public access after approval. |
| Trusted-publishing eligibility | BLOCKED | Official npm requirements | Packages must already exist; public provenance also requires a public package/repository and supported hosted CI | Configure separately after ownership exists and only with an approved workflow. |
| Emergency deprecation authority | BLOCKED | Ownership prerequisite absent | No package ownership exists | After bootstrap, verify an owner can deprecate and recover access; do not test by mutating production metadata. |

## Read-only commands selected

Current npm CLI documentation uses:

```sh
npm whoami
npm profile get <property>
npm access list packages <user-or-scope> --json
npm org ls <organization> --json
npm view <package> name version owners --json
```

Only the minimum safe subset was run. Commands that could expose a full package portfolio or account profile
were summarized rather than copied into documentation.

Official references:

- [npm whoami](https://docs.npmjs.com/cli/v11/commands/npm-whoami/)
- [npm profile](https://docs.npmjs.com/cli/v11/commands/npm-profile/)
- [npm access](https://docs.npmjs.com/cli/v11/commands/npm-access/)
- [Organization roles and permissions](https://docs.npmjs.com/organization-roles-and-permissions/)
- [Configuring two-factor authentication](https://docs.npmjs.com/configuring-two-factor-authentication/)
- [Trusted publishing](https://docs.npmjs.com/trusted-publishers/)

This checklist does not authorize account mutation or publication.
