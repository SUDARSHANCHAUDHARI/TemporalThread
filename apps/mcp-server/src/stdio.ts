import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRuntime, type TemporalThreadRuntime } from './runtime.js';
import { createMcpServer } from './server.js';

export interface RunningStdioServer extends TemporalThreadRuntime {
  server: McpServer;
  close(): Promise<void>;
}

export async function startStdioServer(
  runtime: TemporalThreadRuntime = createRuntime(),
): Promise<RunningStdioServer> {
  const server = createMcpServer(runtime.service);
  server.server.onclose = () => runtime.storage.close();
  await server.connect(new StdioServerTransport());
  return {
    ...runtime,
    server,
    close: () => server.close(),
  };
}
