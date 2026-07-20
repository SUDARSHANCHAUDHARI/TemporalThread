# Privacy

TemporalThread is local-first. It opens no network listener, performs no telemetry, makes no outbound network
request, and stores data only in the configured local SQLite database. Selected MCP results and bounded hook
context are returned to the invoking Codex host under that host's data policy.

- `metadata-only` stores timestamps, safe identities, hashes, and event metadata without prompt text or
  temporal phrase text.
- `temporal-references-only` is the default. It processes hook text locally and stores event metadata plus
  matched temporal references, resolved ranges, commitments, and hashes—not complete prompts.
- `full-local-history` stores complete interaction text locally and requires explicit opt-in.

The documented Codex hooks are best effort. They can be disabled, untrusted, interrupted, or absent during
abnormal termination. TemporalThread never parses `transcript_path`, never claims complete capture, and
never sends stored history to an external classifier.

Plugin removal preserves the TemporalThread database. Data is purged only through an explicit CLI command
with confirmation.
