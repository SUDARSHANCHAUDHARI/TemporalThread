import { spawn } from 'node:child_process';
import type { Plugin } from '@opencode-ai/plugin';

type InteractionEvent = {
  eventType: 'interaction';
  role: 'user' | 'assistant';
  occurredAt: string;
  agent: { name: string; platform: string };
  project: { path: string };
  sessionId: string;
  text: string;
  idempotencyKey: string;
};

type TextLikePart = {
  type: string;
  text?: string;
  synthetic?: boolean;
  ignored?: boolean;
};

const INGEST_TIMEOUT_MS = 5_000;

export function joinedMessageText(parts: TextLikePart[]): string {
  return parts
    .filter(
      (part): part is TextLikePart & { text: string } =>
        part.type === 'text' && typeof part.text === 'string' && !part.synthetic && !part.ignored,
    )
    .map((part) => part.text)
    .join('\n')
    .trim();
}

export function openCodeInteraction(input: {
  role: 'user' | 'assistant';
  createdAtMilliseconds: number;
  directory: string;
  sessionId: string;
  messageId: string;
  text: string;
}): InteractionEvent {
  return {
    eventType: 'interaction',
    role: input.role,
    occurredAt: new Date(input.createdAtMilliseconds).toISOString(),
    agent: { name: 'OpenCode', platform: 'opencode' },
    project: { path: input.directory },
    sessionId: input.sessionId,
    text: input.text,
    idempotencyKey: `opencode:${input.sessionId}:${input.messageId}:${input.role}`,
  };
}

export async function ingestInteraction(event: InteractionEvent): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('temporalthread', ['ingest', '--json'], {
      stdio: ['pipe', 'ignore', 'pipe'],
      shell: false,
    });
    const errorChunks: Buffer[] = [];
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(new Error('TemporalThread ingestion timed out'));
    }, INGEST_TIMEOUT_MS);

    child.stderr.on('data', (chunk: Buffer | string) => {
      if (errorChunks.reduce((total, item) => total + item.length, 0) < 8_192) {
        errorChunks.push(Buffer.from(chunk));
      }
    });
    child.once('error', (error) => finish(error));
    child.once('close', (code) => {
      if (code === 0) finish();
      else {
        const detail = Buffer.concat(errorChunks).toString('utf8').trim();
        finish(new Error(detail || `TemporalThread ingestion exited with code ${String(code)}`));
      }
    });
    child.stdin.end(JSON.stringify(event));
  });
}

export const TemporalThreadPlugin: Plugin = async ({ client, directory }) => {
  async function reportFailure(): Promise<void> {
    await client.app.log({
      body: {
        service: 'temporalthread',
        level: 'warn',
        message: 'TemporalThread could not capture a completed interaction',
      },
      query: { directory },
    });
  }

  return {
    'chat.message': async (input, output) => {
      const text = joinedMessageText(output.parts);
      if (!text) return;
      try {
        await ingestInteraction(
          openCodeInteraction({
            role: 'user',
            createdAtMilliseconds: output.message.time.created,
            directory,
            sessionId: input.sessionID,
            messageId: output.message.id,
            text,
          }),
        );
      } catch {
        await reportFailure();
      }
    },
    event: async ({ event }) => {
      if (event.type !== 'message.updated') return;
      const info = event.properties.info;
      if (info.role !== 'assistant' || !info.time.completed) return;
      try {
        const response = await client.session.message({
          path: { id: info.sessionID, messageID: info.id },
          query: { directory },
        });
        if (!response.data) throw new Error('Completed message was unavailable');
        const text = joinedMessageText(response.data.parts);
        if (!text) return;
        await ingestInteraction(
          openCodeInteraction({
            role: 'assistant',
            createdAtMilliseconds: info.time.completed,
            directory,
            sessionId: info.sessionID,
            messageId: info.id,
            text,
          }),
        );
      } catch {
        await reportFailure();
      }
    },
  };
};

export default TemporalThreadPlugin;
