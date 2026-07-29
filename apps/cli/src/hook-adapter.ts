import { createHash } from 'node:crypto';
import { handleCodexHook } from '@sudarshanchaudhari/temporalthread-codex-integration';
import type { TemporalThreadConfig } from '@sudarshanchaudhari/temporalthread-config';
import type { TemporalThreadService } from '@sudarshanchaudhari/temporalthread-core';

export type HookHost = 'codex' | 'claude-code';

type HookInput = Record<string, unknown>;

function requiredString(input: HookInput, field: string): string {
  const value = input[field];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Hook input requires ${field}`);
  return value;
}

function optionalString(input: HookInput, field: string): string | undefined {
  const value = input[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function compactContext(context: ReturnType<TemporalThreadService['getTemporalContext']>): string {
  return `TemporalThread context: ${JSON.stringify({
    currentTime: context.currentTime,
    lastInteraction: context.lastInteraction
      ? {
          timestamp: context.lastInteraction.timestamp,
          timezone: context.lastInteraction.timezone,
          elapsed: context.lastInteraction.elapsed.humanReadable,
          calendarDayDifference: context.lastInteraction.elapsed.calendarDayDifference,
          agent: context.lastInteraction.agent,
          project: context.lastInteraction.project,
          session: context.lastInteraction.session,
        }
      : null,
    resumedSession: context.resumedSession,
    unresolvedTemporalReferences: context.unresolvedTemporalReferences,
    commitments: context.commitments.map((item) => ({
      id: item.id,
      title: item.title,
      dueStartUtc: item.dueStartUtc,
      dueEndUtc: item.dueEndUtc,
      timezone: item.timezone,
      displayStatus: item.displayStatus,
      overdueCalendarDays: item.overdueCalendarDays,
    })),
    timezoneChange: context.timezoneChange,
  })}`;
}

function hookOutput(event: string, additionalContext?: string): Record<string, unknown> {
  if (!additionalContext) return {};
  return {
    hookSpecificOutput: {
      hookEventName: event,
      additionalContext,
    },
  };
}

function idempotencyKey(host: HookHost, input: HookInput, role: string, text: string): string {
  const sessionId = requiredString(input, 'session_id');
  const turnId = optionalString(input, 'turn_id');
  const identity = turnId ?? createHash('sha256').update(text).digest('hex');
  return `${host}:${sessionId}:${identity}:${role}`;
}

export function handleHostHook(options: {
  host: HookHost;
  input: HookInput;
  service: TemporalThreadService;
  config: TemporalThreadConfig;
}): Record<string, unknown> {
  const { host, input, service, config } = options;
  if (host === 'codex') {
    return handleCodexHook({ input, service, config }).output;
  }
  const event = requiredString(input, 'hook_event_name');
  const sessionId = requiredString(input, 'session_id');
  const cwd = requiredString(input, 'cwd');
  const agent = {
    name: 'Claude Code',
    platform: host,
  };
  const selectors = {
    agent,
    project: { path: cwd },
    sessionId,
    includeCommitments: true,
    maximumCommitments: 5,
  };

  if (event === 'SessionStart') {
    return hookOutput(event, compactContext(service.getTemporalContext(selectors)));
  }

  if (event === 'UserPromptSubmit') {
    const prompt = requiredString(input, 'prompt');
    const priorContext = service.getTemporalContext(selectors);
    service.recordInteraction({
      role: 'user',
      timezone: config.timezone,
      agent,
      project: { path: cwd },
      sessionId,
      text: prompt,
      idempotencyKey: idempotencyKey(host, input, 'user', prompt),
    });
    const temporalCue = /\b(yesterday|tomorrow|later|last time|next week|elapsed|how long|continue)\b/i.test(
      prompt,
    );
    const relevant =
      priorContext.resumedSession ||
      temporalCue ||
      priorContext.commitments.some(
        (item) => item.displayStatus === 'due' || item.displayStatus === 'overdue',
      );
    return hookOutput(event, relevant ? compactContext(priorContext) : undefined);
  }

  if (event === 'Stop') {
    const message = optionalString(input, 'last_assistant_message');
    if (message) {
      service.recordInteraction({
        role: 'assistant',
        timezone: config.timezone,
        agent,
        project: { path: cwd },
        sessionId,
        text: message,
        idempotencyKey: idempotencyKey(host, input, 'assistant', message),
      });
    }
    return {};
  }

  throw new Error(`Unsupported hook event: ${event}`);
}
