# Live Codex certification for v0.1.0

Status: Phase 4.2 certification kit prepared; real-host certification MANUAL

This plan never modifies the maintainer's real TemporalThread database or real project configuration. Use a
temporary, non-sensitive project and the packed release candidate. Do not weaken project or hook trust, copy
credentials, or test with a real conversation.

## Automated evidence

The automated suite and Phase 4.2 certification safety tests prove:

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

From the clean Phase 4.2 commit on Node.js 24:

```sh
pnpm run certify:codex:prepare
```

The script creates a new system-temp root, isolated setup/Codex/TemporalThread homes, isolated npm/pnpm
cache/store/temp directories, a project containing spaces and Unicode, and an eight-package functional
consumer. It builds and packs current behavior only for disposable testing, labels every archive
`NOT-FOR-RELEASE`, installs the project-scoped integration, runs doctor/MCP/nine-tool/privacy checks, seeds
relative controlled data, and prints an exact cleanup command.

It refuses a dirty source tree, real home, repository root, path escape, or symlink. It does not globally
install a package, launch Codex, approve trust, or modify real user data. The functional packages retain the
SDK/Hono blocker and are prohibited from publication.

## Project-scoped live test

Review the generated instruction file, `.codex/config.toml`, `.codex/hooks.json`, ownership manifest, and
`.agents/skills/temporal-awareness/SKILL.md`. Launch Codex manually with the generated platform launcher. It
uses the supported isolated `CODEX_HOME` and temporary executable/data paths. Approve only the expected
temporary project's trust prompt and exact TemporalThread hook commands after reviewing them. Do not bypass
trust or change Codex security settings.

Then verify in the host:

1. The `temporal-thread` MCP server is healthy and exactly nine expected tools are present.
2. The `temporal-awareness` skill is discoverable.
3. Use the seeded interaction at `T_NOW - 4 days - 3 hours` containing “Let's continue tomorrow” and the one
   explicit commitment due 24 hours later.
4. Ask how long it has been. Confirm approximately four days/three hours exact elapsed time and approximately
   three calendar days overdue in the detected local timezone.
5. Start or resume a new host session. Confirm the SessionStart bookkeeping row does not become the reported
   prior meaningful conversation.
6. Confirm Stop returns neutral behavior and never asks Codex to continue a turn.
7. Use only synthetic text for a privacy marker. Stop all TemporalThread processes, inspect the temporary
   SQLite database, and confirm the complete marker is absent while the matched temporal reference may be
   present.

Run the automated checker after the host scenario:

```sh
pnpm run certify:codex:check -- --manifest "<temporary-manifest-path>" --stage installed --exercise-lifecycle
```

The deterministic adapter/storage exercise is not evidence of Codex UI or model behavior. Those fields stay
manual in `docs/LIVE-CODEX-CERTIFICATION-RESULTS.md`.

## Uninstall and cleanup

Use the generated `run-temporalthread-certification` wrapper to uninstall, then check `--stage uninstalled`.
Use the same wrapper for explicit `purge --yes`, then check `--stage purged`. Finally run the exact
marker/UUID-bound cleanup command printed by preparation. Full commands and risk labels are in
`docs/PHASE-4.2-OWNER-RUNBOOK.md`.

## Desktop and IDE fallback

Desktop/IDE processes may not inherit a test shell's PATH. Where applicable, test the documented direct MCP
fallback using the temporary packed CLI entry path and the project's generated configuration. Record whether
restart is required and whether the same MCP/skill behavior appears. Do not claim plugin installation in the
IDE extension; that surface uses direct MCP and skills.

## Certification record

Complete `docs/LIVE-CODEX-CERTIFICATION-RESULTS.md` with privacy-safe labels, versions, trust prompts,
observed tools, expected/actual results, and cleanup result. Screenshots, logs, session recordings, real
prompts, databases, and auth/config files must remain private and are not required repository evidence.
