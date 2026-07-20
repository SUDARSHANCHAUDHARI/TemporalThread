# Codex troubleshooting

Start with the scoped status and doctor commands. Use the same scope and working directory used during
installation:

```sh
temporalthread integrate codex status --scope project
temporalthread integrate codex doctor --scope project
temporalthread integrate codex doctor --scope project --json
```

`PASS` means a check succeeded, `WARN` means the integration can continue with a limitation or missing
optional component, and `FAIL` makes the doctor exit nonzero. Every warning/failure includes a recommended
fix. The doctor intentionally warns that guaranteed session end, transcript capture, and remote MCP are
unsupported.

## MCP server not found or unreachable

Symptoms include a missing MCP entry, `spawn-failed`, `handshake-failed`, `timeout`, or tools absent in
Codex.

1. Run `temporalthread --version` in the same environment that launches Codex.
2. Run `temporalthread doctor`, then the scoped Codex doctor.
3. GUI applications may inherit a different `PATH` from an interactive shell. Install the CLI in a location
   visible to the GUI, or use development mode with an absolute built CLI path.
4. Repair only the MCP component:

   ```sh
   temporalthread integrate codex install --scope project --mcp-only --yes
   ```

5. Restart Codex and inspect its MCP status. The configured server is optional (`required = false`), so a
   startup failure should not block Codex.

## Skill not detected

User scope expects `~/.agents/skills/temporal-awareness/SKILL.md`; project scope expects
`<repo>/.agents/skills/temporal-awareness/SKILL.md`. For project discovery, start Codex within the repository
path and trust the project.

Reinstall only the skill, then start a new session:

```sh
temporalthread integrate codex install-skill --scope project --yes
```

If a same-named skill was edited or installed by another source, the installer preserves it unless ownership
is clear. Review the file and backup before choosing replacement.

## Hook installed but not running

1. Confirm the scoped doctor reports the three supported hooks.
2. Review the exact `temporalthread hook codex` commands in the reported `hooks.json`.
3. Accept Codex's hook trust prompt. Installation cannot approve its own hooks; changed hook content may
   require trust again.
4. Start a new session after installation or upgrade.
5. Confirm the CLI is visible in the environment Codex uses.
6. Remember that hooks are best effort: abnormal termination may omit `Stop`, and an untrusted, disabled,
   interrupted, or timed-out hook records nothing.

Use `--no-hooks` if lifecycle automation is unwanted. The skill and MCP remain functional.

## Codex configuration parse error

The installer never overwrites malformed TOML or JSON. Repair the reported file manually:

1. Preserve the current file and any `*.backup-*` versions.
2. Use `temporalthread integrate codex print-config --scope <scope>` to print the expected MCP table.
3. Correct the TOML/JSON syntax without removing unrelated settings.
4. Rerun doctor, then install.

Do not restore an entire old backup over newer user changes without reviewing the diff.

## Duplicate or externally owned MCP entry

An unmarked `[mcp_servers.temporal-thread]` entry is treated as externally owned and is not overwritten or
removed. Compare it with `print-config`, choose which owner should manage it, and manually remove or rename
only the unwanted table before rerunning install.

Duplicate TOML tables usually make the configuration invalid; repair them manually. Duplicate managed hook
groups are reported by doctor and normalized by a reviewed reinstall.

## Stale development path

After moving or rebuilding a source checkout, doctor may report that the configured command differs from
installed-package mode or that build output is missing. Rebuild and reinstall the MCP component with the new
absolute path:

```sh
pnpm build
node apps/cli/dist/bin.js integrate codex install \
  --scope project \
  --development-cli /new/absolute/path/to/TemporalThread/apps/cli/dist/bin.js \
  --mcp-only \
  --yes
```

For an installed CLI, omit `--development-cli`.

## Database locked or inaccessible

Hook handling fails open, so Codex should continue without temporal context.

1. Stop extra TemporalThread processes and retry after the current writer completes.
2. Run `temporalthread doctor` to check database integrity and permissions.
3. Verify the configured database directory is writable and has free space.
4. Preserve the database together with `-wal` and `-shm` files before recovery work.
5. Never delete lock-related files while a writer is running; follow [database recovery](SECURITY.md#database-recovery).

SQLite has a bounded busy timeout. The integration does not enter an unbounded retry/restart loop.

## Wrong timezone or unexpected relative date

Inspect and set an IANA timezone:

```sh
temporalthread config get timezone
temporalthread config set timezone Asia/Bangkok
```

The config update creates a backup. Historical phrases remain anchored to the original interaction timestamp
and timezone; changing the current timezone must not reinterpret an old “tomorrow.” If the original event
carried an invalid timezone, the hook safely falls back or omits context rather than inventing a result.

## No temporal context returned

This can be correct. TemporalThread intentionally returns no injected context for an unrelated prompt, a new
project with no data, or a session without a meaningful gap/due commitment/timezone change.

Check:

- `temporalthread timeline` confirms a prior interaction for the expected project;
- project scope and current working directory identify the same repository;
- hooks are trusted, or Codex explicitly called `get_temporal_context`;
- the prompt contains a meaningful cue such as “I'm back,” “continue from last time,” or an elapsed-time
  question;
- a commitment was actually recorded with `record_commitment` rather than inferred from any temporal word.

The skill influences model behavior but cannot guarantee a tool call. Ask Codex explicitly to use
TemporalThread when the missing context matters.

## Model did not record a commitment

Automatic prompt hooks record privacy-permitted interaction metadata/references; they do not create firm
commitments. The model should call `record_commitment` only for a clear future plan. Ambiguous, negated,
quoted, hypothetical, code, log, fixture, and documentation examples must not become commitments.

Ask Codex to record the explicit follow-up, then check:

```sh
temporalthread commitments
```

TemporalThread does not deliver reminders and never marks a commitment complete automatically.

## Surface is unsupported or only partially supported

- Plugin installation: Codex desktop Work/Codex and Codex CLI plugin browser.
- Direct MCP and skills: desktop Codex, Codex CLI, and IDE extension.
- IDE extension plugin installation: unsupported; use direct installation.
- ChatGPT web with this local stdio server: unsupported.
- Mobile: unsupported.

Seeing a plugin in a web-capable catalog does not make the local `temporalthread` process reachable from a
web chat.

## Uninstall left files behind

Ordinary uninstall intentionally preserves:

- unrelated Codex configuration/hooks/skills;
- externally owned or modified files whose ownership is uncertain;
- timestamped backups;
- TemporalThread configuration and the SQLite database.

Read the uninstall warnings and inspect the preserved paths. Remove user-owned leftovers manually only after
confirming their contents. Use `--purge-data --yes` only when the stored TemporalThread domain data should be
deleted as a separate explicit action.
