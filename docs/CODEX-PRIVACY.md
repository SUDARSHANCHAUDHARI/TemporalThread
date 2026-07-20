# Codex privacy

TemporalThread is local-first. The Codex integration opens no listener, performs no telemetry or analytics,
calls no external classifier, and makes no outbound network request. It does return selected MCP results and
bounded hook context to the invoking Codex host; Codex may process that data under the host and OpenAI account
policies. TemporalThread never independently uploads the database or history to TemporalThread, OpenAI,
Anthropic, or another service.

## Privacy modes

| Mode | Stored | Not stored |
| --- | --- | --- |
| `metadata-only` | Timestamps, timezone/offset, agent/project/session identity, roles, hashes, event metadata | Prompt/response text and temporal phrase text |
| `temporal-references-only` | Metadata plus locally matched phrases, resolved ranges, commitment fields, and hashes | Complete prompts and responses |
| `full-local-history` | Metadata, matches, previews, and complete interaction text | Nothing beyond the explicit local history policy |

`temporal-references-only` is the default. The installer preserves an existing mode and never selects
`full-local-history` automatically. Stable identifiers and hashes are not anonymous; they can support local
correlation and idempotency.

## Hook data flow

Codex sends documented hook JSON to `temporalthread hook codex` on stdin. The adapter:

1. Rejects input larger than 256 KiB and validates the exact event schema.
2. Uses only documented fields for `SessionStart`, `UserPromptSubmit`, and `Stop`.
3. Never opens or parses `transcript_path`.
4. Processes prompt/latest-assistant text in memory under the configured privacy mode.
5. Passes content through the service API, never through shell interpolation or command-line arguments.
6. Emits either bounded derived context or neutral `{}` and exits successfully.

Prompt text is not written to integration temporary files, ownership manifests, backups, thrown messages, or
diagnostic output. Database/configuration code may create its normal private files, and installation backups
contain only configuration/skill/hook content—not conversation events.

## Context returned to Codex

Additional hook context is limited to 7,000 UTF-8 bytes and at most five commitments. It may contain:

- current local time and timezone;
- timestamp/timezone of the previous relevant interaction;
- exact elapsed wording and local calendar-day difference;
- resumed-session state;
- sanitized commitment title, due range, timezone, status, and overdue-day count;
- a meaningful timezone change.

It excludes full transcripts, message hashes, internal database/session/interaction IDs, absolute database
paths, unrelated history, and unlimited commitments. The output labels stored fields as untrusted data, not
instructions. Raw history is available only through an explicit `get_last_interaction` request when the
stored privacy mode permits it.

## Local storage and access

The database and configuration use TemporalThread's platform-specific local data directory unless explicitly
overridden. Config/database files use restrictive permissions (`0600`) and directories use `0700` where the
platform supports POSIX modes. SQLite uses parameterized queries, foreign keys, transactions, WAL, and a
bounded busy timeout.

The user-scope Codex integration writes under `~/.codex` and `~/.agents`; project scope writes under the
target repository's `.codex` and `.agents` directories. Installation manifests contain versions, scope,
component paths, backup paths, privacy mode, surface, and managed hashes. They contain no conversation text.

Processes running as the same operating-system user may still be able to read these files. TemporalThread
does not protect against a compromised account, a malicious trusted host, physical access to an unlocked or
unencrypted device, or backups copied to insecure storage.

## Diagnostics and logs

The default log level is `warn`; `TEMPORALTHREAD_LOG_LEVEL` or the normal configuration can change it. Hook
operation is intentionally low-noise. Errors use allow-listed error codes/status rather than prompt text,
assistant text, temporal phrase text, environment dumps, secrets, or database rows. Doctor/status may show
configuration and database paths to the local user, but hook/model context never includes those paths.

## Export, retention, and deletion

- `temporalthread timeline` displays privacy-safe interaction metadata.
- `temporalthread export` exports exactly the locally persisted representation under the active privacy
  choices; protect the export as carefully as the database.
- `temporalthread purge` transactionally removes domain rows after confirmation.
- `temporalthread integrate codex uninstall --scope <scope> --yes` removes only managed integration files
  and preserves the database.
- `temporalthread integrate codex uninstall --scope <scope> --purge-data --yes` explicitly purges domain data
  after integration removal.
- Removing the Codex plugin alone does not delete TemporalThread configuration, backups, or data.

An export is a logical backup; this release does not provide an import command. Before database-level
recovery, preserve the SQLite database together with its `-wal` and `-shm` files while all writers are
stopped.

## Threat model and controls

| Threat | Control | Remaining limitation |
| --- | --- | --- |
| Malformed/adversarial hook payload | Strict schemas, byte/character bounds, no evaluation, neutral failure | A trusted host still controls supplied metadata/text |
| Prompt disclosure in logs/errors | In-memory policy processing and sanitized output | Full history intentionally stores text when explicitly enabled |
| Prompt injection from stored content | Bounded structured context, untrusted-data label, title sanitization/truncation | The model still receives selected data and must follow its instruction hierarchy |
| Duplicate delivery | Hashed deterministic idempotency identity and database uniqueness | Events without stable host IDs use bounded safe event fields |
| Config loss or takeover | Parse first, backups, atomic write, rollback, ownership markers/hashes, symlink refusal | Users must protect filesystem ownership and backups |
| Network exposure | Stdio-only server; no port, telemetry, or remote sync | The surrounding Codex host has its own network behavior/policy |
| Hook blocks normal work | Five-second host timeout, neutral output, exit zero, optional MCP | Host-level trust/configuration can still disable the hook |

## Privacy limitations

- Best-effort hooks can miss events when disabled, untrusted, interrupted, timed out, or omitted during
  abnormal termination.
- `Stop.last_assistant_message` is only the latest host-provided message, not a complete transcript.
- Hashes and stable identities may reveal equality/correlation to a local observer and are not anonymity.
- Temporal references and commitment titles may still be sensitive even when complete prompts are absent.
- TemporalThread cannot control data Codex retains independently of this local integration.

See the general [privacy model](PRIVACY.md) and [security design](SECURITY.md).
