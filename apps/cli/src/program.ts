import { startStdioServer } from '@temporalthread/mcp-server';
import { Command } from 'commander';
import { registerConfigCommand } from './commands/config.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerHookCommand } from './commands/hook.js';
import { registerIngestCommand } from './commands/ingest.js';
import { registerInitCommand } from './commands/init.js';
import {
  registerCommitmentsCommand,
  registerExportCommand,
  registerPurgeCommand,
  registerTimelineCommand,
} from './commands/operational.js';
import { registerStatusCommand } from './commands/status.js';

export function createProgram(): Command {
  const program = new Command()
    .name('temporalthread')
    .description('Give AI agents a persistent sense of time.')
    .version('0.1.0')
    .showHelpAfterError();

  registerInitCommand(program);
  program
    .command('start')
    .description('Start the local TemporalThread MCP server over stdio')
    .action(async () => {
      await startStdioServer();
    });
  registerDoctorCommand(program);
  registerStatusCommand(program);
  registerConfigCommand(program);
  registerTimelineCommand(program);
  registerCommitmentsCommand(program);
  registerExportCommand(program);
  registerPurgeCommand(program);
  registerIngestCommand(program);
  registerHookCommand(program);
  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}
