# Codex installation

TemporalThread supports an official-format Codex plugin and a direct CLI installer. The direct installer is
the fallback for the IDE extension, project-specific configuration, and users who do not use a plugin
marketplace.

No TemporalThread package or plugin has been published from this repository yet. The source and packed
artifacts are release-ready, but installation currently starts from a local clone or another explicitly
obtained artifact.

## Prerequisites

- Node.js 24 or newer.
- A built or installed `temporalthread` CLI.
- Codex desktop, Codex CLI, or the Codex IDE extension for local stdio MCP.
- Permission to write the chosen user or project configuration paths.
- Explicit review/trust of lifecycle hooks after installation.

Confirm the CLI before changing Codex. If TemporalThread is already initialized, also run its general doctor:

```sh
temporalthread --version
temporalthread doctor
```

For a first-time setup, the Codex installer creates the default TemporalThread configuration/database after
its zero-write preflight succeeds.

## Installation scopes

| Scope | MCP configuration | Hooks | Skill | Ownership manifest |
| --- | --- | --- | --- | --- |
| User | `~/.codex/config.toml` | `~/.codex/hooks.json` | `~/.agents/skills/temporal-awareness/SKILL.md` | `~/.codex/temporalthread/integration-manifest.json` |
| Project | `<repo>/.codex/config.toml` | `<repo>/.codex/hooks.json` | `<repo>/.agents/skills/temporal-awareness/SKILL.md` | `<repo>/.codex/temporalthread.integration.json` |

Project configuration is active only after Codex trusts the repository. Run project commands from the
repository being configured. User scope makes the integration visible across local projects.

## Development installation from this repository

Build all workspaces first:

```sh
pnpm install --frozen-lockfile
pnpm build
```

On macOS or Linux, provide the absolute built CLI entry:

```sh
node apps/cli/dist/bin.js integrate codex install \
  --scope project \
  --development-cli "$(pwd)/apps/cli/dist/bin.js" \
  --yes
```

On PowerShell:

```powershell
$cli = (Resolve-Path "apps/cli/dist/bin.js").Path
node $cli integrate codex install --scope project --development-cli $cli --yes
```

Development mode stores `node`, the selected absolute CLI entry, and `start` in the MCP entry. The installer
validates that entry before modifying Codex. It does not commit that machine-specific path to the repository.

## Installed-package mode

Once an official artifact has been installed and `temporalthread --version` succeeds, use installed-package
mode (the default):

```sh
temporalthread integrate codex install --scope user --dry-run
temporalthread integrate codex install --scope user --yes
```

The generated MCP entry launches `temporalthread start` directly on macOS and Linux. On Windows it uses
`cmd.exe /d /s /c temporalthread start` so the package-manager command shim starts reliably. The entry is
enabled but not required, uses the `writes` approval mode, allows ten seconds for startup, and allows sixty
seconds per tool call. Optional temporal continuity therefore does not make Codex startup depend on the
server.

## Plugin installation

The official plugin artifact is `integrations/codex/plugin`; the repository marketplace is
`.agents/plugins/marketplace.json`. In a plugin-capable Codex desktop or CLI surface:

1. Ensure the installed `temporalthread` command is on the host's `PATH`.
2. Open the Codex plugin browser and enable the repository marketplace.
3. Select the `temporalthread` plugin and review its manifest, MCP map, skill, and hooks.
4. Explicitly approve the hook definition when Codex requests trust.
5. Start a new Codex session, inspect MCP status, and run the doctor command below.

Plugin installation copies the bundle into Codex's plugin cache. Reinstall or restart after changing the
local source. The plugin cannot install the CLI or approve its own hooks. The IDE extension does not install
plugins; use the direct installer there.

## Direct installer

Interactive use asks for scope, privacy mode when TemporalThread is not yet initialized, and confirmation.
Non-interactive use must supply the scope and `--yes` for mutations:

```sh
temporalthread integrate codex install --scope project --yes
temporalthread integrate codex install --scope user --privacy metadata-only --yes
```

The default privacy mode is `temporal-references-only`. Changing an existing privacy mode explicitly also
requires `--yes`; `full-local-history` is never selected automatically.

The installer performs these steps:

