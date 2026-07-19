import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { TemporalThreadService } from '@temporalthread/core';
import {
  CalculateElapsedTimeInputSchema,
  CommitmentListOutputSchema,
  CurrentTimeOutputSchema,
  ElapsedTimeOutputSchema,
  GetCurrentTimeInputSchema,
  GetLastInteractionInputSchema,
  GetLastInteractionOutputSchema,
  GetTemporalContextInputSchema,
  ListCommitmentsInputSchema,
  RecordCommitmentInputSchema,
  RecordedCommitmentOutputSchema,
  RecordedInteractionOutputSchema,
  RecordInteractionInputSchema,
  ResolveRelativeTimeInputSchema,
  TemporalContextOutputSchema,
  TemporalResolutionOutputSchema,
  UpdateCommitmentInputSchema,
  UpdatedCommitmentOutputSchema,
} from '@temporalthread/shared-types';
import { ZodError } from 'zod';

const readOnly: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const localWrite: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

function success(value: object): CallToolResult {
  const structuredContent = value as Record<string, unknown>;
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof ZodError) return 'Invalid tool input';
  if (!(error instanceof Error)) return 'TemporalThread operation failed';
  const safePrefixes = [
    'Invalid IANA timezone:',
    'Invalid local time in relative expression',
    'Interaction text exceeds',
    'Project not found',
    'Session not found',
    'Source interaction not found',
    'Commitment not found',
    'Session identifier is ambiguous',
    'Commitment scope mismatch',
    'anchorTime must be',
    'occurredAt must be',
    'start must be',
    'end must be',
    'dueBefore must be',
    'dueAfter must be',
    'completedAt must be',
  ];
  return safePrefixes.some((prefix) => error.message.startsWith(prefix))
    ? error.message
    : 'TemporalThread operation failed';
}

function execute(operation: () => object): CallToolResult {
  try {
    return success(operation());
  } catch (error) {
    return {
      content: [{ type: 'text', text: safeErrorMessage(error) }],
      isError: true,
    };
  }
}

export function createMcpServer(service: TemporalThreadService): McpServer {
  const server = new McpServer({ name: 'temporal-thread', version: '0.1.0' });

  server.registerTool(
    'get_current_time',
    {
      title: 'Get current time',
      description: 'Return current UTC and local wall-clock context for an IANA timezone.',
      inputSchema: GetCurrentTimeInputSchema,
      outputSchema: CurrentTimeOutputSchema,
      annotations: readOnly,
    },
    (input) => execute(() => service.getCurrentTime(input)),
  );

  server.registerTool(
    'record_interaction',
    {
      title: 'Record interaction',
      description:
        'Persist interaction timing and privacy-permitted temporal references for durable continuity.',
      inputSchema: RecordInteractionInputSchema,
      outputSchema: RecordedInteractionOutputSchema,
      annotations: localWrite,
    },
    (input) => execute(() => service.recordInteraction(input)),
  );

  server.registerTool(
    'get_temporal_context',
    {
      title: 'Get temporal context',
      description:
        'Return compact continuity context: last interaction, elapsed time, unresolved references, and commitments.',
      inputSchema: GetTemporalContextInputSchema,
      outputSchema: TemporalContextOutputSchema,
      annotations: readOnly,
    },
    (input) => execute(() => service.getTemporalContext(input)),
  );

  server.registerTool(
    'get_last_interaction',
    {
      title: 'Get last interaction',
      description:
        'Find the most recent matching interaction by occurrence time; raw text requires explicit permission.',
      inputSchema: GetLastInteractionInputSchema,
      outputSchema: GetLastInteractionOutputSchema,
      annotations: readOnly,
    },
    (input) => execute(() => ({ interaction: service.getLastInteraction(input) })),
  );

  server.registerTool(
    'calculate_elapsed_time',
    {
      title: 'Calculate elapsed time',
      description:
        'Calculate exact elapsed duration and local calendar-day difference between two offset timestamps.',
      inputSchema: CalculateElapsedTimeInputSchema,
      outputSchema: ElapsedTimeOutputSchema,
      annotations: readOnly,
    },
    (input) => execute(() => service.calculateElapsedTime(input)),
  );

  server.registerTool(
    'resolve_relative_time',
    {
      title: 'Resolve relative time',
      description: 'Resolve a relative expression against its supplied historical anchor and IANA timezone.',
      inputSchema: ResolveRelativeTimeInputSchema,
      outputSchema: TemporalResolutionOutputSchema,
      annotations: readOnly,
    },
    (input) => execute(() => service.resolveRelativeTime(input)),
  );

  server.registerTool(
    'record_commitment',
    {
      title: 'Record commitment',
      description: 'Persist a follow-up commitment and its resolved or intentionally fuzzy due range.',
      inputSchema: RecordCommitmentInputSchema,
      outputSchema: RecordedCommitmentOutputSchema,
      annotations: localWrite,
    },
    (input) => execute(() => service.recordCommitment(input)),
  );

  server.registerTool(
    'list_commitments',
    {
      title: 'List commitments',
      description: 'List commitments with pending, due, overdue, completed, or cancelled display status.',
      inputSchema: ListCommitmentsInputSchema,
      outputSchema: CommitmentListOutputSchema,
      annotations: readOnly,
    },
    (input) => execute(() => service.listCommitments(input)),
  );

  server.registerTool(
    'update_commitment',
    {
      title: 'Update commitment',
      description: 'Complete, cancel, reopen, or reschedule an existing local commitment.',
      inputSchema: UpdateCommitmentInputSchema,
      outputSchema: UpdatedCommitmentOutputSchema,
      annotations: localWrite,
    },
    (input) => execute(() => service.updateCommitment(input)),
  );

  return server;
}
