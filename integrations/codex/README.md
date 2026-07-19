# Codex integration

Status: MCP and hook adapters are covered by automated tests. Project installation still requires Codex to trust the project and the user to review hook commands.

1. Install and initialize `temporalthread`.
2. From the target repository, run `node path/to/TemporalThread/integrations/codex/install.mjs`.
3. Review `.codex/config.toml`, `.codex/hooks.json`, and `.agents/skills/temporalthread/SKILL.md`.
4. Restart Codex, trust the project/hooks when prompted, and use `/mcp` and `/hooks` to inspect status.
5. Run `temporalthread doctor` and `node path/to/TemporalThread/integrations/codex/doctor.mjs`.

The installer creates timestamped backups before modifying existing files. It marks only its MCP block, merges hook groups by command, and preserves unrelated configuration. The uninstaller removes only marked/recognized TemporalThread entries and preserves a locally edited skill.

Codex supplies stable `prompt` and `last_assistant_message` fields to the configured hooks. TemporalThread does not parse `transcript_path`. Capture can be missed if hooks are disabled, untrusted, interrupted, or not emitted on an abnormal termination.

References: [Codex MCP](https://developers.openai.com/codex/mcp), [Codex hooks](https://developers.openai.com/codex/hooks), and [Codex skills](https://developers.openai.com/codex/skills).
