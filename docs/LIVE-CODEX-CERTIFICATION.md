# Live Codex certification for v0.1.0

Status: automated contract evidence complete; real-host certification MANUAL

This plan never modifies the maintainer's real TemporalThread database or real project configuration. Use a
temporary, non-sensitive project and the packed release candidate. Do not weaken project or hook trust, copy
credentials, or test with a real conversation.

## Automated evidence

The release-candidate scripts and 114 deterministic tests currently prove:

- the real MCP stdio process starts and discovers exactly nine tools;
- all eight intended tarballs install together, including native `better-sqlite3` loading;
- the CLI version/help, initialization, doctor, status, export, uninstall, database preservation, and explicit
  purge paths work;
- the Codex plugin package validates and contains the expected MCP, skill, hook, privacy, and compatibility
  files;
- the project-scoped direct installer writes valid managed MCP, skill, and hook configuration in isolation;
- documented `SessionStart`, `UserPromptSubmit`, and `Stop` payloads parse and remain fail open;
- `SessionStart` bookkeeping does not replace the prior meaningful user/assistant interaction;
- hook input/output bounds, default `temporal-references-only` privacy, and neutral Stop behavior hold;
- complete release-smoke prompt text is absent from SQLite under the default privacy mode;
- paths with spaces and Unicode are exercised without writing to a real Codex or TemporalThread home.

These checks validate TemporalThread and its generated configuration. They do not establish trust inside a
particular Codex release.

## Host versions observed during Phase 4

| Evidence | Result |
| --- | --- |
| Operating system | macOS/Darwin 25.5.0 arm64 |
| Codex CLI version command | `codex-cli 0.144.5` |
| Codex desktop version | Not established from the release-audit environment |
| Real project/hook trust | Not tested |
| Real plugin/MCP/skill discovery | Not tested |

The CLI version observation is read-only and is not a live integration PASS.

## Manual evidence required

The release owner must record:

- current Codex CLI version and desktop version where applicable;
- operating system and terminal used;
- packed candidate checksum and source commit;
- project trust and hook-trust prompts reviewed;
- direct MCP or plugin discovery and all nine visible tools;
- `temporal-awareness` skill discovery;
- new-session activation and resumed-session context;
- a controlled July 15→19 scenario or an equivalent four-day interval;
- proof that a `SessionStart` event does not mask the prior user/assistant interaction;
- default database privacy inspection using synthetic text only;
- project-scoped uninstall and database preservation;
- explicit purge behavior;
- PATH behavior after terminal restart;
- desktop/IDE direct-install fallback where applicable.

## Safe test preparation

1. Download one operating-system artifact from a successful `Release dry run` workflow and verify its
   `SHA256SUMS` file before use.
2. Create a disposable directory outside any real project. Give it a name containing spaces and Unicode.
3. Inside that directory, create a private consumer `package.json` whose dependencies map all eight package
   names to their downloaded `file:` tarballs. Use the same `allowBuilds`/override layout exercised by
   `scripts/verify-codex-package.mjs`.
4. Run `pnpm install --frozen-lockfile` if the fixture has a generated lockfile, otherwise perform the first
   isolated install and preserve that lockfile with the certification evidence.
5. Add only the consumer's `node_modules/.bin` directory to PATH for the test shell.
6. Point `TEMPORALTHREAD_HOME` to a new directory under the disposable root.
7. Confirm `temporalthread --version` returns `0.1.0` and run `temporalthread doctor`.

Do not install globally over an existing `temporalthread` command. Do not alter the real user-level Codex
configuration.

## Project-scoped live test

From a new temporary test project:

```sh
temporalthread init --yes --timezone Asia/Bangkok --integration codex --json
temporalthread integrate codex install --scope project --dry-run --json
temporalthread integrate codex install --scope project --yes --json
temporalthread integrate codex doctor --scope project --json
```

Review the generated `.codex/config.toml`, `.codex/hooks.json`, and
`.agents/skills/temporal-awareness/SKILL.md`. Launch the real Codex CLI from the same test shell so it inherits
the temporary PATH and `TEMPORALTHREAD_HOME`. Approve only the expected temporary project's trust prompt and
the exact TemporalThread hook commands after reviewing them. Do not bypass trust or change Codex security
settings.

Then verify in the host:

1. The `temporal-thread` MCP server is healthy and exactly nine expected tools are present.
2. The `temporal-awareness` skill is discoverable.
3. Record a synthetic user interaction anchored at `2026-07-15T20:00:00+07:00` containing “continue
   tomorrow,” then record a separate explicit commitment with the same anchor.
4. Ask the tools to resolve `tomorrow` at that anchor and calculate elapsed time through
   `2026-07-19T23:00:00+07:00`. Confirm July 16 resolution, four days/three hours exact elapsed time, and three
   calendar days overdue at the controlled return point.
5. Start or resume a new host session. Confirm the SessionStart bookkeeping row does not become the reported
   prior meaningful conversation.
6. Confirm Stop returns neutral behavior and never asks Codex to continue a turn.
7. Use only synthetic text for a privacy marker. Stop all TemporalThread processes, inspect the temporary
   SQLite database, and confirm the complete marker is absent while the matched temporal reference may be
   present.

The deterministic fake-clock version of this scenario is already automated. The manual host step certifies
Codex discovery, trust, activation, and real lifecycle delivery—not a new parser result.

## Uninstall and cleanup

From the same temporary project and environment:

```sh
temporalthread integrate codex uninstall --scope project --yes --json
temporalthread status --json
```

Confirm managed project MCP, hook, skill, and manifest content is removed, unrelated project configuration
is preserved, and the database still exists. Only after recording preservation evidence, test explicit data
deletion:

```sh
temporalthread purge --yes --json
temporalthread status --json
```

Remove the disposable project, consumer, npm prefix, and TemporalThread test home after closing Codex and all
MCP processes. Do not purge or delete the real TemporalThread home.

## Desktop and IDE fallback

Desktop/IDE processes may not inherit a test shell's PATH. Where applicable, test the documented direct MCP
fallback using the temporary packed CLI entry path and the project's generated configuration. Record whether
restart is required and whether the same MCP/skill behavior appears. Do not claim plugin installation in the
IDE extension; that surface uses direct MCP and skills.

## Certification record

Attach a text-only, privacy-reviewed record to the release decision with versions, commands, trust prompts,
observed tool names, expected/actual results, checksum, and cleanup result. Screenshots, session recordings,
real prompts, databases, and auth/config files are neither required nor appropriate evidence.
