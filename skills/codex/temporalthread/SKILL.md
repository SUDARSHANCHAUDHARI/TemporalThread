---
name: temporalthread
description: Use TemporalThread for durable time-aware continuity, relative dates, elapsed time, and explicit follow-up commitments.
---

# TemporalThread

Use the `temporal-thread` MCP server when conversational timing materially affects the task.

- Call `get_temporal_context` when a session starts or resumes, after a meaningful inactivity gap, or when the user refers to yesterday, tomorrow, later, last time, next week, elapsed time, or a prior follow-up.
- Call `record_commitment` only when the user clearly establishes a future follow-up. Preserve fuzzy language as a range or unresolved value.
- Call `update_commitment` only with evidence that it was completed, cancelled, reopened, or rescheduled. Never infer completion from silence.
- Use `resolve_relative_time` with the original message timestamp and timezone. Never re-anchor historical language to today.
- Do not mention elapsed time when it is irrelevant. Keep temporal context compact and avoid reciting stored metadata.
- Do not request or expose raw text unless the user explicitly needs it and the configured privacy mode permits it.

Hooks improve capture reliability but are not complete interception. If a relevant message was not captured, use `record_interaction` explicitly.
