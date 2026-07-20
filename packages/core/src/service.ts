import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { Temporal } from '@js-temporal/polyfill';
import type { TemporalThreadConfig } from '@temporalthread/config';
import {
  CalculateElapsedTimeInputSchema,
  type Commitment,
  type CommitmentDisplayStatus,
  type CommitmentListResult,
  type CommitmentView,
  EndSessionInputSchema,
  type EndSessionResult,
  GetCurrentTimeInputSchema,
  GetLastInteractionInputSchema,
  GetTemporalContextInputSchema,
  InteractionRoleSchema,
  type InteractionWithRelations,
  type LastInteractionResult,
  ListCommitmentsInputSchema,
  type Project,
  type ProjectSelector,
  RecordCommitmentInputSchema,
  type RecordedCommitmentResult,
  type RecordedInteractionResult,
  RecordInteractionInputSchema,
  ResolveRelativeTimeInputSchema,
  type Session,
  type TemporalContextResult,
  type TemporalReference,
  type TemporalResolution,
  type TimelineItem,
  UpdateCommitmentInputSchema,
  type UpdatedCommitmentResult,
} from '@temporalthread/shared-types';
import type { InteractionFilters, SqliteStorage } from '@temporalthread/storage-sqlite';
import { extractTemporalReferences, resolveRelativeTime } from '@temporalthread/temporal-parser';
import { ulid } from 'ulid';
import type { Clock } from './clock.js';
import { calculateElapsedTime, getCurrentTime } from './time.js';

interface ResolvedFilters {
  filters: InteractionFilters;
  project: Project | null;
  session: Session | null;
  matched: boolean;
}

const commitmentStatuses: CommitmentDisplayStatus[] = ['pending', 'due', 'overdue', 'completed', 'cancelled'];

function canonicalInstant(value: string, field: string): Temporal.Instant {
  try {
    return Temporal.Instant.from(value);
  } catch (error) {
    throw new Error(`${field} must be an ISO 8601 timestamp with a UTC offset`, { cause: error });
  }
}

function temporalResolution(reference: TemporalReference): TemporalResolution {
  return {
    originalExpression: reference.originalExpression,
    normalizedExpression: reference.normalizedExpression,
    referenceType: reference.referenceType,
    anchorTimeUtc: reference.anchorTimeUtc,
    anchorTimezone: reference.anchorTimezone,
    resolvedStartUtc: reference.resolvedStartUtc,
    resolvedEndUtc: reference.resolvedEndUtc,
    resolutionType: reference.resolutionType,
    confidence: reference.confidence,
    parserVersion: reference.parserVersion,
    explanation: reference.explanation,
    ambiguity: reference.ambiguity,
  };
}

export class TemporalThreadService {
  readonly storage: SqliteStorage;
  readonly config: TemporalThreadConfig;
  readonly clock: Clock;

  constructor(options: { storage: SqliteStorage; config: TemporalThreadConfig; clock: Clock }) {
    this.storage = options.storage;
    this.config = options.config;
    this.clock = options.clock;
  }

  getCurrentTime(input: unknown) {
    const parsed = GetCurrentTimeInputSchema.parse(input);
    return getCurrentTime(this.clock, parsed.timezone ?? this.config.timezone);
  }

  calculateElapsedTime(input: unknown) {
    const parsed = CalculateElapsedTimeInputSchema.parse(input);
    return calculateElapsedTime(
      parsed.start,
      parsed.end,
      parsed.timezone ?? this.config.timezone,
      this.clock,
    );
  }

  resolveRelativeTime(input: unknown): TemporalResolution {
    const parsed = ResolveRelativeTimeInputSchema.parse(input);
    return resolveRelativeTime(parsed.expression, parsed.anchorTime, parsed.timezone, parsed.locale);
  }

