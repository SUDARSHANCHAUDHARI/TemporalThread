import { z } from 'zod';
import {
  CommitmentDisplayStatusSchema,
  CommitmentStatusSchema,
  InteractionRoleSchema,
  PrivacyModeSchema,
  ReferenceTypeSchema,
  ResolutionTypeSchema,
} from './enums.js';

export const CurrentTimeOutputSchema = z
  .object({
    utcTime: z.string(),
    localIsoTime: z.string(),
    timezone: z.string(),
    utcOffset: z.string(),
    utcOffsetMinutes: z.number(),
    date: z.string(),
    dayOfWeek: z.string(),
    unixTimestamp: z.number().int(),
  })
  .strict();

const ExactDayBreakdownSchema = z
  .object({
    days: z.number().int().nonnegative(),
    hours: z.number().int().nonnegative(),
    minutes: z.number().int().nonnegative(),
    seconds: z.number().int().nonnegative(),
    milliseconds: z.number().int().nonnegative(),
  })
  .strict();

export const ElapsedTimeOutputSchema = z
  .object({
    startUtc: z.string(),
    endUtc: z.string(),
    timezone: z.string(),
    totalMilliseconds: z.number(),
    seconds: z.number(),
    minutes: z.number(),
    hours: z.number(),
    exactDays: z.number(),
    exactDayBreakdown: ExactDayBreakdownSchema,
    calendarDayDifference: z.number().int(),
    humanReadable: z.string(),
    endBeforeStart: z.boolean(),
  })
  .strict();

export const TemporalResolutionOutputSchema = z
  .object({
    originalExpression: z.string(),
    normalizedExpression: z.string(),
    referenceType: ReferenceTypeSchema,
    anchorTimeUtc: z.string(),
    anchorTimezone: z.string(),
    resolvedStartUtc: z.string().nullable(),
    resolvedEndUtc: z.string().nullable(),
    resolutionType: ResolutionTypeSchema,
    confidence: z.number().min(0).max(1),
    explanation: z.string(),
    ambiguity: z.string().nullable(),
    parserVersion: z.string(),
  })
  .strict();

export const RecordedInteractionOutputSchema = z
  .object({
    interactionId: z.string(),
    sessionId: z.string(),
    duplicate: z.boolean(),
    privacyMode: PrivacyModeSchema,
    temporalReferences: z.array(TemporalResolutionOutputSchema),
  })
  .strict();

const ProjectSummarySchema = z
  .object({ id: z.string(), name: z.string(), normalizedPath: z.string() })
  .strict();
const AgentSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    platform: z.string(),
    version: z.string().nullable(),
  })
  .strict();
const SessionSummarySchema = z
  .object({
    id: z.string(),
    externalSessionId: z.string().nullable(),
    generatedSession: z.boolean(),
  })
  .strict();

export const LastInteractionOutputSchema = z
  .object({
    interactionId: z.string(),
    timestamp: z.string(),
    timezone: z.string(),
    elapsed: ElapsedTimeOutputSchema,
    project: ProjectSummarySchema.nullable(),
    agent: AgentSummarySchema,
    session: SessionSummarySchema,
    role: InteractionRoleSchema,
    rawText: z.string().optional(),
  })
  .strict();

export const GetLastInteractionOutputSchema = z
  .object({ interaction: LastInteractionOutputSchema.nullable() })
  .strict();

const CommitmentSchema = z
  .object({
    id: z.string(),
    sourceInteractionId: z.string().nullable(),
    projectId: z.string().nullable(),
    sessionId: z.string().nullable(),
    title: z.string(),
    originalText: z.string().nullable(),
    dueStartUtc: z.string().nullable(),
    dueEndUtc: z.string().nullable(),
    timezone: z.string(),
    status: CommitmentStatusSchema,
    completedAt: z.string().nullable(),
    cancelledAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const CommitmentViewOutputSchema = CommitmentSchema.extend({
  displayStatus: CommitmentDisplayStatusSchema,
  overdueCalendarDays: z.number().int().nonnegative().nullable(),
}).strict();

export const CommitmentListOutputSchema = z
  .object({
    commitments: z.array(CommitmentViewOutputSchema),
    counts: z
      .object({
        pending: z.number().int().nonnegative(),
        due: z.number().int().nonnegative(),
        overdue: z.number().int().nonnegative(),
        completed: z.number().int().nonnegative(),
        cancelled: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const RecordedCommitmentOutputSchema = z
  .object({
    commitment: CommitmentViewOutputSchema,
    resolution: TemporalResolutionOutputSchema.nullable(),
  })
  .strict();

export const UpdatedCommitmentOutputSchema = RecordedCommitmentOutputSchema.extend({
  action: z.enum(['completed', 'cancelled', 'pending', 'rescheduled']),
}).strict();

const TemporalReferenceSummarySchema = z
  .object({
    id: z.string(),
    originalExpression: z.string(),
    resolutionType: ResolutionTypeSchema,
    resolvedStartUtc: z.string().nullable(),
    resolvedEndUtc: z.string().nullable(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const PreviousSessionSchema = z
  .object({
    id: z.string(),
    externalSessionId: z.string().nullable(),
    lastInteractionAt: z.string(),
  })
  .strict();

export const TemporalContextOutputSchema = z
  .object({
    currentTime: CurrentTimeOutputSchema,
    lastInteraction: LastInteractionOutputSchema.nullable(),
    elapsed: z
      .object({
        totalMilliseconds: z.number(),
        humanReadable: z.string(),
        calendarDayDifference: z.number().int(),
      })
      .strict()
      .nullable(),
    resumedSession: z.boolean(),
    previousSession: PreviousSessionSchema.nullable(),
    unresolvedTemporalReferences: z.array(TemporalReferenceSummarySchema),
    commitments: z.array(CommitmentViewOutputSchema),
    timezoneChange: z
      .object({
        changed: z.boolean(),
        previousTimezone: z.string().nullable(),
        currentTimezone: z.string(),
      })
      .strict(),
  })
  .strict();
