import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface HookCommand {
  type: string;
  command: string;
  timeout?: number;
}

interface HookGroup {
  matcher?: string;
  hooks: HookCommand[];
}

describe('Codex hook template', () => {
  it('registers only verified lifecycle events with bounded fail-open commands', () => {
    const template = JSON.parse(readFileSync(resolve('integrations/codex/hooks.json'), 'utf8')) as {
      hooks: Record<string, HookGroup[]>;
    };

    expect(Object.keys(template.hooks).sort()).toEqual(['SessionStart', 'Stop', 'UserPromptSubmit']);
    expect(template.hooks.SessionStart?.[0]?.matcher?.split('|').sort()).toEqual([
      'clear',
      'compact',
      'resume',
      'startup',
    ]);

    for (const groups of Object.values(template.hooks)) {
      for (const group of groups) {
        for (const hook of group.hooks) {
          expect(hook).toMatchObject({ type: 'command', command: 'temporalthread hook codex' });
          expect(hook.timeout).toBeGreaterThan(0);
          expect(hook.timeout).toBeLessThanOrEqual(10);
        }
      }
    }
    expect(JSON.stringify(template)).not.toContain('transcript_path');
  });
});
