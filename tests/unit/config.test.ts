import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createDefaultConfig,
  loadConfig,
  resolveTemporalThreadPaths,
  writeConfig,
} from '@temporalthread/config';
import { describe, expect, it } from 'vitest';

describe('configuration', () => {
  it('defaults to temporal references only in an isolated home', () => {
    const root = mkdtempSync(join(tmpdir(), 'temporalthread-config-'));
    const paths = resolveTemporalThreadPaths({ TEMPORALTHREAD_HOME: root }, 'linux', root);
    const config = createDefaultConfig(paths, { TEMPORALTHREAD_TIMEZONE: 'Asia/Bangkok' });

    expect(config.privacyMode).toBe('temporal-references-only');
    expect(config.sessionInactivityThresholdMinutes).toBe(30);
    expect(config.databasePath).toBe(join(root, 'temporalthread.sqlite'));
  });

  it('writes atomically and backs up an existing config', () => {
    const root = mkdtempSync(join(tmpdir(), 'temporalthread-config-'));
    const paths = resolveTemporalThreadPaths({ TEMPORALTHREAD_HOME: root }, 'darwin', root);
    const config = createDefaultConfig(paths, { TEMPORALTHREAD_TIMEZONE: 'UTC' });

    expect(writeConfig(config, paths).created).toBe(true);
    const changed = { ...config, locale: 'en-GB' };
    const result = writeConfig(changed, paths);

    expect(result.backupPath).not.toBeNull();
    expect(JSON.parse(readFileSync(paths.configPath, 'utf8')).locale).toBe('en-GB');
    expect(loadConfig(paths, {}).locale).toBe('en-GB');
  });

  it('applies validated environment overrides without changing the file', () => {
    const root = mkdtempSync(join(tmpdir(), 'temporalthread-config-'));
    const paths = resolveTemporalThreadPaths({ TEMPORALTHREAD_HOME: root }, 'linux', root);
    writeConfig(createDefaultConfig(paths, { TEMPORALTHREAD_TIMEZONE: 'UTC' }), paths);

    const config = loadConfig(paths, {
      TEMPORALTHREAD_TIMEZONE: 'Asia/Bangkok',
      TEMPORALTHREAD_PRIVACY_MODE: 'metadata-only',
      TEMPORALTHREAD_MAX_TEXT_BYTES: '4096',
    });

    expect(config.timezone).toBe('Asia/Bangkok');
    expect(config.privacyMode).toBe('metadata-only');
    expect(config.maxTextBytes).toBe(4096);
  });

  it('rejects an invalid timezone', () => {
    const root = mkdtempSync(join(tmpdir(), 'temporalthread-config-'));
    const paths = resolveTemporalThreadPaths({ TEMPORALTHREAD_HOME: root }, 'linux', root);
    const config = createDefaultConfig(paths, { TEMPORALTHREAD_TIMEZONE: 'UTC' });

    expect(() => writeConfig({ ...config, timezone: 'Mars/Olympus' }, paths)).toThrow(
      'Invalid IANA timezone',
    );
  });
});
