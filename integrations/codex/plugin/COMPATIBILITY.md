# Compatibility

Plugin version: 0.1.0. Required TemporalThread CLI version: 0.1.0. Required Node.js version: 24 or newer.

| Surface | Plugin | Direct MCP and skill | Notes |
| --- | --- | --- | --- |
| ChatGPT desktop Work/Codex | Supported | Supported | Local CLI must already be installed. |
| Codex CLI plugin browser | Supported | Supported | Start a new session after installation. |
| Codex IDE extension | Not supported | Supported | Use `temporalthread integrate codex install`. |
| ChatGPT web local stdio | Not supported | Not supported | TemporalThread intentionally has no remote MCP endpoint. |
| Mobile | Not supported | Not supported | No local CLI process is available. |

Hooks require an explicit trust review and remain best effort. Guaranteed transcript capture, guaranteed
session-end delivery, remote synchronization, and reminder delivery are not supported.
