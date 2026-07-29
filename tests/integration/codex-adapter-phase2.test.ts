import { resolve } from 'node:path';
import type { TemporalThreadConfig } from '@sudarshanchaudhari/temporalthread-config';
import { FakeClock, TemporalThreadService } from '@sudarshanchaudhari/temporalthread-core';
import { SqliteStorage } from '@sudarshanchaudhari/temporalthread-storage-sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  handleCodexHook,
  MAX_CODEX_HOOK_INPUT_BYTES,
  parseCodexHookInput,
} from '../../integrations/codex/src/index.js';

const baseConfig: TemporalThreadConfig = {
  databasePath: ':memory:',
  timezone: 'Asia/Bangkok',
  locale: 'en-US',
  privacyMode: 'temporal-references-only',
  sessionInactivityThresholdMinutes: 30,
  temporalContextRefreshThresholdMinutes: 30,
  maxTextBytes: 100_000,
  enabledIntegrations: ['codex'],
  logLevel: 'silent',
};

describe('Phase 2 Codex adapter boundary', () => {
  let storage: SqliteStorage;
  let clock: FakeClock;
  let service: TemporalThreadService;
  const projectPath = resolve('fixtures/Temporal Project Ω');

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    clock = new FakeClock('2026-07-15T13:00:00Z');
    service = new TemporalThreadService({ storage, config: baseConfig, clock });
  });

  afterEach(() => storage.close());

  it('parses only bounded JSON objects without exposing rejected input', () => {
    expect(parseCodexHookInput('{"hook_event_name":"Stop"}')).toEqual({
      ok: true,
      value: { hook_event_name: 'Stop' },
    });
    expect(parseCodexHookInput('private prompt, not json')).toEqual({
      ok: false,
      errorCode: 'invalid-json',
    });
    expect(parseCodexHookInput('[]')).toEqual({ ok: false, errorCode: 'invalid-payload' });
    expect(parseCodexHookInput('x'.repeat(MAX_CODEX_HOOK_INPUT_BYTES + 1))).toEqual({
      ok: false,
      errorCode: 'oversized-payload',
    });
  });

  it('records duplicate documented prompt events once with privacy-filtered text', () => {
    const input = {
      session_id: 'codex-session',
      turn_id: 'turn-1',
      cwd: projectPath,
      hook_event_name: 'UserPromptSubmit',
      prompt: "Let's continue tomorrow.",
      permission_mode: 'default',
    };

    const first = handleCodexHook({ input, service, config: baseConfig, fallbackCwd: projectPath });
    const second = handleCodexHook({ input, service, config: baseConfig, fallbackCwd: projectPath });

    expect(first.status).toBe('processed');
    expect(second.status).toBe('processed');
    expect(storage.tableCounts().interactions).toBe(1);
    expect(storage.tableCounts().temporalReferences).toBe(1);
    expect(storage.listInteractions()[0]?.interaction.rawText).toBeNull();
    expect(JSON.stringify(first)).not.toContain("Let's continue tomorrow");
  });

  it('retrieves prior project context for a new Codex session without exposing internal values', () => {
    const recorded = service.recordInteraction({
      role: 'user',
      occurredAt: '2026-07-15T13:00:00Z',
      timezone: 'Asia/Bangkok',
      agent: { name: 'Codex', platform: 'codex' },
      project: { path: projectPath, name: 'TemporalThread' },
      sessionId: 'old-session',
      text: "Let's continue tomorrow.",
      idempotencyKey: 'fixture:interaction',
    });
    const commitment = service.recordCommitment({
      title: 'Continue TemporalThread',
      originalExpression: 'tomorrow',
      anchorTime: '2026-07-15T13:00:00Z',
      timezone: 'Asia/Bangkok',
      project: { path: projectPath },
      sessionId: 'old-session',
      sourceInteractionId: recorded.interactionId,
    });
    clock.set('2026-07-19T16:00:00Z');

    const result = handleCodexHook({
      input: {
        session_id: 'new-session',
        cwd: projectPath,
        hook_event_name: 'SessionStart',
        source: 'resume',
      },
      service,
      config: baseConfig,
      fallbackCwd: projectPath,
    });
    const visible = JSON.stringify(result.output);

    expect(result.status).toBe('processed');
    expect(visible).toContain('4 days, 3 hours');
    expect(visible).toContain('Continue TemporalThread');
    expect(visible).toContain('overdue');
    expect(visible).not.toContain(recorded.interactionId);
    expect(visible).not.toContain(commitment.commitment.id);
    expect(visible).not.toContain('old-session');
    expect(visible).not.toContain(projectPath);
    expect(Buffer.byteLength(visible, 'utf8')).toBeLessThanOrEqual(8_192);
  });

  it('uses the process working directory and a synthetic session when payload identity is incomplete', () => {
    const result = handleCodexHook({
      input: {
        hook_event_name: 'UserPromptSubmit',
        turn_id: 'turn-without-session',
        prompt: "I'm back.",
      },
      service,
      config: baseConfig,
      fallbackCwd: projectPath,
    });

    expect(result.status).toBe('processed');
    const stored = storage.listInteractions()[0];
    expect(stored?.project?.normalizedPath).toBe(projectPath);
    expect(stored?.session.generatedSession).toBe(true);
  });

  it('deduplicates retried session-start events delivered within the same event minute', () => {
    const input = {
      session_id: 'retried-start',
      cwd: projectPath,
      hook_event_name: 'SessionStart',
      source: 'startup',
    };
    handleCodexHook({ input, service, config: baseConfig, fallbackCwd: projectPath });
    clock.advance({ seconds: 30 });
    handleCodexHook({ input, service, config: baseConfig, fallbackCwd: projectPath });

    expect(storage.tableCounts().interactions).toBe(1);
  });

  it('closes duplicate stop events without requiring an assistant message and reopens on resume', () => {
    handleCodexHook({
      input: {
        session_id: 'stop-lifecycle',
        turn_id: 'prompt-before-stop',
        cwd: projectPath,
        hook_event_name: 'UserPromptSubmit',
        prompt: 'Pause here.',
      },
      service,
      config: baseConfig,
      fallbackCwd: projectPath,
    });
    clock.set('2026-07-15T13:05:00Z');
    const stopInput = {
      session_id: 'stop-lifecycle',
      turn_id: 'completed-turn',
      cwd: projectPath,
      hook_event_name: 'Stop',
      last_assistant_message: null,
    } as const;

    const first = handleCodexHook({
      input: stopInput,
      service,
      config: baseConfig,
      fallbackCwd: projectPath,
    });
    const second = handleCodexHook({
      input: stopInput,
      service,
      config: baseConfig,
      fallbackCwd: projectPath,
    });
    const endedSession = storage.findSessionsByExternalId('stop-lifecycle')[0];

    expect(first).toEqual({ output: {}, status: 'processed', recorded: false });
    expect(second).toEqual(first);
    expect(endedSession?.endedAt).toBe('2026-07-15T13:05:00Z');
    expect(storage.tableCounts().interactions).toBe(1);

    clock.set('2026-07-15T13:06:00Z');
    handleCodexHook({
      input: {
        session_id: 'stop-lifecycle',
        turn_id: 'prompt-after-stop',
        cwd: projectPath,
        hook_event_name: 'UserPromptSubmit',
        prompt: 'Resume now.',
      },
      service,
      config: baseConfig,
      fallbackCwd: projectPath,
    });
    expect(storage.getSession(endedSession?.id ?? '')?.endedAt).toBeNull();
  });

  it.each([
    ['metadata-only', 0, null],
    ['temporal-references-only', 1, null],
    ['full-local-history', 1, 'Continue tomorrow.'],
  ] as const)('honors %s during automatic prompt ingestion', (privacyMode, referenceCount, rawText) => {
    const config = { ...baseConfig, privacyMode };
    const privateStorage = new SqliteStorage(':memory:');
    const privateService = new TemporalThreadService({ storage: privateStorage, config, clock });
    try {
      handleCodexHook({
        input: {
          session_id: `session-${privacyMode}`,
          turn_id: `turn-${privacyMode}`,
          cwd: projectPath,
          hook_event_name: 'UserPromptSubmit',
          prompt: 'Continue tomorrow.',
        },
        service: privateService,
        config,
        fallbackCwd: projectPath,
      });
      expect(privateStorage.tableCounts().temporalReferences).toBe(referenceCount);
      expect(privateStorage.listInteractions()[0]?.interaction.rawText).toBe(rawText);
    } finally {
      privateStorage.close();
    }
  });

  it('never creates commitments automatically from real, quoted, negated, or code-like prompts', () => {
    const prompts = [
      "Let's continue tomorrow.",
      "Write a test for the sentence 'Let's continue tomorrow.'",
      'We are not continuing tomorrow.',
      'const example = "next Friday";',
    ];
    for (const [index, prompt] of prompts.entries()) {
      handleCodexHook({
        input: {
          session_id: 'commitment-safety',
          turn_id: `turn-${index}`,
          cwd: projectPath,
          hook_event_name: 'UserPromptSubmit',
          prompt,
        },
        service,
        config: baseConfig,
        fallbackCwd: projectPath,
      });
    }
    expect(storage.tableCounts().commitments).toBe(0);
  });

  it('fails open for unknown events, invalid fields, and an unavailable database', () => {
    expect(
      handleCodexHook({
        input: { hook_event_name: 'PreToolUse', tool_input: { command: 'private' } },
        service,
        config: baseConfig,
        fallbackCwd: projectPath,
      }),
    ).toEqual({ output: {}, status: 'ignored', errorCode: 'unsupported-event', recorded: false });

    expect(
      handleCodexHook({
        input: { hook_event_name: 'UserPromptSubmit', prompt: 42 },
        service,
        config: baseConfig,
        fallbackCwd: projectPath,
      }),
    ).toEqual({ output: {}, status: 'failed', errorCode: 'invalid-payload', recorded: false });

    storage.close();
    const unavailable = handleCodexHook({
      input: {
        session_id: 'closed-database',
        turn_id: 'closed-turn',
        cwd: projectPath,
        hook_event_name: 'UserPromptSubmit',
        prompt: 'A private prompt must not appear in errors.',
      },
      service,
      config: baseConfig,
      fallbackCwd: projectPath,
    });
    expect(unavailable).toEqual({
      output: {},
      status: 'failed',
      errorCode: 'storage-unavailable',
      recorded: false,
    });
    expect(JSON.stringify(unavailable)).not.toContain('private prompt');

    storage = new SqliteStorage(':memory:');
  });
});
