import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Integration, TemporalThreadPaths } from '@sudarshanchaudhari/temporalthread-config';

interface GeneratedFile {
  path: string;
  created: boolean;
}

const examples: Record<Integration, Record<string, string>> = {
  generic: {
    'generic-event.json': `${JSON.stringify(
      {
        eventType: 'interaction',
        role: 'user',
        occurredAt: '2026-01-15T09:00:00Z',
        timezone: 'UTC',
        agent: { name: 'My agent', platform: 'generic' },
        sessionId: 'replace-with-session-id',
        text: 'Continue tomorrow.',
        idempotencyKey: 'replace-with-unique-event-id',
      },
      null,
      2,
    )}\n`,
  },
  codex: {
    'codex-mcp.toml': `[mcp_servers.temporal-thread]\ncommand = "temporalthread"\nargs = ["start"]\n`,
  },
  'claude-code': {
    'claude-code-mcp.json': `${JSON.stringify(
      {
        mcpServers: {
          'temporal-thread': { type: 'stdio', command: 'temporalthread', args: ['start'] },
        },
      },
      null,
      2,
    )}\n`,
  },
  opencode: {
    'opencode-mcp.json': `${JSON.stringify(
      {
        mcp: {
          'temporal-thread': {
            type: 'local',
            command: ['temporalthread', 'start'],
            enabled: true,
          },
        },
      },
      null,
      2,
    )}\n`,
  },
  ollama: {
    'ollama-runtime-note.txt':
      'Ollama is a model runtime. Use the TemporalThread Ollama bridge example; Ollama itself is not an MCP host.\n',
  },
};

export function generateIntegrationExamples(
  paths: TemporalThreadPaths,
  integrations: Integration[],
): GeneratedFile[] {
  mkdirSync(paths.integrationExamplesDir, { recursive: true, mode: 0o700 });
  const generated: GeneratedFile[] = [];
  for (const integration of integrations) {
    for (const [name, content] of Object.entries(examples[integration])) {
      const path = join(paths.integrationExamplesDir, name);
      const created = !existsSync(path);
      if (created) writeFileSync(path, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      generated.push({ path, created });
    }
  }
  return generated;
}

export function expectedIntegrationExample(integration: Integration): string {
  return Object.keys(examples[integration])[0] as string;
}
