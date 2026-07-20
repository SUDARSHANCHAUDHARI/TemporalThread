import { z } from 'zod';

export const TEMPORALTHREAD_CODEX_HOOK_COMMAND = 'temporalthread hook codex';

const HookCommandSchema = z
  .object({
    type: z.literal('command'),
    command: z.string().trim().min(1).max(4096),
  })
  .passthrough();

const HookGroupSchema = z
  .object({
    matcher: z.string().max(4096).optional(),
    hooks: z.array(HookCommandSchema).min(1),
  })
  .passthrough();

const HooksDocumentSchema = z
  .object({
    hooks: z.record(z.string().min(1).max(128), z.array(HookGroupSchema)),
  })
  .passthrough();

type HooksDocument = z.infer<typeof HooksDocumentSchema>;
type HookGroup = z.infer<typeof HookGroupSchema>;

export class CodexHooksError extends Error {
  readonly code = 'malformed-hooks';

  constructor(message = 'Codex hooks.json is malformed') {
    super(message);
    this.name = 'CodexHooksError';
  }
}

export interface CodexHooksInspection {
  valid: boolean;
  installed: boolean;
  duplicateGroups: number;
  errorCode?: 'malformed-hooks';
}

function parseHooks(content: string): HooksDocument {
  try {
    const parsed = JSON.parse(content) as unknown;
    return HooksDocumentSchema.parse(parsed);
  } catch {
    throw new CodexHooksError();
  }
}

function isTemporalThreadGroup(group: HookGroup): boolean {
  return (
    group.hooks.length > 0 &&
    group.hooks.every((hook) => hook.type === 'command' && hook.command === TEMPORALTHREAD_CODEX_HOOK_COMMAND)
  );
}

function desiredHooks(content: string): HooksDocument {
  const document = parseHooks(content);
  const events = Object.keys(document.hooks).sort();
  if (events.join(',') !== 'SessionStart,Stop,UserPromptSubmit') {
    throw new CodexHooksError('TemporalThread hook template contains unsupported events');
  }
  for (const groups of Object.values(document.hooks)) {
    if (groups.length !== 1 || !groups.every(isTemporalThreadGroup)) {
      throw new CodexHooksError('TemporalThread hook template is invalid');
    }
  }
  return document;
}

export function inspectCodexHooks(content: string, desiredContent?: string): CodexHooksInspection {
  try {
    const document = parseHooks(content);
    const desired = desiredContent ? desiredHooks(desiredContent) : null;
    let installedEvents = 0;
    let duplicateGroups = 0;
    for (const [event, groups] of Object.entries(document.hooks)) {
      const owned = groups.filter(isTemporalThreadGroup).length;
      if (owned > 0 && (!desired || event in desired.hooks)) installedEvents += 1;
      if (owned > 1) duplicateGroups += owned - 1;
    }
    return {
      valid: true,
      installed: desired ? installedEvents === Object.keys(desired.hooks).length : installedEvents > 0,
      duplicateGroups,
    };
  } catch {
    return { valid: false, installed: false, duplicateGroups: 0, errorCode: 'malformed-hooks' };
  }
}

export function mergeCodexHooks(
  content: string,
  desiredContent: string,
): {
  content: string;
  change: 'created' | 'updated' | 'unchanged';
} {
  const desired = desiredHooks(desiredContent);
  const existing = content.trim() ? parseHooks(content) : ({ hooks: {} } as HooksDocument);
  let changed = !content.trim();
  for (const [event, desiredGroups] of Object.entries(desired.hooks)) {
    const current = existing.hooks[event] ?? [];
    const unrelated = current.filter((group) => !isTemporalThreadGroup(group));
    const next = [...unrelated, ...(desiredGroups as HookGroup[])];
    if (JSON.stringify(current) !== JSON.stringify(next)) changed = true;
    existing.hooks[event] = next;
  }
  const updated = `${JSON.stringify(existing, null, 2)}\n`;
  return {
    content: changed ? updated : content,
    change: changed ? (content.trim() ? 'updated' : 'created') : 'unchanged',
  };
}

export function removeCodexHooks(content: string): {
  content: string;
  change: 'removed' | 'unchanged';
} {
  const existing = parseHooks(content);
  let changed = false;
  for (const [event, groups] of Object.entries(existing.hooks)) {
    const remaining = groups.filter((group) => !isTemporalThreadGroup(group));
    if (remaining.length === groups.length) continue;
    changed = true;
    if (remaining.length > 0) existing.hooks[event] = remaining;
    else delete existing.hooks[event];
  }
  return {
    content: changed ? `${JSON.stringify(existing, null, 2)}\n` : content,
    change: changed ? 'removed' : 'unchanged',
  };
}
