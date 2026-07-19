# Contributing to TemporalThread

Thank you for helping AI agents reason honestly about time across sessions.

## Development setup

Requirements: Node.js 24, pnpm 11.9.0, and a native toolchain supported by `better-sqlite3` when a prebuilt binary is unavailable.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Use a focused branch. Keep changes within the existing package boundaries and add deterministic tests with `FakeClock` for time-dependent behavior. Never use the wall clock in a test assertion.

## Quality gates

Before opening a pull request, run:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod --audit-level high
```

Update documentation and `CHANGELOG.md` for user-visible behavior. Explain privacy, migration, or integration compatibility consequences in the pull request.

## Security and privacy

Do not commit interaction databases, exports, transcripts, secrets, or local agent configuration. New integrations must use stable documented events, avoid shell interpolation, and state any capture limitation. Follow [SECURITY.md](SECURITY.md) for vulnerabilities.

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are accepted under the [MIT License](LICENSE).