  recordInteraction(input: unknown): RecordedInteractionResult {
    const parsed = RecordInteractionInputSchema.parse(input);
    if (parsed.text && Buffer.byteLength(parsed.text, 'utf8') > this.config.maxTextBytes) {
      throw new Error(`Interaction text exceeds the configured ${this.config.maxTextBytes}-byte limit`);
    }

    if (parsed.idempotencyKey) {
      const existing = this.storage.getInteractionByIdempotencyKey(parsed.idempotencyKey);
      if (existing) {
        return {
          interactionId: existing.id,
          sessionId: existing.sessionId,
          duplicate: true,
          privacyMode: existing.privacyMode,
          temporalReferences: this.storage.getTemporalReferences(existing.id).map(temporalResolution),
        };
      }
    }

    const now = this.clock.now();
    const createdAt = now.toString();
    const occurred = parsed.occurredAt ? canonicalInstant(parsed.occurredAt, 'occurredAt') : now;
    const timezone = parsed.timezone ?? this.config.timezone;
    let zoned: Temporal.ZonedDateTime;
    try {
      zoned = occurred.toZonedDateTimeISO(timezone);
    } catch (error) {
      throw new Error(`Invalid IANA timezone: ${timezone}`, { cause: error });
    }
    const occurredAtUtc = occurred.toString();
    const agent = this.storage.upsertAgent({
      id: ulid(now.epochMilliseconds),
      name: parsed.agent.name,
      platform: parsed.agent.platform,
      version: parsed.agent.version ?? null,
      seenAt: occurredAtUtc,
    });
    const project = parsed.project
      ? this.storage.upsertProject({
          id: ulid(now.epochMilliseconds),
          name: parsed.project.name ?? basename(resolve(parsed.project.path)),
          normalizedPath: resolve(parsed.project.path),
          repositoryRemote: parsed.project.repositoryRemote ?? null,
          seenAt: occurredAtUtc,
        })
      : null;
    const session = this.resolveOrCreateSession(
      agent.id,
      project?.id ?? null,
      parsed.sessionId,
      occurred,
      timezone,
    );
    const privacyMode = parsed.privacyMode ?? this.config.privacyMode;
    const messageHash = parsed.text ? createHash('sha256').update(parsed.text).digest('hex') : null;
    const extracted =
      parsed.text && privacyMode !== 'metadata-only'
        ? extractTemporalReferences(parsed.text, occurredAtUtc, timezone, this.config.locale)
        : [];
    const interactionId = ulid(now.epochMilliseconds);
    const idempotencyKey = parsed.idempotencyKey ?? `generated:${ulid(now.epochMilliseconds)}`;
    const storedReferences: TemporalReference[] = extracted.map((reference) => ({
      id: ulid(now.epochMilliseconds),
      interactionId,
      ...reference,
      createdAt,
    }));
    const inserted = this.storage.insertInteraction({
      interaction: {
        id: interactionId,
        idempotencyKey,
        sessionId: session.id,
        agentId: agent.id,
        projectId: project?.id ?? null,
        role: parsed.role,
        occurredAtUtc,
        timezone,
        utcOffsetMinutes: zoned.offsetNanoseconds / (60 * 1_000_000_000),
        messageHash,
        textPreview: privacyMode === 'full-local-history' && parsed.text ? parsed.text.slice(0, 160) : null,
        rawText: privacyMode === 'full-local-history' ? (parsed.text ?? null) : null,
        privacyMode,
        createdAt,
      },
      temporalReferences: storedReferences,
    });

    return {
      interactionId: inserted.interaction.id,
      sessionId: inserted.interaction.sessionId,
      duplicate: inserted.duplicate,
      privacyMode: inserted.interaction.privacyMode,
      temporalReferences: inserted.duplicate
        ? this.storage.getTemporalReferences(inserted.interaction.id).map(temporalResolution)
        : extracted,
    };
  }

  endSession(input: unknown): EndSessionResult {
    const parsed = EndSessionInputSchema.parse(input);
    const endedAt = parsed.endedAt
      ? canonicalInstant(parsed.endedAt, 'endedAt').toString()
      : this.clock.now().toString();
    const resolved = this.resolveInteractionFilters(parsed);
    if (!resolved.matched || !resolved.session) return { ended: false, endedAt: null };
    const session = this.storage.endSession(resolved.session.id, endedAt);
    return session ? { ended: true, endedAt: session.endedAt } : { ended: false, endedAt: null };
  }

