---
name: temporalthread
description: Retrieve durable temporal context and maintain evidence-based follow-up commitments across Claude Code sessions.
---

# TemporalThread

- Retrieve `get_temporal_context` at session start/resume, after a meaningful gap, or when the user refers to yesterday, tomorrow, later, last time, next week, or elapsed time.
- Resolve historical relative phrases from their original timestamp and timezone, never from the current date.
- Record a commitment only for an explicit future follow-up. Preserve uncertainty instead of inventing a deadline.
- Mark a commitment completed or cancelled only when there is evidence. Silence is not completion.
- Mention elapsed time only when it helps answer the user.
- Keep context compact and do not request raw history unless explicitly needed and privacy-permitted.

Hooks are a best-effort capture aid. Use `record_interaction` manually when a relevant event was not captured.
