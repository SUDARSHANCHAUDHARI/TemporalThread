import { z } from 'zod';
import {
  CommitmentDisplayStatusSchema,
  CommitmentStatusSchema,
  InteractionRoleSchema,
  PrivacyModeSchema,
} from './enums.js';

const NameSchema = z.string().trim().min(1).max(128);
const TimestampSchema = z.string().trim().min(1).max(128);
const TimezoneSchema = z.string().trim().min(1).max(128);

export const AgentSelectorSchema = z
  .object({
    name: NameSchema,
    platform: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const AgentInputSchema = AgentSelectorSchema.extend({
  platform: z.string().trim().min(1).max(64),
  version: z.string().trim().min(1).max(64).optional(),
}).strict();

export const ProjectSelectorSchema = z
  .object({
    path: z.string().trim().min(1).max(4096).optional(),
    name: NameSchema.optional(),
  })
  .strict()
  .refine((value) => value.path !== undefined || value.name !== undefined, {
    error: 'Project selector requires path or name',
  });

export const ProjectInputSchema = z
  .object({
    path: z.string().trim().min(1).max(4096),
    name: NameSchema.optional(),
    repositoryRemote: z.string().trim().min(1).max(2048).optional(),
  })
  .strict();

export const GetCurrentTimeInputSchema = z
  .object({
    timezone: TimezoneSchema.optional(),
  })
  .strict();

export const RecordInteractionInputSchema = z
  .object({
    role: InteractionRoleSchema,
    occurredAt: TimestampSchema.optional(),
    timezone: TimezoneSchema.optional(),
    agent: AgentInputSchema,
    project: ProjectInputSchema.optional(),
    sessionId: z.string().trim().min(1).max(256).optional(),
    text: z.string().max(1_000_000).optional(),
    idempotencyKey: z.string().trim().min(1).max(256).optional(),
    privacyMode: PrivacyModeSchema.optional(),
  })
  .strict();

export const EndSessionInputSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(256),
    endedAt: TimestampSchema.optional(),
    agent: AgentSelectorSchema.optional(),
    project: ProjectSelectorSchema.optional(),
  })
  .strict();

export const GetTemporalContextInputSchema = z
  .object({
    agent: AgentSelectorSchema.optional(),
    project: ProjectSelectorSchema.optional(),
    sessionId: z.string().trim().min(1).max(256).optional(),
    includeCommitments: z.boolean().optional(),
    maximumCommitments: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export const GetLastInteractionInputSchema = z
  .object({
    agent: AgentSelectorSchema.optional(),
    project: ProjectSelectorSchema.optional(),
    sessionId: z.string().trim().min(1).max(256).optional(),
    role: InteractionRoleSchema.optional(),
    includeRawText: z.boolean().optional(),
  })
  .strict();

export const CalculateElapsedTimeInputSchema = z
  .object({
    start: TimestampSchema,
    end: TimestampSchema.optional(),
    timezone: TimezoneSchema.optional(),
  })
  .strict();

export const ResolveRelativeTimeInputSchema = z
  .object({
    expression: z.string().trim().min(1).max(500),
    anchorTime: TimestampSchema,
    timezone: TimezoneSchema,
    locale: z.string().trim().min(2).max(35).optional(),
  })
  .strict();

export const RecordCommitmentInputSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    originalExpression: z.string().trim().min(1).max(500).optional(),
    anchorTime: TimestampSchema,
    timezone: TimezoneSchema,
    project: ProjectSelectorSchema.optional(),
    sessionId: z.string().trim().min(1).max(256).optional(),
    sourceInteractionId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const ListCommitmentsInputSchema = z
  .object({
    status: z.union([CommitmentStatusSchema, CommitmentDisplayStatusSchema]).optional(),
    project: ProjectSelectorSchema.optional(),
    dueBefore: TimestampSchema.optional(),
    dueAfter: TimestampSchema.optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .strict();

export const UpdateCommitmentInputSchema = z
  .object({
    commitmentId: z.string().trim().min(1).max(64),
    status: CommitmentStatusSchema,
    completedAt: TimestampSchema.optional(),
    newDueExpression: z.string().trim().min(1).max(500).optional(),
    anchorTime: TimestampSchema.optional(),
    timezone: TimezoneSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'rescheduled' && !value.newDueExpression) {
      context.addIssue({
        code: 'custom',
        path: ['newDueExpression'],
        message: 'A rescheduled commitment requires newDueExpression',
      });
    }
    if (value.newDueExpression && (!value.anchorTime || !value.timezone)) {
      context.addIssue({
        code: 'custom',
        path: ['anchorTime'],
        message: 'Rescheduling requires anchorTime and timezone',
      });
    }
  });

export const GenericEventSchema = RecordInteractionInputSchema.extend({
  eventType: z.literal('interaction').default('interaction'),
}).strict();

export type GetCurrentTimeInput = z.infer<typeof GetCurrentTimeInputSchema>;
export type RecordInteractionInput = z.infer<typeof RecordInteractionInputSchema>;
export type EndSessionInput = z.infer<typeof EndSessionInputSchema>;
export type GetTemporalContextInput = z.infer<typeof GetTemporalContextInputSchema>;
export type GetLastInteractionInput = z.infer<typeof GetLastInteractionInputSchema>;
export type CalculateElapsedTimeInput = z.infer<typeof CalculateElapsedTimeInputSchema>;
export type ResolveRelativeTimeInput = z.infer<typeof ResolveRelativeTimeInputSchema>;
export type RecordCommitmentInput = z.infer<typeof RecordCommitmentInputSchema>;
export type ListCommitmentsInput = z.infer<typeof ListCommitmentsInputSchema>;
export type UpdateCommitmentInput = z.infer<typeof UpdateCommitmentInputSchema>;
export type GenericEvent = z.infer<typeof GenericEventSchema>;