  getLastInteraction(input: unknown): LastInteractionResult | null {
    const parsed = GetLastInteractionInputSchema.parse(input);
    const resolved = this.resolveInteractionFilters(parsed);
    if (!resolved.matched) return null;
    const record = this.storage.getLastInteraction(resolved.filters);
    if (!record) return null;
    return this.lastInteractionResult(record, parsed.includeRawText ?? false);
  }

  private lastInteractionResult(
    record: InteractionWithRelations,
    includeRawText: boolean,
  ): LastInteractionResult {
    const { interaction, agent, project, session } = record;
    const result = {
      interactionId: interaction.id,
      timestamp: interaction.occurredAtUtc,
      timezone: interaction.timezone,
      elapsed: calculateElapsedTime(interaction.occurredAtUtc, undefined, this.config.timezone, this.clock),
      project: project
        ? { id: project.id, name: project.name, normalizedPath: project.normalizedPath }
        : null,
      agent: {
        id: agent.id,
        name: agent.name,
        platform: agent.platform,
        version: agent.version,
      },
      session: {
        id: session.id,
        externalSessionId: session.externalSessionId,
        generatedSession: session.generatedSession,
      },
      role: interaction.role,
    };
    return includeRawText && interaction.privacyMode === 'full-local-history' && interaction.rawText !== null
      ? { ...result, rawText: interaction.rawText }
      : result;
  }

  getTemporalContext(input: unknown): TemporalContextResult {
    const parsed = GetTemporalContextInputSchema.parse(input);
    const resolved = this.resolveInteractionFilters(parsed);
    const currentTime = getCurrentTime(this.clock, this.config.timezone);
    if (!resolved.matched) {
      return {
        currentTime,
        lastInteraction: null,
        elapsed: null,
        resumedSession: false,
        previousSession: null,
        unresolvedTemporalReferences: [],
        commitments: [],
        timezoneChange: {
          changed: false,
          previousTimezone: null,
          currentTimezone: this.config.timezone,
        },
      };
    }

    const lastRecord = this.storage.getLastConversationalInteraction(resolved.filters);
    const last = lastRecord ? this.lastInteractionResult(lastRecord, false) : null;
    const elapsed = last?.elapsed ?? null;
    const threshold = this.config.temporalContextRefreshThresholdMinutes * 60 * 1_000;
    const previousSession = lastRecord ? this.storage.getPreviousSession(lastRecord.session) : null;
    const maximumCommitments = parsed.maximumCommitments ?? 5;
    const commitments =
      parsed.includeCommitments === false
        ? []
        : this.listCommitments({
            ...(parsed.project ? { project: parsed.project } : {}),
            limit: 100,
          })
            .commitments.filter((item) => ['pending', 'due', 'overdue'].includes(item.displayStatus))
            .slice(0, maximumCommitments);

    return {
      currentTime,
      lastInteraction: last,
      elapsed: elapsed
        ? {
            totalMilliseconds: elapsed.totalMilliseconds,
            humanReadable: elapsed.humanReadable,
            calendarDayDifference: elapsed.calendarDayDifference,
          }
        : null,
      resumedSession: elapsed ? elapsed.totalMilliseconds >= threshold : false,
      previousSession: previousSession
        ? {
            id: previousSession.id,
            externalSessionId: previousSession.externalSessionId,
            lastInteractionAt: previousSession.lastInteractionAt,
          }
        : null,
      unresolvedTemporalReferences: this.storage
        .listUnresolvedTemporalReferences(resolved.filters, 5)
        .map((reference) => ({
          id: reference.id,
          originalExpression: reference.originalExpression,
          resolutionType: reference.resolutionType,
          resolvedStartUtc: reference.resolvedStartUtc,
          resolvedEndUtc: reference.resolvedEndUtc,
          confidence: reference.confidence,
        })),
      commitments,
      timezoneChange: {
        changed: Boolean(lastRecord && lastRecord.interaction.timezone !== this.config.timezone),
        previousTimezone: lastRecord?.interaction.timezone ?? null,
        currentTimezone: this.config.timezone,
      },
    };
  }

