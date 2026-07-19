import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'temporalthread',
  args: ['start'],
  stderr: 'inherit',
});
const client = new Client({ name: 'temporalthread-basic-example', version: '0.1.0' });

await client.connect(transport);
try {
  const sessionId = `basic-example-${randomUUID()}`;
  const recorded = await client.callTool({
    name: 'record_interaction',
    arguments: {
      role: 'user',
      agent: { name: 'Basic MCP example', platform: 'generic' },
      project: { path: process.cwd() },
      sessionId,
      text: "Let's continue tomorrow.",
      idempotencyKey: `${sessionId}:user:1`,
    },
  });
  const context = await client.callTool({
    name: 'get_temporal_context',
    arguments: { sessionId, includeCommitments: true },
  });
  process.stdout.write(
    `${JSON.stringify({ recorded: recorded.structuredContent, context: context.structuredContent }, null, 2)}\n`,
  );
} finally {
  await client.close();
}
