import { resolve } from 'node:path';
import type { TemporalThreadConfig } from '@temporalthread/config';
import { FakeClock, TemporalThreadService } from '@temporalthread/core';
import { SqliteStorage } from '@temporalthread/storage-sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleHostHook } from '../../apps/cli/src/hook-adapter.js';

const config: TemporalThreadConfig = {
  databasePath: ':memory:',
  timezone: 'Asia/Bangkok',
  locale: 'en-US',
  privacyMode: 'temporal-references-only',
  sessionInactivityThresholdMinutes: 30,
  temporalContextRefreshThresholdMinutes: 30,
  maxTextBytes: 100_000,
  enabledIntegrations: ['codex', 'claude-code'],
  logLevel: 'silent',
};

describe('documented Codex and Claude Code hook adapters', () => {
  let storage: SqliteStorage;
  let clock: FakeClock;
  let service: TemporalThreadService;
  const cwd = resolve('fixtures/hook-project');

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    clock = new FakeClock('2026-07-15T13:00:00Z');
    service = new TemporalThreadService({ storage, config, clock });
  });

  afterEach(() => storage.close());

  it('records Codex prompt/stop fields, deduplicates a repeated turn, and injects compact context', () => {
    const common = { session_id: 'codex-session', cwd, permission_mode: 'default' };
    const start = handleHostHook({
      host: 'codex',
      service,
      config,
      input: { ...common, hook_event_name: 'SessionStart', source: 'startup' },
    });
    expect(start).toMatchObject({
      hookSpecificOutput: { hookEventName: 'SessionStart' },
    });
    expect(JSON.stringify(start)).not.toContain('rawText');

    const promptInput = {
      ...common,
      hook_event_name: 'UserPromptSubmit',
      turn_id: 'turn-1',
      prompt: "Let's continue tomorrow.",
    };
    const promptOutput = handleHostHook({ host: 'codex', service, config, input: promptInput });
    handleHostHook({ host: 'codex', service, config, input: promptInput });
    expect(promptOutput).toMatchObject({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit' },
    });
    expect(storage.tableCounts().interactions).toBe(1);
    expect(storage.tableCounts().temporalReferences).toBe(1);

    clock.advance({ minutes: 1 });
    handleHostHook({
      host: 'codex',
      service,
      config,
      input: {
        ...common,
        hook_event_name: 'Stop',
        turn_id: 'turn-1',
        stop_hook_active: false,
        last_assistant_message: 'I will be ready.',
      },
    });
    clock.advance({ days: 4 });
    const resumed = handleHostHook({
      host: 'codex',
      service,
      config,
      input: { ...common, hook_event_name: 'SessionStart', source: 'resume' },
    });
    const context = JSON.stringify(resumed);
    expect(context).toContain('resumedSession');
    expect(context).toContain('4 days');
    expect(storage.listInteractions()).toHaveLength(2);
    expect(storage.listInteractions().every((item) => item.interaction.rawText === null)).toBe(true);
  });

  it('uses Claude Code prompt and last-assistant-message fields without transcript parsing', () => {
    const common = {
      session_id: 'claude-session',
      cwd,
      permission_mode: 'default',
      transcript_path: resolve('fixtures/transcript-is-not-read.jsonl'),
    };
    handleHostHook({
      host: 'claude-code',
      service,
      config,
      input: {
        ...common,
        hook_event_name: 'UserPromptSubmit',
        prompt: 'How long has it been since last time?',
      },
    });
    handleHostHook({
      host: 'claude-code',
      service,
      config,
      input: {
        ...common,
        hook_event_name: 'Stop',
        stop_hook_active: false,
        last_assistant_message: 'Here is the answer.',
      },
    });

    const interactions = storage.listInteractions({}, 10);
    expect(interactions.map((item) => item.interaction.role).sort()).toEqual(['assistant', 'user']);
    expect(interactions.every((item) => item.agent.platform === 'claude-code')).toBe(true);
    expect(interactions.every((item) => item.session.externalSessionId === 'claude-session')).toBe(true);
  });

  it('rejects unsupported events without serializing private fields', () => {
    expect(() =>
      handleHostHook({
        host: 'codex',
        service,
        config,
        input: {
          session_id: 'session',
          cwd,
          hook_event_name: 'PreToolUse',
          tool_input: { command: 'private command' },
        },
      }),
    ).toThrow('Unsupported hook event: PreToolUse');
  });
});
