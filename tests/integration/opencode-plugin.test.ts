import { describe, expect, it } from 'vitest';
import { joinedMessageText, openCodeInteraction } from '../../integrations/opencode/plugin/temporalthread.js';

describe('OpenCode plugin adapter', () => {
  it('collects only meaningful human-visible text parts', () => {
    expect(
      joinedMessageText([
        { type: 'text', text: 'first' },
        { type: 'tool', text: 'not user text' },
        { type: 'text', text: 'generated', synthetic: true },
        { type: 'text', text: 'ignored', ignored: true },
        { type: 'text', text: 'second' },
      ]),
    ).toBe('first\nsecond');
  });

  it('creates a deterministic generic ingestion event', () => {
    expect(
      openCodeInteraction({
        role: 'assistant',
        createdAtMilliseconds: Date.parse('2026-07-20T12:00:00.000Z'),
        directory: '/workspace/example',
        sessionId: 'session-1',
        messageId: 'message-2',
        text: 'Done.',
      }),
    ).toEqual({
      eventType: 'interaction',
      role: 'assistant',
      occurredAt: '2026-07-20T12:00:00.000Z',
      agent: { name: 'OpenCode', platform: 'opencode' },
      project: { path: '/workspace/example' },
      sessionId: 'session-1',
      text: 'Done.',
      idempotencyKey: 'opencode:session-1:message-2:assistant',
    });
  });
});