  recordCommitment(input: unknown): RecordedCommitmentResult {
    const parsed = RecordCommitmentInputSchema.parse(input);
    const anchor = canonicalInstant(parsed.anchorTime, 'anchorTime');
    const now = this.clock.now().toString();
    const project = parsed.project ? this.resolveProject(parsed.project) : null;
    if (parsed.project && !project) throw new Error('Project not found');
    try {
      anchor.toZonedDateTimeISO(parsed.timezone);
    } catch (error) {
      throw new Error(`Invalid IANA timezone: ${parsed.timezone}`, { cause: error });
    }
    const session = parsed.sessionId ? this.resolveSession(parsed.sessionId, undefined, project?.id) : null;
    if (parsed.sessionId && !session) throw new Error('Session not found');
    const source = parsed.sourceInteractionId
      ? this.storage.getInteraction(parsed.sourceInteractionId)
      : null;
    if (parsed.sourceInteractionId && !source) throw new Error('Source interaction not found');
    if (project && session && session.projectId !== project.id) {
      throw new Error('Commitment scope mismatch between project and session');
    }
    if (project && source && source.projectId !== project.id) {
      throw new Error('Commitment scope mismatch between project and source interaction');
    }
    if (session && source && source.sessionId !== session.id) {
      throw new Error('Commitment scope mismatch between session and source interaction');
    }
    const resolution = parsed.originalExpression
      ? resolveRelativeTime(parsed.originalExpression, anchor.toString(), parsed.timezone, this.config.locale)
      : null;
    const allowOriginal = source
      ? source.privacyMode === 'full-local-history'
      : this.config.privacyMode === 'full-local-history';
    const commitment = this.storage.insertCommitment({
      id: ulid(this.clock.now().epochMilliseconds),
      sourceInteractionId: source?.id ?? null,
      projectId: project?.id ?? source?.projectId ?? null,
      sessionId: session?.id ?? source?.sessionId ?? null,
      title: parsed.title,
      originalText: allowOriginal ? (parsed.originalExpression ?? null) : null,
      dueStartUtc: resolution?.resolvedStartUtc ?? null,
      dueEndUtc: resolution?.resolvedEndUtc ?? null,
      timezone: parsed.timezone,
      status: 'pending',
      completedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    });
    return { commitment: this.commitmentView(commitment), resolution };
  }

  listCommitments(input: unknown): CommitmentListResult {
    const parsed = ListCommitmentsInputSchema.parse(input);
    const project = parsed.project ? this.resolveProject(parsed.project) : null;
    if (parsed.project && !project) return this.emptyCommitmentList();
    const dueBefore = parsed.dueBefore
      ? canonicalInstant(parsed.dueBefore, 'dueBefore').toString()
      : undefined;
    const dueAfter = parsed.dueAfter ? canonicalInstant(parsed.dueAfter, 'dueAfter').toString() : undefined;
    const commitments = this.storage
      .listCommitments(
        {
          ...(parsed.project ? { projectId: project?.id ?? null } : {}),
          ...(dueBefore ? { dueBefore } : {}),
          ...(dueAfter ? { dueAfter } : {}),
        },
        parsed.limit ?? 100,
      )
      .map((item) => this.commitmentView(item))
      .filter(
        (item) => !parsed.status || item.status === parsed.status || item.displayStatus === parsed.status,
      );
    const counts = Object.fromEntries(commitmentStatuses.map((status) => [status, 0])) as Record<
      CommitmentDisplayStatus,
      number
    >;
    for (const commitment of commitments) counts[commitment.displayStatus] += 1;
    return { commitments, counts };
  }

