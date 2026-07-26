import { z } from 'zod';

export const PrivacyModeSchema = z.enum(['metadata-only', 'temporal-references-only', 'full-local-history']);
export type PrivacyMode = z.infer<typeof PrivacyModeSchema>;

export const InteractionRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
export type InteractionRole = z.infer<typeof InteractionRoleSchema>;

export const ResolutionTypeSchema = z.enum(['exact', 'range', 'fuzzy', 'unresolved', 'adjusted']);
export type ResolutionType = z.infer<typeof ResolutionTypeSchema>;

export const ReferenceTypeSchema = z.enum(['relative', 'calendar', 'duration', 'day-part', 'fuzzy']);
export type ReferenceType = z.infer<typeof ReferenceTypeSchema>;

export const CommitmentPersistedStatusSchema = z.enum(['pending', 'completed', 'cancelled']);
export type CommitmentPersistedStatus = z.infer<typeof CommitmentPersistedStatusSchema>;

export const CommitmentUpdateActionSchema = z.enum([
  'pending',
  'completed',
  'cancelled',
  'rescheduled',
]);
export type CommitmentUpdateAction = z.infer<typeof CommitmentUpdateActionSchema>;

export const CommitmentStatusSchema = CommitmentPersistedStatusSchema;
export type CommitmentStatus = CommitmentPersistedStatus;

export const CommitmentDisplayStatusSchema = z.enum(['pending', 'due', 'overdue', 'completed', 'cancelled']);
export type CommitmentDisplayStatus = z.infer<typeof CommitmentDisplayStatusSchema>;

export const LogLevelSchema = z.enum(['silent', 'error', 'warn', 'info', 'debug']);
export type LogLevel = z.infer<typeof LogLevelSchema>;
