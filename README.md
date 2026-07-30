# TemporalThread

**Give AI agents a persistent sense of time.**

TemporalThread is a local-first MCP server and CLI that helps AI agents understand when an interaction happened, how much time has passed, what relative phrases meant at the time, and which follow-up commitments are still open.

It stores data locally in SQLite, uses MCP over stdio, opens no network port, collects no telemetry, and does not call an LLM.

## MVP features

- Nine MCP tools for time, elapsed duration, temporal context, interactions, relative-time resolution, and commitments.
- Local SQLite persistence across sessions and restarts.
- Three privacy modes, with `temporal-references-only` as the default.
- Deterministic handling of timezones, DST, midnight, leap days, and supported relative expressions.
- Explicit commitment completion, cancellation, reopening, and rescheduling.
- CLI commands for setup, diagnostics, timeline, commitments, ingestion, export, verified backup, and purge.
- Integration guidance for Codex, Claude Code, OpenCode, generic MCP clients, and Ollama examples.

## Installation

Install the CLI from npm:

```sh
npm install --global temporalthread
temporalthread init
```

To work from source instead:

Requirements:

- Node.js 24 or newer
- pnpm 11.9.0

```sh
pnpm install --frozen-lockfile
pnpm build
cd apps/cli
npm link
temporalthread init
```

Remove a source-linked CLI later with:

```sh
npm unlink --global temporalthread
```

## Basic use

Start the local MCP server:

```sh
temporalthread start
```

Initialize a non-interactive generic setup:

```sh
temporalthread init --yes --timezone UTC --integration generic --json
temporalthread doctor
```

Ingest JSON or JSONL events, using the file from the worked example below:

```sh
temporalthread ingest --file interaction.json --json
temporalthread timeline --session example-session
```

Create a verified SQLite snapshot:

```sh
temporalthread backup --output /private/path/temporalthread-backup.sqlite
```

## Worked example: remember what “tomorrow” meant

Create `interaction.json` with a synthetic interaction:

```json
{
  "eventType": "interaction",
  "role": "user",
  "occurredAt": "2026-01-15T09:00:00Z",
  "timezone": "UTC",
  "agent": {
    "name": "README example",
    "platform": "generic"
  },
  "sessionId": "example-session",
  "text": "Continue tomorrow.",
  "idempotencyKey": "readme-example-user-1"
}
```

Initialize local storage, ingest the event, and inspect the timeline:

```sh
temporalthread init --yes --timezone UTC --integration generic
temporalthread ingest --file interaction.json --json
temporalthread timeline --session example-session
```

The ingestion result contains a `temporalReferences` entry for `tomorrow`, resolved from the original
interaction time to a range beginning at `2026-01-16T00:00:00Z`. With the default
`temporal-references-only` privacy mode, TemporalThread stores that resolution without storing the complete
message text.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `get_current_time` | Return current UTC and local time context |
| `record_interaction` | Store an interaction under the selected privacy mode |
| `get_temporal_context` | Return compact elapsed-time, reference, and commitment context |
| `get_last_interaction` | Return the latest matching interaction |
| `calculate_elapsed_time` | Calculate exact duration and calendar-day difference |
| `resolve_relative_time` | Resolve a phrase against an explicit historical anchor |
| `record_commitment` | Store an explicit follow-up commitment |
| `list_commitments` | List pending, due, overdue, completed, or cancelled commitments |
| `update_commitment` | Complete, cancel, reopen, or reschedule a commitment |

All tool inputs and outputs use strict schemas.

## Privacy modes

| Mode | Stored message data |
| --- | --- |
| `metadata-only` | Identifiers, timestamps, timezone/offset, and hash |
| `temporal-references-only` | Metadata plus matched temporal expressions and resolutions; default |
| `full-local-history` | Metadata, references, preview, and full text |

Full history is never enabled automatically.

## Host integrations

### Codex

```sh
temporalthread integrate codex install --scope project --dry-run
temporalthread integrate codex install --scope project --yes
temporalthread integrate codex doctor --scope project
```

The installer does not approve its own hooks. Review all generated changes and trust prompts.

The Codex package, installer, schemas, hooks, and MCP behavior have repository test coverage. Real Codex CLI/desktop trust, UI, skill discovery, and model behavior remain **not tested** because live-host certification was skipped.

### Claude Code, OpenCode, generic MCP, and Ollama

Setup examples are available under `integrations/` and `examples/`. OpenCode automatic capture remains experimental. Hook-based capture is always best effort and depends on events provided by the host.

See [Integrations](docs/INTEGRATIONS.md) for the support matrix.

## CLI commands

```text
temporalthread init
temporalthread start
temporalthread doctor
temporalthread status
temporalthread config
temporalthread timeline
temporalthread commitments
temporalthread ingest
temporalthread export
temporalthread backup
temporalthread purge
temporalthread integrate codex ...
```

Use `temporalthread <command> --help` for command options.

## Development

All development is branch-and-PR only. Do not push directly to `main`.

Normal local checks:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the production dependency audit before dependency or release work:

```sh
pnpm audit --prod --audit-level high
```

Specialized MCP, SQLite recovery, package, artifact, SBOM, and live-host verification scripts are manual tools. They are not required for every commit.

**No GitHub Actions workflows are enabled.** CI, release automation, tags, releases, publication, and repository visibility changes require explicit owner approval.

## Current release status

TemporalThread v0.1.0 was published to
[npm](https://www.npmjs.com/package/temporalthread) and
[GitHub](https://github.com/SUDARSHANCHAUDHARI/TemporalThread/releases/tag/v0.1.0) on July 29, 2026. It is an
MVP release, not a claim of production readiness.

The CLI, package, installer, privacy boundaries, and MCP behavior have automated local coverage. Real Codex
CLI/desktop trust, UI, skill discovery, lifecycle delivery, and model behavior remain uncertified, and
hook-based capture remains best effort.

See the [live Codex certification results](docs/LIVE-CODEX-CERTIFICATION-RESULTS.md) for the untested host
surfaces.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA-MODEL.md)
- [Privacy](docs/PRIVACY.md)
- [SQLite backup and recovery](docs/SQLITE-RECOVERY.md)
- [Codex integration](docs/CODEX-INTEGRATION.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Roadmap](docs/ROADMAP.md)
- [Changelog](CHANGELOG.md)

TemporalThread is available under the [MIT License](LICENSE).
