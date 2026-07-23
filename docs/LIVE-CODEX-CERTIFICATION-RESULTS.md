# Live Codex certification results

**TEMPLATE — NOT A COMPLETED CERTIFICATION**

Copy this template for each tested platform. Do not commit private absolute paths, conversation content,
tokens, account data, recovery information, database contents, or unredacted logs. Use safe labels such as
`<temporary-project>` and `<isolated-database>`.

Allowed result values: `PASS`, `FAIL`, `MANUAL`, `NOT TESTED`, `NOT APPLICABLE`.

## Environment

| Field | Value |
| --- | --- |
| Tester | `<name or safe label>` |
| Test date | `<YYYY-MM-DD>` |
| Operating system | `<name and version>` |
| Architecture | `<architecture>` |
| Node.js version | `<version>` |
| pnpm version | `<version>` |
| Codex CLI version | `<version or NOT TESTED>` |
| Codex desktop version | `<version or NOT APPLICABLE>` |
| TemporalThread commit | `<40-character commit>` |
| Temporary project path | `<temporary-project>` |
| Installation method | `Phase 4.2 functional-only temporary consumer` |

## Host and lifecycle results

| Check | Result | Privacy-safe evidence/notes |
| --- | --- | --- |
| Project trust prompt observed | NOT TESTED | |
| Hook trust prompt observed | NOT TESTED | |
| MCP server visible | NOT TESTED | |
| Exactly nine tools visible | NOT TESTED | |
| `temporal-awareness` skill visible | NOT TESTED | |
| SessionStart delivered | NOT TESTED | |
| UserPromptSubmit delivered | NOT TESTED | |
| Stop delivered | NOT TESTED | |
| Previous conversational interaction preserved | NOT TESTED | |
| Elapsed value | NOT TESTED | `<approximately 4 days 3 hours>` |
| Commitment status | NOT TESTED | `<overdue and calendar-day value>` |
| Privacy marker absent | NOT TESTED | |
| Database path | MANUAL | `<isolated-database>` |
| Uninstall result | NOT TESTED | |
| Database preservation result | NOT TESTED | |
| Explicit purge result | NOT TESTED | |
| Terminal restart `PATH` result | NOT TESTED | |
| IDE fallback result | NOT TESTED | |
| Screenshots/logs stored privately, if any | NOT APPLICABLE | `<private location label only; never attach here>` |
| Unexpected behavior | NOT TESTED | |
| Final platform result | NOT TESTED | |

## Required interpretation

- Automated kit output can support installation, MCP protocol, storage, privacy, uninstall, and purge facts.
- Only the human tester can mark trust prompts, Codex UI/tool/skill visibility, model behavior, desktop
  behavior, terminal restart, and IDE fallback.
- A platform result is `PASS` only when every mandatory manual and automated check for that platform passes.
- This template does not clear the SDK/Hono blocker and does not authorize publication.
