# Live Codex certification results

**STATUS: NOT TESTED — SKIPPED BY OWNER (2026-07-26)**

The Phase 4.2A automated pre-host checks passed, but the owner chose not to continue the isolated Codex authentication and live-host trust/UI flow. No project trust prompt, hook trust prompt, real Codex MCP view, real skill view, lifecycle delivery, or model behavior was observed.

The local temporary certification environment was created on the owner's Mac. This GitHub-only follow-up cannot inspect or delete that local temporary root, so local process termination and guarded cleanup remain **MANUAL** until the owner confirms them. No local absolute path, UUID, credential, device code, or temporary database content is stored here.

Copy the template below for any future platform certification. Do not commit private absolute paths, conversation content, tokens, account data, recovery information, database contents, or unredacted logs. Use safe labels such as `<temporary-project>` and `<isolated-database>`.

Allowed result values: `PASS`, `FAIL`, `MANUAL`, `NOT TESTED`, `NOT APPLICABLE`.

## Phase 4.2A owner decision

| Check | Result | Privacy-safe evidence/notes |
| --- | --- | --- |
| Automated preparation | PASS | Isolated project prepared; release use prohibited |
| Automated MCP doctor | PASS | Exact nine-tool protocol discovery |
| Automated privacy pre-host check | PASS | Synthetic marker absent from prohibited fields |
| Automated child-process check | PASS | Managed preparation/check processes closed |
| Codex authentication | NOT TESTED | Authentication prompt reached; sign-in not completed |
| Project trust prompt | NOT TESTED | Not reached |
| Hook trust prompt | NOT TESTED | Not reached |
| Real MCP UI visibility | NOT TESTED | Owner skipped live host certification |
| Real nine-tool UI visibility | NOT TESTED | Owner skipped live host certification |
| Real `temporal-awareness` skill visibility | NOT TESTED | Owner skipped live host certification |
| Real lifecycle delivery | NOT TESTED | SessionStart/UserPromptSubmit/Stop not observed in a real host |
| Real temporal model scenario | NOT TESTED | No real Codex model turn was executed |
| Local guarded cleanup | MANUAL | Must be confirmed on the owner's Mac |
| Final Codex CLI certification result | NOT TESTED | SKIPPED BY OWNER |

## Future platform certification template

### Environment

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

### Host and lifecycle results

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
- Only a human tester can mark trust prompts, Codex UI/tool/skill visibility, model behavior, desktop behavior, terminal restart, and IDE fallback.
- Skipping real-host certification means TemporalThread may claim automated Codex integration coverage, but not live Codex host certification.
- A future platform result is `PASS` only when every mandatory manual and automated check for that platform passes.
- v0.1.0 was later published without live-host certification. This record remains the authoritative reason
  that the release may claim automated Codex integration coverage but not certified Codex UI, trust, skill,
  lifecycle, desktop, or model compatibility.
