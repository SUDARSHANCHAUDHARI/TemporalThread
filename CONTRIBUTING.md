# Contributing to TemporalThread

Thank you for helping AI agents reason honestly about time across sessions.

## Development setup

Requirements: Node.js 24, pnpm 11.9.0, and a native toolchain supported by `better-sqlite3` when a prebuilt binary is unavailable.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

## Change workflow

- Create a focused branch for each change.
- Open a pull request into `main`.
- Do not push directly to `main`.
- Keep the scope small and avoid unrelated refactors.
- Do not add CI, GitHub Actions, release automation, scheduled jobs, or new infrastructure without explicit owner approval.
- Do not merge a pull request without explicit owner approval.

## Local checks

Before opening a pull request, run only the checks relevant to the change. The normal full local check is:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm audit --prod --audit-level high` before dependency or release work.

Specialized MCP, SQLite recovery, package, artifact, SBOM, and live-host verification scripts are manual tools. They are not routine per-commit requirements and should be used only when the change requires them or the owner approves release preparation.

Update documentation and `CHANGELOG.md` only for user-visible behavior. Explain privacy, migration, or integration compatibility consequences in the pull request.

## Security and privacy

Do not commit interaction databases, exports, transcripts, secrets, tokens, recovery codes, or local agent configuration. New integrations must use stable documented events, avoid shell interpolation, and state capture limitations. Follow [SECURITY.md](SECURITY.md) for vulnerability reporting.

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are accepted under the [MIT License](LICENSE).
