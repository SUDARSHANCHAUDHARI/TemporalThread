# Integrations

MCP exposes tools; it does not universally intercept host conversations. Automatic capture is possible only when a host emits a documented event containing the relevant message. Skills improve tool selection but cannot guarantee that an agent will call a tool.

| Integration | MCP tools | Automatic capture | Status |
| --- | --- | --- | --- |
| Codex | User/project config and official plugin | Documented session, prompt, and stop hooks | **Supported configuration**: direct installer and packed artifact tested; live host trust remains manual |
| Claude Code | Project `.mcp.json` | `UserPromptSubmit.prompt` and `Stop.last_assistant_message` | **Partially supported**: adapter tested; installation is manual |
| OpenCode | Local MCP configuration | Typed plugin events | **Experimental** until live host verification |
| Ollama | Through example client | Example client records its own messages | **Partially supported**: mocked API tested; Ollama itself is not an MCP host |
| Generic | Any MCP client or CLI | Host-owned adapter/JSONL | **Supported and tested** |

## Codex

The direct installer supports user and project scope. From the repository to integrate:

```sh
temporalthread integrate codex install --scope project --dry-run
temporalthread integrate codex install --scope project --yes
temporalthread integrate codex doctor --scope project
```

Use `--scope user` for all local projects. Review `.codex/config.toml`, `.codex/hooks.json`, and
`.agents/skills/temporal-awareness/SKILL.md`, then restart Codex and approve project/hook trust. The installer
is idempotent, creates backups before modification, validates MCP startup/tools, rolls back its own failed
transaction, preserves unrelated content, and refuses uncertain ownership.

The official plugin lives at `integrations/codex/plugin`, with repository marketplace metadata at
`.agents/plugins/marketplace.json`. It packages the same MCP map, skill, and hooks, but cannot install the
`temporalthread` executable or approve hook trust. Plugin-capable desktop/CLI surfaces are supported; the IDE
extension uses direct MCP and skill installation instead. ChatGPT web cannot reach this local stdio server,
and mobile is unsupported.

Codex hooks record documented `prompt` and `last_assistant_message` fields and inject compact context only
when relevant. `transcript_path` is never parsed. Hooks do not create firm commitments; the skill must call
`record_commitment`. Capture can be missed when hooks are disabled, untrusted, interrupted, timed out, or
absent during abnormal termination. Uninstall removes only managed integration entries and preserves the
database by default.

See the [architecture and behavior guide](CODEX-INTEGRATION.md), [installation](CODEX-INSTALLATION.md),
[privacy](CODEX-PRIVACY.md), and [troubleshooting](CODEX-TROUBLESHOOTING.md).

## Claude Code

Merge `integrations/claude-code/.mcp.json` into the project MCP configuration, merge the provided hooks into `.claude/settings.json`, and copy the skill to `.claude/skills/temporalthread/SKILL.md`. Exact commands and event limits are in [the Claude Code guide](../integrations/claude-code/README.md).

The adapter records `UserPromptSubmit.prompt` and `Stop.last_assistant_message`. Session start injects compact context. It does not read the unstable transcript format, and abnormal exits may not emit a stop event.

## OpenCode

Merge `integrations/opencode/opencode.json`, copy the plugin to `.opencode/plugins/temporalthread.ts`, and copy the skill to `.opencode/skills/temporalthread/SKILL.md`.

The plugin uses the official plugin types. It records `chat.message` user text and retrieves an assistant message only after `message.updated` has a completion timestamp. Its transformations and schema compatibility are tested, but live automatic capture is **experimental** until an end-to-end OpenCode session is verified. See [the OpenCode guide](../integrations/opencode/README.md).

## Ollama

Ollama is a local model runtime, not a universal MCP host. The [Ollama example](../examples/ollama-tool-client/src/index.ts) starts TemporalThread over stdio, publishes its tool schemas to `/api/chat`, executes requested MCP calls, and returns tool messages to the model.

```sh
export OLLAMA_MODEL=qwen3
node examples/ollama-tool-client/dist/index.js "How long has it been?"
```

Set `OLLAMA_CONVERSATION_ID` to reuse a local conversation identifier. Model availability and tool-calling support depend on the user’s Ollama installation; the automated test uses a mocked chat API and does not claim live model compatibility.

## Generic

Pipe one JSON object, an array, or JSONL:

```sh
temporalthread ingest --file integrations/generic/events.example.jsonl --json
```

Custom agents can implement [`TemporalThreadAdapter`](../integrations/generic/adapter.ts) or call `record_interaction` and `get_temporal_context` directly. Preserve the host timestamp with its offset, IANA timezone, agent/project identity, external session ID, and a stable idempotency key whenever available. See the [manual embedded example](../examples/manual-event-recording/src/index.ts).
