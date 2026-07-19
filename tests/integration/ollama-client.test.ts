import { describe, expect, it, vi } from 'vitest';
import {
  runOllamaConversation,
  type TemporalToolClient,
} from '../../examples/ollama-tool-client/src/index.js';

describe('Ollama tool client', () => {
  it('executes MCP calls, returns tool results, and keeps one conversation identifier', async () => {
    const calls: Array<{ name: string; arguments?: Record<string, unknown> }> = [];
    const temporalClient: TemporalToolClient = {
      listTools: async () => ({
        tools: [
          {
            name: 'get_current_time',
            description: 'Get local time',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          },
          {
            name: 'record_interaction',
            description: 'Record timing',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          },
        ],
      }),
      callTool: async (input) => {
        calls.push(input);
        return input.name === 'get_current_time' ? { structuredContent: { timezone: 'UTC' } } : {};
      },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [{ function: { name: 'get_current_time', arguments: {} } }],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: { role: 'assistant', content: 'It is UTC.' } }), {
          status: 200,
        }),
      );

    const answer = await runOllamaConversation({
      temporalClient,
      fetcher,
      model: 'test-tool-model',
      prompt: 'What time is it?',
      conversationId: 'conversation-7',
      turnId: 'turn-2',
    });

    expect(answer).toBe('It is UTC.');
    expect(calls.map((call) => call.name)).toEqual([
      'record_interaction',
      'get_current_time',
      'record_interaction',
    ]);
    expect(calls[0]?.arguments).toMatchObject({
      sessionId: 'conversation-7',
      idempotencyKey: 'ollama:conversation-7:turn-2:user',
    });
    expect(calls[2]?.arguments).toMatchObject({
      sessionId: 'conversation-7',
      idempotencyKey: 'ollama:conversation-7:turn-2:assistant',
    });
    const secondRequest = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(secondRequest.messages.at(-1)).toMatchObject({
      role: 'tool',
      content: expect.stringContaining('UTC'),
    });
  });

  it('fails safely on an invalid runtime response', async () => {
    const temporalClient: TemporalToolClient = {
      listTools: async () => ({ tools: [] }),
      callTool: async () => ({}),
    };
    await expect(
      runOllamaConversation({
        temporalClient,
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 })),
        model: 'test',
        prompt: 'hello',
        conversationId: 'conversation',
        turnId: 'turn',
      }),
    ).rejects.toThrow('invalid chat response');
  });
});
