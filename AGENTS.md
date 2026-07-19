# Repository instructions

- Use Node.js 24 and pnpm 11.9.0.
- Preserve the boundaries between clock, parser, storage, core service, MCP transport, CLI, and host integrations.
- Keep MCP local over stdio. Do not add a listener or remote service without an explicit design and security review.
- Keep `temporal-references-only` as the default. Never enable `full-local-history` implicitly.
- Validate data at public boundaries, parameterize database queries, and never include message text in logs or errors.
- Add deterministic tests with `FakeClock`; tests must not depend on the real date.
- Treat host hooks as best effort. Do not parse undocumented transcript formats or claim automatic capture where the host exposes no reliable event.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before completion.
- Update public documentation and `CHANGELOG.md` when behavior changes.
