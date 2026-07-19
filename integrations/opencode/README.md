# OpenCode integration

Status: MCP configuration is based on the current documented local-server format. The plugin is typed against `@opencode-ai/plugin` and its adapter logic is unit-tested, but live automatic capture is **experimental** until verified end to end against a compatible OpenCode release.

1. Merge `opencode.json` into the project’s `opencode.json`.
2. Copy `plugin/temporalthread.ts` into `.opencode/plugins/temporalthread.ts`.
3. Copy `../../skills/opencode/temporalthread/SKILL.md` into `.opencode/skills/temporalthread/SKILL.md`.
4. Ensure `temporalthread` is on the environment path used by OpenCode, then restart it.

The plugin records complete user messages from `chat.message`. It records an assistant message only after `message.updated` reports a completion timestamp, then retrieves that one message through the documented SDK. Calls use fixed executable/argument values and JSON over stdin; message text is never interpolated into a shell command.

References: [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers/), [plugins](https://opencode.ai/docs/plugins/), and [agent skills](https://opencode.ai/docs/skills/).
