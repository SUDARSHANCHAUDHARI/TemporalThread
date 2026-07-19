# TemporalThread implementation plan

Status: approved build brief, implementation in progress  
Research date: 2026-07-19  
Target release: `0.1.0`

## Outcome

Build a local-first TypeScript MVP that gives MCP-capable agents durable temporal continuity across sessions, projects, agents, and computer restarts. The release is complete only when the local stdio server, CLI, SQLite persistence, privacy guarantees, generic ingestion path, documented host integrations, and full quality gate work together from a clean checkout.

## Verified upstream decisions

The implementation is based on the following current primary sources:

- [MCP specification 2025-11-25: tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) and [transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
- [Official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk). The `main` branch contains pre-alpha v2 work and explicitly recommends v1.x for production until v2 is stable. TemporalThread will therefore pin the current v1 release, `@modelcontextprotocol/sdk@1.29.0`, and use `McpServer.registerTool`, output schemas, `structuredContent`, and `StdioServerTransport` from the [v1 server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/docs/server.md).
- [Codex MCP configuration](https://developers.openai.com/codex/mcp), [Codex hooks](https://developers.openai.com/codex/hooks), and [Codex skills](https://developers.openai.com/codex/skills). Current Codex supports local stdio MCP servers, project/user `hooks.json`, `SessionStart`, `UserPromptSubmit`, and `Stop`; the latter two expose `prompt` and `last_assistant_message` respectively.
- [Claude Code MCP](https://code.claude.com/docs/en/mcp), [hooks](https://code.claude.com/docs/en/hooks), and [skills](https://code.claude.com/docs/en/slash-commands). Current Claude Code supports stdio MCP, `SessionStart`, `UserPromptSubmit`, and `Stop`, with stable prompt and final-assistant-message fields.
- [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers/), [plugins](https://opencode.ai/docs/plugins/), and [skills](https://opencode.ai/docs/skills). OpenCode supports local MCP commands, local TypeScript plugins, message/session events, and project skills.
- [Ollama tool calling](https://docs.ollama.com/capabilities/tool-calling) and [chat API](https://docs.ollama.com/api/chat). Ollama is a model runtime whose clients must provide function schemas, execute tool calls, and return `tool` messages; it is not an MCP host that automatically installs TemporalThread into every client.
- [Node.js releases](https://nodejs.org/en/about/previous-releases). Node 24 is the current LTS line. The project will require Node `>=24` and pnpm `>=10`.

## Platform limitations and honest support boundary

MCP provides callable tools; it does not intercept a host's complete conversation history. Automatic capture is possible only when a host exposes suitable lifecycle events and the user installs and trusts the integration.

For Codex and Claude Code, the MVP can automatically record submitted user prompts and completed assistant messages using documented hook fields. It cannot guarantee capture when hooks are disabled by a user or administrator, are not trusted, time out, are interrupted, or when a turn terminates through a path that does not emit the normal completion hook. Transcript files will not be parsed because their format is not a stable interface.

For OpenCode, the MVP will provide a typed plugin using documented message and session events. It will be marked experimental until its event payloads are verified against an installed compatible OpenCode version in an end-to-end test.

For Ollama, the MVP will provide an example client that explicitly bridges Ollama function calling to TemporalThread's MCP server. Installing Ollama alone does not enable automatic capture or MCP tools.

Every host retains a manual fallback through `temporalthread ingest` and JSONL ingestion. Skills improve model tool-selection behavior but cannot guarantee that a model calls a tool.

## Architecture

```text
Host hook / MCP client / CLI / Ollama example
                    |
         strict Zod input contracts
                    |
       TemporalThread service layer
          /          |          \
  injectable Clock  parser   storage port
                               |
                        SQLite adapter
                               |
                   OS user-data directory
```

Workspace boundaries:

- `packages/shared-types`: public entities, enums, request/response schemas, adapter contracts.
- `packages/config`: validated configuration, OS paths, environment overrides, safe config writes and backups.
- `packages/temporal-parser`: deterministic relative-time extraction and resolution anchored to supplied instants and IANA zones.
- `packages/storage-sqlite`: parameterized SQLite repository, migrations, integrity checks, export, purge, and transaction boundaries.
- `packages/core`: clock abstraction, orchestration, session grouping, privacy enforcement, elapsed-time calculation, commitments, and compact temporal context.
- `apps/mcp-server`: tool registration and stdio transport only; no domain logic.
- `apps/cli`: operational commands and generic ingestion only; no duplicated domain logic.
- `integrations/*`: host configuration, hook/plugin adapters, install/uninstall/doctor scripts, and support notes.
- `skills/*`: host-specific instructions that call the implemented MCP tools.
- `examples/*`: runnable clients that use published package APIs.

The code will use ESM, strict TypeScript, pnpm workspaces, Vitest, Biome, `better-sqlite3`, Zod, ULIDs, and `@js-temporal/polyfill`. Temporal handles IANA zones, DST disambiguation, calendar arithmetic, and exact elapsed duration without relying on the process timezone.

## Persistence and privacy invariants

- Persist comparison instants as UTC ISO 8601 strings while preserving the supplied IANA timezone and UTC offset.
- Generate monotonic-sortable ULIDs at the service boundary.
- Apply SQLite migrations transactionally and record each applied version.
- Enable WAL, foreign keys, a busy timeout, parameterized statements, and restrictive database permissions where supported.
- Treat idempotency keys as globally unique event identifiers; a duplicate returns the existing record and never creates duplicate references or commitments.
- Select last interactions by `occurredAtUtc`, not insertion order; synthetic session grouping uses the inactivity threshold but never changes temporal ordering.
- `metadata-only`: store no preview, raw text, or extracted expression text.
- `temporal-references-only` (default): process locally, store hashes and matched temporal expressions/resolutions, but no full interaction text.
- `full-local-history`: store raw text only after explicit configuration or per-call selection.
- Never include raw interaction text in logs, thrown error messages, default MCP responses, status output, or doctor output.
- Exports include the locally stored representation and make the active privacy mode explicit. Purge is explicit and scoped, with a confirmation requirement for interactive use and `--yes` for automation.

## Temporal resolution rules

- Every relative expression requires an explicit anchor instant and IANA timezone; the current clock is never substituted during later queries.
- Calendar words such as `tomorrow`, `yesterday`, and `next Friday` resolve in the anchor timezone before conversion to UTC.
- Exact offsets such as `in two hours` use elapsed-time arithmetic.
- Day parts such as `this evening` resolve to documented ranges rather than a fabricated point.
- Fuzzy terms such as `later` and `a few days ago` return fuzzy or unresolved ranges with ambiguity metadata and confidence below 1.
- Ambiguous/nonexistent local wall times expose disambiguation information. The parser will use Temporal's compatible behavior for generated calendar boundaries and report ambiguity rather than silently claiming precision.
- `calculate_elapsed_time` returns both exact elapsed milliseconds/day breakdown and calendar-day difference in the requested zone.

## Incremental delivery plan

### Increment 1: workspace, contracts, config, and storage

Create the workspace manifests, strict compiler/linter/test setup, package contracts, `Clock`/`FakeClock`, validated configuration, SQLite schema, migrations, repository operations, and storage tests.

Verification: formatting, lint, typecheck, focused migration/config tests, build.

### Increment 2: parser and temporal calculations

Implement current time, exact elapsed time, relative resolution, temporal-reference extraction, DST/midnight/leap-day behavior, fuzzy ranges, and deterministic fixtures.

Verification: parser unit tests covering Bangkok tomorrow, midnight, leap day, DST spring/fall, next Friday, later, and malformed timestamps.

### Increment 3: interactions, sessions, commitments, and privacy

Implement agent/project/session upserts, synthetic session grouping, out-of-order interaction recording, idempotency, commitment lifecycle, compact context, timezone-change detection, export, and purge.

Verification: service/storage integration tests for privacy modes, multi-agent/project isolation, restart persistence, overdue/rescheduled commitments, export, purge, and the July 15-to-19 acceptance scenario.

### Increment 4: MCP stdio server

Register all nine tools with strict Zod input and output schemas, concise descriptions, read/write/destructive annotations, structured results, sanitized errors, graceful shutdown, and dependency-injected construction for tests.

Verification: in-process schema tests plus a real stdio client that spawns the built server, lists tools, records an interaction, restarts the process, and retrieves it.

### Increment 5: CLI and generic adapter

Implement `init`, `start`, `doctor`, `status`, `config`, `timeline`, `commitments`, `export`, `purge`, and `ingest`/JSONL support. `init` will be non-destructive, back up modified host configs, report exact changes, and default to `temporal-references-only`.

Verification: CLI process tests with isolated environment directories, deterministic clocks where relevant, doctor failure/success fixtures, malformed JSONL rejection, export, and purge.

### Increment 6: Codex integration

Provide MCP config, project/user installation scripts, uninstall, doctor integration, skill, and hook adapters for `SessionStart`, `UserPromptSubmit`, and `Stop`. Hooks call the CLI adapter and return compact context where the host accepts it. Installers never overwrite config without confirmation and always create backups.

Verification: adapter fixture tests for documented hook JSON, generated config validation, shell syntax checks, and an installed-Codex smoke test when the local version supports the documented events.

### Increment 7: remaining integrations

Provide Claude Code configuration/hook/skill assets using the same tested adapter contract. Provide an OpenCode MCP config and typed plugin skeleton; mark event capture experimental unless verified end-to-end. Provide an Ollama tool-loop example that starts an MCP client, exposes the server's tool schemas to Ollama, executes calls, returns tool messages, and preserves a local conversation ID. Provide generic TypeScript and manual examples.

Verification: hook fixture tests, static configuration validation, example typecheck/build, mocked Ollama tool-loop tests, and optional live checks only when the corresponding host/runtime is installed.

### Increment 8: public release surface

Complete README, architecture/data/privacy/security/integration/roadmap documentation, contribution/community files, MIT license, changelog, and the explicitly requested cross-platform GitHub Actions workflow. CI will run install, lint, typecheck, test, build, and dependency audit on Linux, macOS, and Windows.

Verification: links/commands inspected against real scripts, secret/path scan, placeholder scan, package contents check, full quality gate, and clean-install test in a temporary directory.

## Success criteria

1. `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass on Node 24.
2. A real MCP client launches `temporal-thread` over stdio, validates all tool schemas, records an interaction, and retrieves it after a process restart.
3. The July 15 Bangkok `tomorrow` scenario resolves July 16 and is three calendar days overdue when queried July 19.
4. Exact elapsed time and calendar-day difference remain distinct across DST, midnight, and leap-day fixtures.
5. Default storage contains no complete interaction messages; all three privacy modes are verified by direct database assertions.
6. Duplicate and out-of-order events remain correct, and agent/project/session filters do not cross-contaminate results.
7. Commitments support pending, overdue, completed, cancelled, and rescheduled states without inventing precision.
8. Temporal context remains bounded and never returns a transcript.
9. Export and purge are tested against persisted data.
10. Codex and generic integration paths are implemented and tested; other integrations are labeled according to actual verification evidence.
11. No default network listener, telemetry, paid API, hosted dependency, or LLM API exists in the runtime.
12. Documentation states every automatic-capture limitation and contains no unsupported compatibility claim.

## Final review checklist

- Search for `TODO`, `FIXME`, placeholder, mock-only paths, absolute local paths, personal information, and accidental secrets.
- Inspect the SQLite database directly to prove the default privacy mode stores no complete interaction text.
- Compare raw timestamps, offsets, resolved ranges, human-readable durations, and calendar differences in tests.
- Run an MCP stdio restart test and CLI clean-environment test.
- Run the complete quality gate and dependency audit; report all failures without hiding or weakening checks.
- Produce a release report listing files, architecture, commands, test results, verified/experimental integrations, limitations, and next-release work.
