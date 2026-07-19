---
name: temporalthread
description: Use durable temporal context and explicit commitments across OpenCode sessions.
---

# TemporalThread

Call `get_temporal_context` at session start/resume, after meaningful inactivity, or for language about yesterday, tomorrow, later, last time, next week, and elapsed time. Resolve relative language from its original anchor. Record only explicit future commitments and never claim completion without evidence. Avoid mentioning elapsed time when it does not help. Keep responses compact and privacy-aware.

OpenCode event capture is experimental. If an event is absent, call `record_interaction` explicitly.
