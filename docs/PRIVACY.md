# Privacy

TemporalThread processes interaction text locally and never sends stored content anywhere. It has no analytics, telemetry, remote error reporting, hosted database, or embedded LLM call.

## Modes

| Mode | Hash and metadata | Matched temporal phrases | Full text |
| --- | --- | --- | --- |
| `metadata-only` | Yes | No | No |
| `temporal-references-only` | Yes | Yes | No |
| `full-local-history` | Yes | Yes | Yes |

`temporal-references-only` is the default. `full-local-history` is enabled only by an explicit configuration change or explicit per-interaction request; initialization never selects it automatically.

Text supplied in metadata-only mode is hashed locally but not parsed or retained. In temporal-references-only mode it is parsed in memory and discarded after matched expressions and their resolutions are stored. Error messages and diagnostics do not include input text.

## Access and retention

- `get_temporal_context` never returns a transcript.
- `get_last_interaction` returns raw text only when the caller explicitly requests it and the stored interaction permitted full history.
- `temporalthread timeline` shows compact metadata.
- `temporalthread export` exports exactly the locally stored representation and creates output files with restrictive permissions where supported.
- `temporalthread purge` requires confirmation and transactionally deletes all domain rows.

Database, configuration, export, and backup files remain under the operating-system user’s account. Other processes running as that user may still be able to read them. Full-disk encryption and operating-system access controls remain the user’s responsibility.

## Hooks

Hooks receive content according to each host’s event contract. TemporalThread reads only documented prompt or completed-message fields and intentionally ignores transcript paths. A hook can still miss an event when disabled, untrusted, interrupted, or skipped during abnormal termination.
