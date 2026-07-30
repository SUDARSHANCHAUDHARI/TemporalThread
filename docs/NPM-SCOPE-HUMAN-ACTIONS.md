# npm personal-scope human actions

Status: account-safety guide. The v0.1.0 bootstrap is complete; agents must not perform account mutations.

Official guidance can change; re-open the linked npm documentation immediately before any account or
account action.

## 1. Sign in and confirm identity

Sign in personally to the intended npm account. Compare the website username with read-only `npm whoami`.
Do not share the password, session, token, email address, security-key response, or full profile output.

Current read-only evidence identifies `sudarshanchaudhari`; the owner must confirm this is the durable account
that should control TemporalThread.

## 2. Confirm the personal scope

The owner selected the existing `sudarshanchaudhari` personal npm scope. The seven scoped packages use
`@sudarshanchaudhari/temporalthread-*`; no npm organization is required. All seven scoped packages and the
unscoped CLI were published at v0.1.0.

## 3. Confirm public package authority

All seven intended scoped v0.1.0 packages are public. Do not change package access, ownership, or scope
without a separately reviewed owner decision.

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

## 7. Recheck ownership before a future release

The eight names below are now occupied by the published TemporalThread package family. Before an approved
future release, verify ownership and current metadata rather than testing availability:

- `@sudarshanchaudhari/temporalthread-shared-types`
- `@sudarshanchaudhari/temporalthread-config`
- `@sudarshanchaudhari/temporalthread-temporal-parser`
- `@sudarshanchaudhari/temporalthread-storage-sqlite`
- `@sudarshanchaudhari/temporalthread-core`
- `@sudarshanchaudhari/temporalthread-mcp-server`
- `@sudarshanchaudhari/temporalthread-codex-integration`
- `temporalthread`

Stop if any result conflicts with the release plan. Do not mutate ownership or access to test authority.

## 8. Initial package bootstrap outcome

The separately approved interactive v0.1.0 bootstrap completed after:

- the dependency blocker was resolved;
- both packed consumer graphs were secure;
- the release artifacts were associated with the tagged source commit;
- the repository became public; and
- personal account identity, 2FA, recovery, and package access were owner-confirmed.

v0.1.0 is immutable. Never rerun its publication commands or reuse its version.

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