1. Resolve and validate user/project paths without following symbolic-link targets.
2. Parse existing TOML/JSON and refuse malformed configuration.
3. Verify the TemporalThread executable; a real install also performs an MCP handshake and tool listing.
4. Build one change plan and preserve unrelated MCP servers, hooks, settings, and skills.
5. Back up existing managed files, write restrictive same-directory temporary files, atomically rename, and
   validate the result.
6. Roll back files changed by the current transaction if validation fails.
7. Write a content-free ownership/version manifest and run post-install checks.

An unmarked `temporal-thread` MCP entry or unmanaged `temporal-awareness` skill is preserved unless ownership
is clear. `--yes` may replace the skill after the caller has reviewed it, but it does not take ownership of an
unmarked MCP entry.

## Component and automation options

```sh
temporalthread integrate codex install --scope project --no-hooks --yes
temporalthread integrate codex install --scope project --skill-only --yes
temporalthread integrate codex install --scope project --mcp-only --yes
temporalthread integrate codex install-skill --scope project --yes
temporalthread integrate codex remove-skill --scope project --yes
```

`--skill-only` and `--mcp-only` cannot be combined. `--no-hooks` installs MCP and skill but leaves lifecycle
automation absent. Component removal updates the ownership manifest instead of forgetting the remaining
managed files.

## Dry run

Dry run makes no file or database changes and does not open the database:

```sh
temporalthread integrate codex install --scope project --dry-run
temporalthread integrate codex uninstall --scope project --dry-run
```

It validates paths/configuration, checks executable availability, and prints planned changes and backup
paths. The full MCP handshake runs only during an actual installation.

## Manual installation

Print the official MCP table without modifying Codex:

```sh
temporalthread integrate codex print-config --scope project
```

For development mode:

```sh
temporalthread integrate codex print-config \
  --scope project \
  --development-cli /absolute/path/to/TemporalThread/apps/cli/dist/bin.js
```

Manually merge the printed table into the reported config path. The canonical skill is
`skills/codex/temporal-awareness/SKILL.md`; the supported hook template is
`integrations/codex/hooks.json`. Manual copying does not create TemporalThread's ownership manifest, so later
automatic removal will preserve anything whose ownership is uncertain.

## Verification

Run both general and Codex-specific diagnostics:

```sh
temporalthread doctor
temporalthread integrate codex status --scope project
temporalthread integrate codex doctor --scope project
temporalthread integrate codex doctor --scope project --json
```

The Codex doctor reports `PASS`, `WARN`, or `FAIL` for Node/CLI/build output, detected surface, manifest,
configuration syntax, MCP ownership/handshake/tools, skill, hooks, duplicates, permissions, database/schema,
timezone, privacy, interrupted writes, stale paths, and version compatibility. Unsupported capabilities are
always a visible warning, not a false success claim.

After installation:

1. Review every changed path and timestamped backup printed by the installer.
2. Trust the project if using project scope.
3. Review and trust the exact hook definitions.
4. Start a new Codex session.
5. Inspect the host's MCP and hook status; seeing MCP tools does not prove hooks are running.

## Upgrade

Rerun `install` with the same scope and desired component flags. An upgrade preserves the database and
unrelated configuration, backs up replaced managed files, updates hashes/version metadata, and runs the MCP
probe again. Reinstalling the same version is idempotent. A newer installed integration is never silently
downgraded.

If hook contents changed, Codex may require a new trust review because trust is hash-based.

## Uninstall

Remove only TemporalThread-managed Codex configuration while preserving the database:

```sh
temporalthread integrate codex uninstall --scope project --yes
```

Uninstall removes the marked MCP block, exact managed hook groups, an unchanged managed skill, and the
ownership manifest when no managed component remains. It preserves unrelated config, unrelated hooks,
unrelated skills, externally owned entries, modified managed skills, backups, TemporalThread configuration,
and the SQLite database. Repeated uninstall is safe.

To purge TemporalThread domain data after integration removal, make the destructive intent explicit:

```sh
temporalthread integrate codex uninstall --scope project --purge-data --yes
```

This purges stored domain rows; it is not implied by plugin removal or ordinary uninstall. Keep a private
backup/export first if the data may be needed later.
