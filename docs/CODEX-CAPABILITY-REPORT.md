# Codex Capability Report

Verified: 2026-07-20

This report maps Phase 2 requirements to current official OpenAI Codex documentation. It is the design
authority for the integration; repository behavior must not exceed these documented surfaces.

## Official sources consulted

- [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Build plugins](https://learn.chatgpt.com/docs/build-plugins)
- [Plugins](https://learn.chatgpt.com/docs/plugins)
- [Hooks](https://learn.chatgpt.com/docs/hooks)
- [Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Agent approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)

## Capability matrix

| Capability | Official status | Supported surfaces | Implementation decision | Limitation | Fallback |
| --- | --- | --- | --- | --- | --- |
| Local stdio MCP server | Supported | ChatGPT desktop Codex, Codex CLI, IDE extension | Configure `mcp_servers.temporal-thread` with command `temporalthread` and argument `start`. | The executable must already be installed or a development build path must be supplied. | `print-config` emits a manual template and doctor diagnoses the command. |
| MCP environment variables | Supported | Same local MCP surfaces | Use only an explicit allowlist when configuration requires environment variables; no secrets are generated. | Environment forwarding is host configuration, not a secret store. | Prefer TemporalThread's normal local config and no MCP environment entries. |
| User MCP configuration | Supported | Shared by desktop Codex, CLI, and IDE on the same host | Merge into `~/.codex/config.toml`. | A malformed file cannot be safely merged. | Refuse mutation and print a manual block. |
| Project MCP configuration | Supported | Trusted projects in desktop Codex, CLI, and IDE | Merge into `<repo>/.codex/config.toml`. | Codex ignores project config until the project is trusted. | Use user scope or manual configuration. |
| Reusable skill | Supported | ChatGPT desktop app, Codex CLI, IDE extension | Build `temporal-awareness` using a `SKILL.md` with `name` and `description`. | Skill selection is model-driven; it cannot guarantee an MCP call. | Hooks retrieve only compact context where officially available; users can invoke the skill explicitly. |
| User skill | Supported | Codex skill surfaces | Install to `$HOME/.agents/skills/temporal-awareness`. | Duplicate skill names are not merged. | Doctor warns; installer avoids duplicate managed copies. |
| Repository skill | Supported | Codex skill surfaces within that repository path | Install to `<repo>/.agents/skills/temporal-awareness`. | Discovery follows the directory path from CWD to repository root. | Use user scope if the repository layout is unsuitable. |
| Lifecycle command hooks | Supported | Local Codex lifecycle; plugin, user, and trusted-project hook sources | Use `SessionStart`, `UserPromptSubmit`, and `Stop` only. | Non-managed hooks are skipped until the user reviews and trusts their current hash. | MCP and skill use remain available without hooks. |
| Session start access | Supported | Local Codex hooks | Retrieve compact context and record a session-start interaction using `session_id`, `cwd`, and `source`. | Delivery is not a durable session guarantee, and missing fields must be tolerated. | Return success with no context. |
| Session resume/compaction indication | Supported | `SessionStart` hook | Use `source` values `startup`, `resume`, `clear`, and `compact`; do not invent separate events. | `SessionStart` is not a project-switch event. | Derive project identity from the current event's `cwd`. |
| User prompt access | Supported | `UserPromptSubmit` hook | Process `prompt` in memory, apply privacy mode, record the event, and optionally return compact context. | Matcher filtering is not supported for this event; the handler must decide relevance. | The skill calls `record_interaction` when hooks are absent or incomplete. |
| Assistant response access | Partially supported | `Stop` hook | Use `last_assistant_message` only when present and allowed by privacy mode. | This is the latest assistant text for a stopping turn, not a complete transcript or guaranteed message stream. | Record metadata only or omit the interaction. |
| Turn completion access | Supported with limits | `Stop` hook | Treat `Stop` as best-effort turn completion and session activity, never as guaranteed process shutdown. | `Stop` can continue a turn; abnormal termination may omit it. | Sessions remain valid without `endedAt`; later starts establish continuity. |
| Session end access | Unsupported as a guaranteed event | None with durability guarantees | Close/update a session only when a `Stop` payload is received; document the result as best effort. | `Stop` is turn-scoped, not a guaranteed OS-process or durable session-end callback. | Rely on inactivity-based synthetic session logic and later context retrieval. |
| Context injection | Supported | `SessionStart` and `UserPromptSubmit` | Return JSON `hookSpecificOutput.additionalContext` with a strict application limit. | Codex itself allows roughly 2,500 tokens and may save oversized output to a temporary file. | TemporalThread caps output well below the host limit and returns no context when irrelevant. |
| Hook timeout | Supported | Command hooks | Set a short explicit timeout in seconds. | Codex defaults to 600 seconds when omitted, which is too long for optional continuity. | Fail open; doctor warns about stale or incorrect hook definitions. |
| Hook trust and approvals | Supported and mandatory | Non-managed user, project, and plugin hooks | Tell users to review and trust the exact hook definition after install/update. | The installer cannot approve its own hooks, and changed hook hashes require review again. | `--no-hooks`, `--skill-only`, and `--mcp-only` remain functional. |
| Plugin packaging | Supported | Work mode on ChatGPT web, Work/Codex in desktop app, Codex CLI plugin browser | Ship an official plugin with `.codex-plugin/plugin.json`, `skills/`, `.mcp.json`, and `hooks/hooks.json`. | Plugins are not available in Chat mode, the IDE extension, or mobile. | Direct user/project MCP, skill, and hook installation. |
| Plugin-bundled MCP | Supported | Plugin-capable surfaces | Point `mcpServers` at a plugin-root `.mcp.json`; use the installed `temporalthread` command. | Plugin install does not install the TemporalThread executable. | Doctor and installation docs require/install-check the CLI first. |
| Plugin-bundled hooks | Supported | Plugin-capable local Codex surfaces | Bundle the same narrow hook command and use `PLUGIN_ROOT` only when a plugin-local file is needed. | Plugin hooks still require trust review. | Standalone hook files or no-hook mode. |
| Repository plugin marketplace | Supported | Desktop Codex and Codex CLI plugin browser | Add a repository marketplace at `.agents/plugins/marketplace.json` pointing to a local plugin directory. | A local plugin is copied into Codex's plugin cache and needs restart/reinstall to pick up changes. | Standalone project installation. |
| Personal plugin marketplace | Supported | Desktop Codex and Codex CLI plugin browser | Document official personal marketplace locations; do not mutate a real user marketplace in tests. | Marketplace installation and enablement are host-owned UI/CLI actions. | User-scope standalone installer. |
| Codex CLI plugin support | Supported | Codex CLI | Package for `/plugins` and configured marketplaces. | Plugin installation requires a new session before bundled components are usable. | Direct `temporalthread integrate codex install`. |
| Codex desktop app support | Supported | Codex in ChatGPT desktop app | Official plugin plus shared local MCP configuration. | Hook trust and restart remain user actions. | Doctor prints the required actions. |
| IDE extension plugin support | Unsupported | IDE extension | Do not claim or attempt plugin installation. | Official plugin browsing/install is unavailable in the IDE extension. | Shared MCP configuration and directly installed skills are officially supported there. |
| ChatGPT web local stdio MCP | Unsupported | ChatGPT web | Do not claim the local TemporalThread process is available to web chats. | Web plugins use hosted/remote MCP-backed tools; TemporalThread is intentionally local stdio. | Use desktop Codex, CLI, or IDE. |
| Transcript parsing | Unsupported as a stable hook API | All hook surfaces | Never parse `transcript_path`. | Official documentation states that transcript format may change. | Use documented `prompt` and `last_assistant_message` fields only. |
| Project switch callback | Unsupported as a dedicated event | None | Do not implement or claim a project-switch hook. | Current hooks expose `cwd` on each supported event, not a project-switch event. | Normalize the current `cwd` per event. |
| Guaranteed automatic capture | Unsupported | All surfaces | Describe hooks as best effort and the skill/MCP calls as complementary. | Hooks can be disabled, untrusted, time out, or be skipped on abnormal termination. | Explicit MCP recording through the skill or other clients. |

## Verified configuration contracts

### MCP

Codex stores user configuration at `~/.codex/config.toml` and trusted-project overrides at
`.codex/config.toml`. A stdio server entry supports `command`, `args`, `cwd`, `env`, `env_vars`, `enabled`,
`required`, `startup_timeout_sec`, `tool_timeout_sec`, approval policy, and tool allow/deny lists.

TemporalThread will use this conservative installed-package configuration:

```toml
[mcp_servers.temporal-thread]
command = "temporalthread"
args = ["start"]
enabled = true
required = false
default_tools_approval_mode = "writes"
startup_timeout_sec = 10
tool_timeout_sec = 60
```

`required = false` is intentional: failure to start optional temporal continuity must not prevent Codex
startup. Development configuration will use `node` plus a user-selected built CLI path rather than a
developer-specific absolute path committed to the repository.

### Skills

A skill is a directory containing `SKILL.md`. Frontmatter must include `name` and `description`; scripts,
references, assets, and agents are optional. Repository skills live under `.agents/skills` along the CWD to
repository-root path, and user skills live under `$HOME/.agents/skills`.

TemporalThread will ship `skills/codex/temporal-awareness/SKILL.md`. The description will say both when to
use and when not to use temporal continuity so skill selection remains selective.

### Hooks

Codex reads `hooks.json` next to active user/project config layers, inline `[hooks]` tables, and enabled
plugin hook files. Matching command hooks run concurrently. Non-managed hook definitions require explicit
review and hash-based trust.

Every command hook receives JSON on stdin with common fields including `session_id`, `transcript_path`,
`cwd`, `hook_event_name`, and `model`. TemporalThread will not read `transcript_path`.

| Event | Additional inputs used | Text available | Context output | Blocking behavior | TemporalThread behavior |
| --- | --- | --- | --- | --- | --- |
| `SessionStart` | `source`, optional permission metadata | No prompt/response text | Plain text or JSON additional context | Common `continue: false` can stop a hook run | Record safe session timing, retrieve bounded context, return only meaningful context. |
| `UserPromptSubmit` | `turn_id`, `prompt` | User prompt | Plain text or JSON additional context | A block decision or exit 2 can block the prompt | Never block; process bounded prompt locally under privacy mode, record idempotently, inject only relevant prior context. |
| `Stop` | `turn_id`, `stop_hook_active`, `last_assistant_message` | Latest assistant message, possibly null | Common JSON only | A block decision asks Codex to continue | Always return neutral JSON; optionally record permitted data and update session activity. |

TemporalThread will exit zero with valid neutral output on adapter, database, parser, and payload failures.
It will never use blocking decisions for temporal continuity.

### Plugins

The required plugin entry point is `.codex-plugin/plugin.json`. Official manifests may reference `skills`,
`mcpServers`, `apps`, and `hooks` relative to the plugin root. TemporalThread needs no remote connector or
custom ChatGPT UI, so the Phase 2 plugin will include only:

- `.codex-plugin/plugin.json`;
- `skills/temporal-awareness/SKILL.md`;
- `.mcp.json` for the installed local CLI;
- `hooks/hooks.json` for optional best-effort automation;
- license, README, privacy, and compatibility material.

The repository will provide marketplace metadata for local/repository testing. Phase 2 will validate and
pack the artifact but will not publish it or create a release.

## Security and privacy conclusions

- Hook prompts arrive on stdin and must never be placed in command-line arguments, logs, thrown messages,
  installation manifests, or temporary integration files.
- The integration will impose a byte-size limit below Codex's model-visible output limit.
- Hook output must contain derived bounded context, never complete transcripts, internal IDs, hashes, or
  database paths.
- Plugin installation does not establish hook trust. Documentation and doctor output must say so.
- MCP approval policy remains visible and user-configurable. TemporalThread marks the server optional and
  leaves local-write tool approval at the `writes` level.
- `full-local-history` remains an explicit opt-in. No installer or plugin may enable it implicitly.

## Unsupported claims to avoid

TemporalThread must not claim that it captures every Codex conversation, observes a guaranteed session end,
supports local stdio MCP in ChatGPT web, installs plugins in the IDE extension, parses stable transcripts,
delivers reminders, or marks commitments complete automatically.
