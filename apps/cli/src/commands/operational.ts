import { existsSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { createRuntime } from '@temporalthread/mcp-server';
import type { InteractionRole } from '@temporalthread/shared-types';
import type { Command } from 'commander';
import { printJson, printLines } from '../output.js';

function withRuntime<T>(operation: (runtime: ReturnType<typeof createRuntime>) => T): T {
  const runtime = createRuntime();
  try {
    return operation(runtime);
  } finally {
    runtime.storage.close();
  }
}

export function registerTimelineCommand(program: Command): void {
  program
    .command('timeline')
    .description('List compact interaction metadata in reverse chronological order')
    .option('--agent <name>', 'agent name')
    .option('--platform <platform>', 'agent platform')
    .option('--project <path>', 'project path')
    .option('--session <id>', 'internal or external session ID')
    .option('--role <role>', 'user, assistant, system, or tool')
    .option('--limit <number>', 'maximum rows', '50')
    .option('--json', 'print machine-readable output')
    .action((options: Record<string, string | boolean | undefined>) => {
      const timeline = withRuntime((runtime) =>
        runtime.service.listTimeline({
          ...(options.agent
            ? {
                agent: {
                  name: String(options.agent),
                  ...(options.platform ? { platform: String(options.platform) } : {}),
                },
              }
            : {}),
          ...(options.project ? { project: { path: String(options.project) } } : {}),
          ...(options.session ? { sessionId: String(options.session) } : {}),
          ...(options.role ? { role: String(options.role) as InteractionRole } : {}),
          limit: Number(options.limit),
        }),
      );
      if (options.json) printJson({ timeline });
      else {
        printLines(
          timeline.length
            ? timeline.map(
                (item) =>
                  `${item.timestamp}  ${item.role.padEnd(9)} ${item.agent.name}  ${item.project?.name ?? '(no project)'}`,
              )
            : ['No matching interactions.'],
        );
      }
    });
}

export function registerCommitmentsCommand(program: Command): void {
  program
    .command('commitments')
    .description('List commitments and their current display status')
    .option('--status <status>', 'pending, due, overdue, completed, or cancelled')
    .option('--project <path>', 'project path')
    .option('--limit <number>', 'maximum rows', '100')
    .option('--json', 'print machine-readable output')
    .action((options: Record<string, string | boolean | undefined>) => {
      const result = withRuntime((runtime) =>
        runtime.service.listCommitments({
          ...(options.status ? { status: String(options.status) } : {}),
          ...(options.project ? { project: { path: String(options.project) } } : {}),
          limit: Number(options.limit),
        }),
      );
      if (options.json) printJson(result);
      else {
        printLines(
          result.commitments.length
            ? result.commitments.map(
                (item) =>
                  `${item.displayStatus.padEnd(10)} ${item.title}${
                    item.overdueCalendarDays === null
                      ? ''
                      : ` (${item.overdueCalendarDays} calendar day(s) overdue)`
                  }`,
              )
            : ['No matching commitments.'],
        );
      }
    });
}

export function registerExportCommand(program: Command): void {
  program
    .command('export')
    .description('Export all locally persisted, privacy-permitted data as JSON')
    .option('-o, --output <path>', 'write to a file instead of stdout')
    .option('--force', 'replace an existing export file')
    .action((options: { output?: string; force?: boolean }) => {
      const exported = withRuntime((runtime) => runtime.service.exportData());
      const content = `${JSON.stringify(exported, null, 2)}\n`;
      if (!options.output) {
        process.stdout.write(content);
        return;
      }
      if (existsSync(options.output) && !options.force) {
        throw new Error('Export file already exists; pass --force to replace it');
      }
      writeFileSync(options.output, content, {
        encoding: 'utf8',
        mode: 0o600,
        flag: options.force ? 'w' : 'wx',
      });
      printLines([`Exported TemporalThread data to ${options.output}`]);
    });
}

async function confirmPurge(): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question('Delete all TemporalThread domain data? Type "purge" to confirm: ');
    return answer.trim().toLowerCase() === 'purge';
  } finally {
    prompt.close();
  }
}

export function registerPurgeCommand(program: Command): void {
  program
    .command('purge')
    .description('Delete all interactions, references, commitments, sessions, agents, and projects')
    .option('-y, --yes', 'confirm non-interactively')
    .option('--json', 'print machine-readable output')
    .action(async (options: { yes?: boolean; json?: boolean }) => {
      if (!options.yes && !(await confirmPurge())) {
        throw new Error('Purge cancelled; pass --yes for non-interactive confirmation');
      }
      const result = withRuntime((runtime) => runtime.service.purgeData());
      if (options.json) printJson(result);
      else printLines([`Purged ${result.deleted.interactions} interaction(s).`]);
    });
}