  updateCommitment(input: unknown): UpdatedCommitmentResult {
    const parsed = UpdateCommitmentInputSchema.parse(input);
    const existing = this.storage.getCommitment(parsed.commitmentId);
    if (!existing) throw new Error('Commitment not found');
    const now = this.clock.now().toString();
    let resolution: TemporalResolution | null = null;
    let updated: Commitment;

    if (parsed.status === 'rescheduled') {
      resolution = resolveRelativeTime(
        parsed.newDueExpression as string,
        canonicalInstant(parsed.anchorTime as string, 'anchorTime').toString(),
        parsed.timezone as string,
        this.config.locale,
      );
      updated = {
        ...existing,
        dueStartUtc: resolution.resolvedStartUtc,
        dueEndUtc: resolution.resolvedEndUtc,
        timezone: parsed.timezone as string,
        status: 'pending',
        completedAt: null,
        cancelledAt: null,
        originalText: existing.originalText ? (parsed.newDueExpression as string) : null,
        updatedAt: now,
      };
    } else {
      const completedAt =
        parsed.status === 'completed'
          ? parsed.completedAt
            ? canonicalInstant(parsed.completedAt, 'completedAt').toString()
            : now
          : null;
      updated = {
        ...existing,
        status: parsed.status,
        completedAt,
        cancelledAt: parsed.status === 'cancelled' ? now : null,
        updatedAt: now,
      };
    }
    const saved = this.storage.updateCommitment(updated);
    return { commitment: this.commitmentView(saved), resolution, action: parsed.status };
  }

  exportData() {
    return this.storage.exportAll(this.clock.now().toString());
  }

  purgeData() {
    return this.storage.purgeAll();
  }

