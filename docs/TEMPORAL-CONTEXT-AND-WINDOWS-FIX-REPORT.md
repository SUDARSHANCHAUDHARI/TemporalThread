# Temporal context and Windows reliability fix report

Completed: 2026-07-20 (Asia/Bangkok)

Fix commit: `1a77b0d77246209910731bae4b0f263126d0a705`

GitHub Actions: `29758559562`

## Outcome

Both confirmed reliability defects are resolved. Packed Codex validation passes on Ubuntu, macOS, and
Windows. A Codex `SessionStart` event can remain stored as lifecycle bookkeeping without replacing the prior
meaningful user or assistant conversation returned by `get_temporal_context`. The exact July 15 to July 19
scenario passes under the default privacy mode.

No package was published, release or tag created, workflow changed, public API renamed, database row deleted,
history rewritten, or repository visibility changed.

## Windows failure and fix

Historical workflow run `29748170508`, Windows job `88371391428`, failed only at `Validate packed Codex
integration`. The packed CLI's `integrate codex install` command returned status `1`, stdout code
`mcp-unavailable`, and empty stderr after the doctor could not start the generated MCP command.

The isolated Windows installation exposed the CLI as `temporalthread.cmd`. Installed MCP configuration tried
to launch `temporalthread start` directly through the no-shell stdio process boundary. Windows batch-command
shims require the command processor, so the MCP process never initialized. Unix package-manager shims are
directly executable, which is why Ubuntu and macOS passed.

Commit `230be46` changed only installed Windows launch configuration to:

```text
cmd.exe /d /s /c temporalthread start
```

Installed macOS/Linux mode remains `temporalthread start`, and development mode still launches the absolute
JavaScript entry point through the configured Node executable. The packed verifier still performs the real
CLI launch, MCP initialization, nine-tool discovery, installer doctor, uninstall, database preservation, and
unrelated-config preservation. It now reports bounded, sanitized command diagnostics without dumping the
environment. Full evidence and alternatives are in
[Windows packed-package failure analysis](WINDOWS-PACKAGE-FAILURE-ANALYSIS.md).

## SessionStart masking failure and fix

The Codex hook adapter performed these operations:

1. `SessionStart` retrieved the correct earlier context.
2. It recorded a new `system` interaction for lifecycle timing.
3. `UserPromptSubmit` called `getTemporalContext()` seconds later.
4. `getTemporalContext()` reused the generic latest-interaction query, which selected the newer lifecycle
   row and reported only seconds since the previous interaction.

The storage boundary now provides a dedicated latest-conversational query restricted to `user` and
`assistant` roles. `getTemporalContext()` uses that row consistently for the returned interaction, elapsed
time, previous session, and timezone comparison. The public `getLastInteraction()` contract is unchanged and
may still return a newer `system` or `tool` row.

This design preserves lifecycle history while making conversational eligibility explicit. It does not use
message-text conventions. A real `Stop.last_assistant_message` remains an eligible assistant interaction; a
`Stop` event without assistant text creates no synthetic interaction.

## Architecture and migration decision

The change remains within existing boundaries:

- SQLite owns the parameterized latest-conversation query.
- The core service owns the difference between generic event history and temporal conversation context.
- The Codex adapter continues to validate events, store lifecycle timing, apply privacy, and inject bounded
  context.
- MCP schemas and tool names are unchanged.

No schema migration was added. Existing `user`, `assistant`, `system`, and `tool` rows remain valid and are not
rewritten or deleted. This is a backward-compatible query-semantics correction. A future meaningful system
conversation type must use an explicit classification instead of relying on message content.

## Tests added or extended

- Core/service regression tests prove that newer `system` and `tool` rows do not mask the latest user or
  assistant conversation.
- Agent, project, and session filtering remains isolated; out-of-order insertion still orders by occurrence
  time; lifecycle-only and missing matches return null safely.
- Timezone-change detection remains anchored to the prior conversation even after current-time lifecycle
  bookkeeping.
- The end-to-end Codex acceptance test now runs the complete July 15 to July 19 sequence through real stdio
  MCP persistence and Codex hook processing.
- Duplicate `SessionStart` and `UserPromptSubmit` delivery remains idempotent, and the explicit commitment
  remains singular.
