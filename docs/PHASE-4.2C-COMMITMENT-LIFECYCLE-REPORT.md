# Phase 4.2C commitment lifecycle report

Report date: 2026-07-26

## Decision

**Phase 4.2C implementation: COMPLETE**

**Automated validation on the final documentation commit: NOT YET CONFIRMED**

**v0.1.0: NO-GO**

The commitment update boundary now distinguishes persisted states from update actions, validates action-specific fields, applies one explicit lifecycle transition function, avoids unnecessary writes for idempotent retries, returns bounded MCP errors, and relies on SQLite lifecycle constraints added in Phase 4.2E.

## Baseline

- Starting commit: `3245902f6b39aba168063c84b218c5c00b5d888d`
- No package version, npm state, release artifact, tag, GitHub release, or repository visibility changed.

## Persisted state and update action

Persisted commitment states are:

- `pending`
- `completed`
- `cancelled`

Update actions are:

- `pending` — reopen
- `completed`
- `cancelled`
- `rescheduled`

`rescheduled` is no longer represented as a valid persisted entity/output status. A reschedule action writes the new due resolution and returns the row to `pending`.

## Transition rules

| Existing state | Action | Result |
| --- | --- | --- |
| pending | completed | completed; completion timestamp set |
| pending | cancelled | cancelled; cancellation timestamp set |
| pending | pending | unchanged/idempotent |
| pending | rescheduled | pending with new due range |
| completed | completed | unchanged/idempotent; original completion time retained |
| completed | pending | reopened; terminal timestamps cleared |
| completed | cancelled | rejected until reopened |
| completed | rescheduled | reopened pending with new due range |
| cancelled | cancelled | unchanged/idempotent |
| cancelled | pending | reopened; terminal timestamps cleared |
| cancelled | completed | rejected until reopened |
| cancelled | rescheduled | reopened pending with new due range |

An explicit historical `completedAt` remains supported for imported or delayed events. Once a commitment is completed, a repeated completion request cannot rewrite the stored completion timestamp.

## Input hardening

- `completedAt` is accepted only for `completed`.
- `newDueExpression`, `anchorTime`, and `timezone` are accepted only for `rescheduled`.
- Every reschedule field is required together.
- Unknown fields remain rejected by strict Zod schemas.
- Contradictory combinations fail before storage mutation.

## Privacy and scope

- Rescheduling preserves commitment ID, project, session, and source-interaction scope.
- A privacy-redacted `originalText: null` remains null after rescheduling.
- The transition helper never receives or logs complete interaction text.
- MCP error output exposes only the allow-listed `Invalid commitment transition:` prefix and bounded lifecycle descriptions.

## Implementation

Key files:

- `packages/shared-types/src/enums.ts`
- `packages/shared-types/src/schemas.ts`
- `packages/shared-types/src/output-schemas.ts`
- `packages/shared-types/src/results.ts`
- `packages/core/src/commitment-lifecycle.ts`
- `packages/core/src/service.ts`
- `apps/mcp-server/src/server.ts`
- `tests/unit/update-commitment-schema.test.ts`
- `tests/unit/commitment-lifecycle.test.ts`

## Added automated coverage

The Phase 4.2C test declarations cover:

- persisted-state versus action schemas;
- accepted completion and reschedule requests;
- missing and incompatible action fields;
- idempotent completion, cancellation, and reopening;
- prevention of completion timestamp rewriting;
- direct terminal-to-terminal rejection;
- reopening completed/cancelled rows;
- rescheduling from every valid state;
- clearing terminal timestamps during reschedule;
- privacy preservation; and
- detection of internally inconsistent stored rows.

The final repository is expected to contain 29 test files and 166 tests after Phases 4.2C–4.2E. That count is derived from the committed test declarations and must not be treated as a verified CI result until the final workflow run is observed.

## Remaining limitations

- Lifecycle operations are local SQLite writes; there is no distributed compare-and-swap protocol.
- Historical completion timestamps are accepted when syntactically valid because delayed event ingestion is supported.
- No public release claim is authorized by this phase.
- The SDK/Hono packed-consumer blocker and npm authority requirements remain separate and unresolved.
