# Generic integration

Use `temporalthread ingest --file events.jsonl --json`, pipe a JSON object/array/JSONL document to `temporalthread ingest`, or implement the `TemporalThreadAdapter` contract in `adapter.ts`. See `examples/manual-event-recording`.

Every event must include a role and agent. Supply the original offset timestamp, IANA timezone, project path, external session ID, and a stable idempotency key whenever the host exposes them. The generic path is the supported fallback when automatic hooks are unavailable.
