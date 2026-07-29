# npm personal-scope human actions

Status: owner guide only. Codex must not perform these account mutations.

Official guidance can change; re-open the linked npm documentation immediately before any account or
account action.

## 1. Sign in and confirm identity

Sign in personally to the intended npm account. Compare the website username with read-only `npm whoami`.
Do not share the password, session, token, email address, security-key response, or full profile output.

Current read-only evidence identifies `sudarshanchaudhari`; the owner must confirm this is the durable account
that should control TemporalThread.

## 2. Confirm the personal scope

The owner selected the existing `sudarshanchaudhari` personal npm scope. The seven scoped packages use
`@sudarshanchaudhari/temporalthread-*`; no npm organization is required. Confirm the website account matches
the authenticated CLI identity immediately before publication.

## 3. Confirm public package authority

Confirm every intended scoped package will be public. Public access is a package-level distribution decision,
not something inferred from an available name. The first publish must explicitly use public access.

## 4. Protect writes with 2FA

Review [configuring two-factor authentication](https://docs.npmjs.com/configuring-two-factor-authentication/)
and enable the strongest appropriate authorization/write protection personally if it is not already active.
Never paste an OTP or security-key response into Codex, a terminal transcript, an issue, or this repository.

## 5. Confirm recovery readiness privately

When npm presents recovery codes, store them outside the repository and separate from the second-factor
device, preferably in the owner's password manager. This task must never read, copy, count, regenerate, or
record them.

Confirm access to the account-recovery channel personally. npm's
[2FA recovery guide](https://docs.npmjs.com/recovering-your-2fa-enabled-account/) describes recovery-code and
support-assisted paths. Record only `CONFIRMED` in the checklist.

## 6. Consider continuity

Personal scopes do not provide organization ownership roles. Keep account recovery current; any future
multi-owner distribution model requires a separate decision.

## 7. Recheck names immediately before bootstrap

Availability is not reservation. Immediately before an approved bootstrap, recheck:

- `@sudarshanchaudhari/temporalthread-shared-types`
- `@sudarshanchaudhari/temporalthread-config`
- `@sudarshanchaudhari/temporalthread-temporal-parser`
- `@sudarshanchaudhari/temporalthread-storage-sqlite`
- `@sudarshanchaudhari/temporalthread-core`
- `@sudarshanchaudhari/temporalthread-mcp-server`
- `@sudarshanchaudhari/temporalthread-codex-integration`
- `temporalthread`

Stop if any result conflicts with the release plan.

## 8. Initial package bootstrap

Trusted publishing cannot create ownership for a nonexistent package. The initial package creation therefore
requires a separately approved, interactive, write-protected bootstrap after:

- the dependency blocker is resolved;
- both packed consumer graphs are secure;
- the exact-commit release dry run is green;
- the repository/public provenance decision is approved; and
- personal account identity, 2FA, recovery, and package access are verified.

No bootstrap or publication command belongs in Phase 4.2.

## 9. Configure trusted publishing after ownership exists

npm's [trusted publishing guide](https://docs.npmjs.com/trusted-publishers/) and
[`npm trust` reference](https://docs.npmjs.com/cli/v11/commands/npm-trust/) require an existing package.
Current guidance requires npm 11.5.1+ and Node 22.14+ and supports specified hosted CI providers. Public npm
provenance requires a public package and public repository.

Trusted publishing is deferred because this repository has no approved CI or GitHub Actions. Do not add a
publishing workflow implicitly. A future trusted-publishing setup requires separate owner approval and a
workflow/security review.

## 10. Emergency deprecation and access recovery

After publication, verify the owner can:

- regain account/package access;
- revoke obsolete tokens or trusted publishers;
- deprecate an affected immutable version with an incident message; and
- publish a fixed version after review.

Follow npm's [deprecation guide](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/)
during an approved incident. Prefer deprecation and fix-forward over unpublishing. Do not test emergency
authority by mutating real package metadata.
