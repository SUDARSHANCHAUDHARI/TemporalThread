# Claude Code integration

Status: MCP configuration and documented hook payload adapters are covered by automated tests. Installation into a particular Claude Code environment is manual so existing settings are never overwritten.

1. Install and initialize `temporalthread`.
2. Merge `.mcp.json` into the target project’s `.mcp.json`, or run `claude mcp add --transport stdio temporal-thread -- temporalthread start` using the scope you prefer.
3. Merge `hooks.json` into `.claude/settings.json` and copy `../../skills/claude-code/temporalthread/SKILL.md` to `.claude/skills/temporalthread/SKILL.md`.
4. Restart Claude Code and review the MCP and hook status.

`UserPromptSubmit.prompt` and `Stop.last_assistant_message` are recorded. `SessionStart` injects compact context, and prompt hooks inject it only for a meaningful gap, temporal cue, or due commitment. TemporalThread intentionally ignores `transcript_path` because the transcript format is not a stable interface.

Claude Code treats most nonzero hook exits as non-blocking errors. TemporalThread never returns a blocking decision. Capture is not guaranteed when hooks are disabled, interrupted, or skipped on abnormal termination.

References: [Claude Code MCP](https://code.claude.com/docs/en/mcp), [hooks](https://code.claude.com/docs/en/hooks), and [skills](https://code.claude.com/docs/en/slash-commands).
