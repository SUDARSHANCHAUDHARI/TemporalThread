# npm scope human actions

Status: owner guide only. Codex must not perform these account mutations.

Official guidance can change; re-open the linked npm documentation immediately before any account or
organization action.

## 1. Sign in and confirm identity

Sign in personally to the intended npm account. Compare the website username with read-only `npm whoami`.
Do not share the password, session, token, email address, security-key response, or full profile output.

Current read-only evidence identifies `sudarshanchaudhari`; the owner must confirm this is the durable account
that should control TemporalThread.

## 2. Decide whether the organization is required

The package plan uses the `@temporalthread` scope, so an npm user or organization must control that scope.
The 2026-07-23 read-only checks did not prove that a `temporalthread` organization is accessible to the
authenticated account.

If the scope is not already owned, make an explicit owner decision before creating it. npm's current
[organization guide](https://docs.npmjs.com/creating-an-organization/) says the organization name becomes
the scope and currently offers an unlimited-public-packages option; review the live plan/billing screen.
Do not let an automated agent create the organization.

## 3. Confirm roles and public package authority

After the organization exists, personally confirm the account's role and developers-team access. npm
documents owner, admin, and member capabilities in
[organization roles and permissions](https://docs.npmjs.com/organization-roles-and-permissions/).

Confirm every intended package can be public. Public access is a package-level distribution decision, not
something inferred from an available name.

## 4. Protect writes with 2FA

Review [configuring two-factor authentication](https://docs.npmjs.com/configuring-two-factor-authentication/)
and enable the strongest appropriate authorization/write protection personally if it is not already active.
Never paste an OTP or security-key response into Codex, a terminal transcript, an issue, or this repository.

If an organization will enforce 2FA, review
[requiring 2FA in an organization](https://docs.npmjs.com/requiring-two-factor-authentication-in-your-organization/)
first: npm warns that members without 2FA can lose organization access.

## 5. Confirm recovery readiness privately

When npm presents recovery codes, store them outside the repository and separate from the second-factor
device, preferably in the owner's password manager. This task must never read, copy, count, regenerate, or
record them.

Confirm access to the account-recovery channel personally. npm's
[2FA recovery guide](https://docs.npmjs.com/recovering-your-2fa-enabled-account/) describes recovery-code and
support-assisted paths. Record only `CONFIRMED` in the checklist.

## 6. Consider a second trusted owner

For continuity, consider a second carefully selected owner after reviewing npm's
[member invitation guidance](https://docs.npmjs.com/adding-members-to-your-organization/). Use least
privilege and account-level 2FA. A second owner is a risk decision, not an automatic Phase 4.2 action.

## 7. Recheck names immediately before bootstrap

All eight names lacked registry entries on 2026-07-23, but availability is not reservation. Immediately before
an approved bootstrap, recheck:

- `@temporalthread/shared-types`
- `@temporalthread/config`
- `@temporalthread/temporal-parser`
- `@temporalthread/storage-sqlite`
- `@temporalthread/core`
- `@temporalthread/mcp-server`
- `@temporalthread/codex-integration`
- `temporalthread`

Stop if any result conflicts with the release plan.

## 8. Initial package bootstrap

Trusted publishing cannot create ownership for a nonexistent package. The initial package creation therefore
requires a separately approved, interactive, write-protected bootstrap after:

- the dependency blocker is resolved;
- both packed consumer graphs are secure;
- the exact-commit release dry run is green;
- the repository/public provenance decision is approved; and
- scope, 2FA, recovery, and package access are verified.

No bootstrap or publication command belongs in Phase 4.2.

## 9. Configure trusted publishing after ownership exists

npm's [trusted publishing guide](https://docs.npmjs.com/trusted-publishers/) and
[`npm trust` reference](https://docs.npmjs.com/cli/v11/commands/npm-trust/) require an existing package.
Current guidance requires npm 11.5.1+ and Node 22.14+ and supports specified hosted CI providers. Public npm
provenance requires a public package and public repository.

After bootstrap, configure each package for the exact approved repository/workflow/environment and restrict
traditional token access. This requires a separate workflow/security review; Phase 4.2 adds no publishing
workflow, secret, environment, or token.

## 10. Emergency deprecation and access recovery

After ownership exists, verify which trusted owners can:

- regain organization/package access;
- revoke obsolete access;
- deprecate an affected immutable version with an incident message; and
- publish a fixed version after review.

Follow npm's [deprecation guide](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/)
during an approved incident. Prefer deprecation and fix-forward over unpublishing. Do not test emergency
authority by mutating real package metadata.
