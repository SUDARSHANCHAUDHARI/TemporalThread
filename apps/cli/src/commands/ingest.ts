import { readFileSync, statSync } from 'node:fs';
import { createRuntime } from '@temporalthread/mcp-server';
import { type GenericEvent, GenericEventSchema } from '@temporalthread/shared-types';
import type { Command } from 'commander';
import { printJson, printLines } from '../output.js';

const MAX_INGEST_BYTES = 10 * 1_024 * 1_024;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    bytes += buffer.length;
    if (bytes > MAX_INGEST_BYTES) throw new Error('Ingestion input exceeds the 10 MiB limit');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseEvents(content: string): GenericEvent[] {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Ingestion input is empty');
  try {
    const document = JSON.parse(trimmed) as unknown;
    const items = Array.isArray(document) ? document : [document];
    return items.map((item, index) => {
      const parsed = GenericEventSchema.safeParse(item);
      if (!parsed.success) throw new Error(`Invalid event at index ${index}`);
      return parsed.data;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid event')) throw error;
  }

  return trimmed.split(/\r?\n/).map((line, index) => {
    try {
      const parsed = GenericEventSchema.safeParse(JSON.parse(line) as unknown);
      if (!parsed.success) throw new Error('invalid');
      return parsed.data;
    } catch {
      throw new Error(`Invalid JSONL event at line ${index + 1}`);
    }
  });
}

export function registerIngestCommand(program: Command): void {
  program
    .command('ingest')
    .description('Ingest one JSON event, a JSON array, or JSONL through the generic adapter')
    .option('-f, --file <path>', 'read events from a file instead of stdin')
    .option('--json', 'print machine-readable output')
    .action(async (options: { file?: string; json?: boolean }) => {
      let content: string;
      if (options.file) {
        if (statSync(options.file).size > MAX_INGEST_BYTES) {
          throw new Error('Ingestion file exceeds the 10 MiB limit');
        }
        content = readFileSync(options.file, 'utf8');
      } else {
        if (process.stdin.isTTY) throw new Error('Provide --file or pipe JSON/JSONL to stdin');
        content = await readStdin();
      }
      const events = parseEvents(content);
      const runtime = createRuntime();
      try {
        const recorded = events.map(({ eventType: _eventType, ...event }) =>
          runtime.service.recordInteraction(event),
        );
        const result = { ingested: recorded.length, interactions: recorded };
        if (options.json) printJson(result);
        else printLines([`Ingested ${recorded.length} interaction event(s).`]);
      } finally {
        runtime.storage.close();
      }
    });
}