  listTimeline(input: {
    agent?: { name: string; platform?: string | undefined } | undefined;
    project?: ProjectSelector | { path?: string | undefined; name?: string | undefined } | undefined;
    sessionId?: string | undefined;
    role?: InteractionFilters['role'] | undefined;
    limit?: number | undefined;
  }): TimelineItem[] {
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error('Timeline limit must be an integer from 1 to 500');
    }
    const role = input.role ? InteractionRoleSchema.parse(input.role) : undefined;
    const resolved = this.resolveInteractionFilters({
      ...input,
      ...(role ? { role } : {}),
    });
    if (!resolved.matched) return [];
    return this.storage
      .listInteractions(resolved.filters, limit)
      .map(({ interaction, agent, project, session }) => ({
        interactionId: interaction.id,
        timestamp: interaction.occurredAtUtc,
        timezone: interaction.timezone,
        role: interaction.role,
        privacyMode: interaction.privacyMode,
        temporalReferenceCount: this.storage.getTemporalReferences(interaction.id).length,
        agent: { id: agent.id, name: agent.name, platform: agent.platform },
        project: project
          ? { id: project.id, name: project.name, normalizedPath: project.normalizedPath }
          : null,
        session: {
          id: session.id,
          externalSessionId: session.externalSessionId,
          generatedSession: session.generatedSession,
        },
      }));
  }

  private resolveOrCreateSession(
    agentId: string,
    projectId: string | null,
    externalSessionId: string | undefined,
    occurred: Temporal.Instant,
    timezone: string,
  ): Session {
    const occurredAt = occurred.toString();
    const existing = externalSessionId
      ? this.storage.findExternalSession(agentId, projectId, externalSessionId)
      : this.storage.findGeneratedSession(
          agentId,
          projectId,
          occurredAt,
          occurred.subtract({ minutes: this.config.sessionInactivityThresholdMinutes }).toString(),
        );
    if (existing) return existing;
    return this.storage.createSession({
      id: ulid(this.clock.now().epochMilliseconds),
      externalSessionId: externalSessionId ?? null,
      agentId,
      projectId,
      occurredAt,
      generated: !externalSessionId,
      metadata: { anchorTimezone: timezone },
    });
  }

  private resolveProject(selector: { path?: string | undefined; name?: string | undefined }): Project | null {
    return selector.path
      ? this.storage.findProject({
          normalizedPath: resolve(selector.path),
          ...(selector.name ? { name: selector.name } : {}),
        })
      : this.storage.findProject({ name: selector.name as string });
  }

  private resolveSession(sessionId: string, agentId?: string, projectId?: string | null): Session | null {
    const internal = this.storage.getSession(sessionId);
    if (internal) {
      const matchesAgent = !agentId || internal.agentId === agentId;
      const matchesProject = projectId === undefined || internal.projectId === projectId;
      return matchesAgent && matchesProject ? internal : null;
    }
    const matches = this.storage
      .findSessionsByExternalId(sessionId)
      .filter((session) => !agentId || session.agentId === agentId)
      .filter((session) => projectId === undefined || session.projectId === projectId);
    if (matches.length > 1) {
      throw new Error('Session identifier is ambiguous; include an agent or project selector');
    }
    return matches[0] ?? null;
  }

  private resolveInteractionFilters(input: {
    agent?: { name: string; platform?: string | undefined } | undefined;
    project?: ProjectSelector | { path?: string | undefined; name?: string | undefined } | undefined;
    sessionId?: string | undefined;
    role?: InteractionFilters['role'] | undefined;
  }): ResolvedFilters {
    const agent = input.agent
      ? this.storage.findAgent({
          name: input.agent.name,
          ...(input.agent.platform ? { platform: input.agent.platform } : {}),
        })
      : null;
    if (input.agent && !agent) return { filters: {}, project: null, session: null, matched: false };
    const project = input.project ? this.resolveProject(input.project) : null;
    if (input.project && !project) return { filters: {}, project: null, session: null, matched: false };
    const session = input.sessionId
      ? this.resolveSession(input.sessionId, agent?.id, input.project ? project?.id : undefined)
      : null;
    if (input.sessionId && !session) return { filters: {}, project, session: null, matched: false };
    return {
      filters: {
        ...(agent ? { agentId: agent.id } : {}),
        ...(input.project ? { projectId: project?.id ?? null } : {}),
        ...(session ? { sessionId: session.id } : {}),
        ...(input.role ? { role: input.role } : {}),
      },
      project,
      session,
      matched: true,
    };
  }

  private commitmentView(commitment: Commitment): CommitmentView {
    if (commitment.status === 'completed' || commitment.status === 'cancelled') {
      return { ...commitment, displayStatus: commitment.status, overdueCalendarDays: null };
    }
    const now = this.clock.now();
    const dueStart = commitment.dueStartUtc
      ? canonicalInstant(commitment.dueStartUtc, 'stored dueStartUtc')
      : null;
    const dueEnd = commitment.dueEndUtc
      ? canonicalInstant(commitment.dueEndUtc, 'stored dueEndUtc')
      : dueStart;
    if (!dueStart || !dueEnd) {
      return { ...commitment, displayStatus: 'pending', overdueCalendarDays: null };
    }
    const dueIsRange = Temporal.Instant.compare(dueStart, dueEnd) < 0;
    const pastDue = dueIsRange
      ? Temporal.Instant.compare(now, dueEnd) >= 0
      : Temporal.Instant.compare(now, dueEnd) > 0;
    if (pastDue) {
      const dueDate = dueStart.toZonedDateTimeISO(commitment.timezone).toPlainDate();
      const currentDate = now.toZonedDateTimeISO(commitment.timezone).toPlainDate();
      return {
        ...commitment,
        displayStatus: 'overdue',
        overdueCalendarDays: Math.max(0, dueDate.until(currentDate, { largestUnit: 'day' }).days),
      };
    }
    if (Temporal.Instant.compare(now, dueStart) >= 0) {
      return { ...commitment, displayStatus: 'due', overdueCalendarDays: 0 };
    }
    return { ...commitment, displayStatus: 'pending', overdueCalendarDays: null };
  }

  private emptyCommitmentList(): CommitmentListResult {
    return {
      commitments: [],
      counts: Object.fromEntries(commitmentStatuses.map((status) => [status, 0])) as Record<
        CommitmentDisplayStatus,
        number
      >,
    };
  }
}