- `Stop` with a real assistant message makes that response the latest conversation and ends the session.
- Default privacy assertions verify that prompt and assistant text are absent from `raw_text` and
  `text_preview`, injected fields are marked as untrusted, and context remains within 7,000 UTF-8 bytes.
- Existing Windows configuration tests assert the exact command processor vector, while packed validation
  continues to exercise spaces, Unicode, platform separators, real stdio startup, doctor, uninstall, cleanup,
  database preservation, and unrelated configuration.

## July 15 to July 19 acceptance result

At `2026-07-15T20:00:00+07:00` in `Asia/Bangkok`, the user interaction “Let's continue tomorrow.” is recorded.
The reference resolves to the July 16 local-day range (`2026-07-15T17:00:00Z` through
`2026-07-16T17:00:00Z`). One explicit commitment is recorded.

At `2026-07-19T23:00:00+07:00`, duplicate `SessionStart` delivery succeeds without replacing the July 15
conversation. Five seconds later, “I'm back.” receives context containing:

- previous meaningful interaction: July 15 user turn;
- elapsed time: four days and three hours;
- calendar-day difference: four;
- commitment status: overdue;
- overdue calendar days from July 16: three;
- no lifecycle `system` role as the previous conversation;
- no complete July 15 or July 19 prompt text.

The repeated prompt does not create a second interaction or commitment. A subsequent real assistant message
becomes the latest meaningful conversation.

## Local verification

Commands ran with Node.js 24.14.0 and pnpm 11.9.0:

| Command/check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass; 12 workspace projects already current |
| `pnpm format:check` | Pass; 118 files |
| `pnpm lint` | Pass; 118 files |
| `pnpm typecheck` | Pass |
| Focused service/Codex/MCP/acceptance suite | Pass; 4 files, 30 tests |
| `pnpm test` | Pass; 23 files, 114 tests |
| `pnpm build` | Pass |
| `pnpm verify:codex-package` | Pass; 8 tarballs, 48 integration files, 8 plugin files |
| Packed install/uninstall/database preservation | Pass |
| `pnpm run audit` | Pass; no known production dependency vulnerabilities |
| `git diff --check` | Pass |
| Current-tree/history secret and sensitive-file scan | Pass; no finding |

The packed verifier's forced-failure path was also checked locally. It reported the logical operation,
redacted working directory, exit status, signal, and bounded stdout/stderr, without an environment dump.

## GitHub Actions verification

[CI run `29758559562`](https://github.com/SUDARSHANCHAUDHARI/TemporalThread/actions/runs/29758559562)
completed successfully for commit `1a77b0d77246209910731bae4b0f263126d0a705`:

| Job | Result | Packed Codex validation |
| --- | --- | --- |
| Node 24 / Ubuntu | Pass | Pass |
| Node 24 / macOS | Pass | Pass |
| Node 24 / Windows | Pass | Pass |

Every job passed frozen installation, formatting/lint, type checking, all 114 tests, build, packed Codex
integration validation, and the production dependency audit. Windows completed the previously failing packed
step without a skip, mock replacement, matrix exclusion, or `continue-on-error`.

## Privacy and backward compatibility

- `temporal-references-only` remains the default.
- Complete prompts and assistant messages remain absent unless an individual interaction explicitly uses
  `full-local-history`.
- No prompt text, token, secret, or complete environment is added to package-verifier diagnostics.
- Existing databases, migrations, interactions, sessions, commitments, tool schemas, CLI names, and MCP names
  remain compatible.
- `getLastInteraction()` behavior is preserved; only `getTemporalContext()` receives the corrected
  conversational definition.

## Known limitations and release readiness

Automated tests cannot grant Codex project/hook trust or certify every desktop, CLI, antivirus, enterprise
policy, or interactive-shell configuration. The `temporalthread` executable must remain visible to the host's
`PATH`. Best-effort hooks can still be absent, disabled, untrusted, interrupted, or omitted on abnormal host
termination.

The confirmed reliability blockers are resolved, and TemporalThread is ready for the next release audit. It
is not yet certified for public release: clean-machine installation through the intended distribution
channel, current live Codex desktop/CLI trust verification, package provenance, and release-artifact review
remain manual release-audit work.
