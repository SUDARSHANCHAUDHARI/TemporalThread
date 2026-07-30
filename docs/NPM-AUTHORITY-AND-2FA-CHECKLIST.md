# npm authority and account-security record

Last verified: 2026-07-30

No npm account, organization, role, 2FA setting, recovery method, token, or trusted publisher was changed
during this documentation sync. No `.npmrc`, token, email address, recovery code, or complete account profile
was printed or stored.

## v0.1.0 bootstrap outcome

| Requirement | Final status | Evidence |
| --- | --- | --- |
| npm account access | VERIFIED FOR RELEASE | The authenticated initial publication completed |
| npm username/scope | VERIFIED FOR RELEASE | `sudarshanchaudhari` personal scope used |
| Package publish permission | PASS | All eight v0.1.0 packages were published |
| Package names | PASS | The exact eight v0.1.0 names resolve publicly |
| Public scoped access | PASS | Seven scoped runtime packages resolve as public packages |
| Unscoped CLI | PASS | `temporalthread@0.1.0` resolves with the expected bin and Node `>=24` engine |
| Write-protection 2FA | OWNER CONFIRMED | Confirmed privately before publication; no sensitive account data recorded |
| Recovery readiness | OWNER CONFIRMED | Confirmed privately before publication; no recovery details recorded |
| npm organization | NOT APPLICABLE | Personal scope selected; no `temporalthread` organization created |
| Trusted publisher | NOT CONFIGURED | Initial release was interactive and used no CI |
| npm provenance | NOT CLAIMED | Initial no-CI bootstrap release |

## Published package family

1. `@sudarshanchaudhari/temporalthread-shared-types@0.1.0`
2. `@sudarshanchaudhari/temporalthread-config@0.1.0`
3. `@sudarshanchaudhari/temporalthread-temporal-parser@0.1.0`
4. `@sudarshanchaudhari/temporalthread-storage-sqlite@0.1.0`
5. `@sudarshanchaudhari/temporalthread-core@0.1.0`
6. `@sudarshanchaudhari/temporalthread-mcp-server@0.1.0`
7. `@sudarshanchaudhari/temporalthread-codex-integration@0.1.0`
8. `temporalthread@0.1.0`

## Security boundary

- Never commit or print npm tokens, OTPs, recovery codes, private account fields, or `.npmrc` credentials.
- Do not test production authority by mutating package ownership, access, or deprecation metadata.
- Treat v0.1.0 as immutable; fixes require a new version.
- A later publication requires a new owner approval and a fresh account/registry check.
- Trusted publishing or provenance requires a separately approved design and CI workflow.

Official references:

- [npm account access](https://docs.npmjs.com/cli/v11/commands/npm-access/)
- [Configuring two-factor authentication](https://docs.npmjs.com/configuring-two-factor-authentication/)
- [Trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements/)
