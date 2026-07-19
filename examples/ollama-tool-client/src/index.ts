import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

type McpTool = {
  name: string;
  description?: string | undefined;
  inputSchema: Record<string, unknown>;
};

export interface TemporalToolClient {
  listTools(): Promise<{ tools: McpTool[] }>;
  callTool(input: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>;
}

type OllamaMessage = {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
};

type OllamaChatResponse = { message: OllamaMessage };

function isOllamaResponse(value: unknown): value is OllamaChatResponse {
  if (!value || typeof value !== 'object') return false;
  const message = (value as { message?: unknown }).message;
  return Boolean(
    message &&
      typeof message === 'object' &&
      (message as { role?: unknown }).role === 'assistant' &&
      typeof (message as { content?: unknown }).content === 'string',
  );
}

export async function runOllamaConversation(options: {
  temporalClient: TemporalToolClient;
  fetcher?: typeof fetch;
  endpoint?: string;
  model: string;
  prompt: string;
  conversationId: string;
  turnId: string;
}): Promise<string> {
  const fetcher = options.fetcher ?? fetch;
  const endpoint = options.endpoint ?? 'http://127.0.0.1:11434';
  const listed = await options.temporalClient.listTools();
  const tools = listed.tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.inputSchema,
    },
  }));
  const messages: OllamaMessage[] = [{ role: 'user', content: options.prompt }];
  const interactionBase = {
    agent: { name: 'Ollama tool client', platform: 'ollama' },
    project: { path: process.cwd() },
    sessionId: options.conversationId,
  };

  await options.temporalClient.callTool({
    name: 'record_interaction',
    arguments: {
      ...interactionBase,
      role: 'user',
      text: options.prompt,
      idempotencyKey: `ollama:${options.conversationId}:${options.turnId}:user`,
    },
  });

  for (let step = 0; step < 8; step += 1) {
    const response = await fetcher(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: options.model, messages, tools, stream: false }),
    });
    if (!response.ok) throw new Error(`Ollama chat request failed with HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!isOllamaResponse(payload)) throw new Error('Ollama returned an invalid chat response');
    messages.push(payload.message);
    const toolCalls = payload.message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      if (payload.message.content) {
        await options.temporalClient.callTool({
          name: 'record_interaction',
          arguments: {
            ...interactionBase,
            role: 'assistant',
            text: payload.message.content,
            idempotencyKey: `ollama:${options.conversationId}:${options.turnId}:assistant`,
          },
        });
      }
      return payload.message.content;
    }

    for (const toolCall of toolCalls) {
      const result = await options.temporalClient.callTool({
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      });
      messages.push({ role: 'tool', content: JSON.stringify(result) });
    }
  }
  throw new Error('Ollama exceeded the eight-step tool-call limit');
}

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(' ').trim();
  if (!prompt) throw new Error('Pass a prompt, for example: "How long has it been?"');
  const transport = new StdioClientTransport({
    command: 'temporalthread',
    args: ['start'],
    stderr: 'inherit',
  });
  const client = new Client({ name: 'temporalthread-ollama-example', version: '0.1.0' });
  await client.connect(transport);
  try {
    const response = await runOllamaConversation({
      temporalClient: client,
      model: process.env.OLLAMA_MODEL ?? 'qwen3',
      prompt,
      conversationId: process.env.OLLAMA_CONVERSATION_ID ?? randomUUID(),
      turnId: randomUUID(),
      ...(process.env.OLLAMA_HOST ? { endpoint: process.env.OLLAMA_HOST } : {}),
    });
    process.stdout.write(`${response}\n`);
  } finally {
    await client.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
