import { describe, expect, it } from 'vitest';
import {
  CodexInstallationManifestSchema,
  compareSemanticVersions,
  resolveCodexIntegrationPaths,
} from '../../integrations/codex/src/index.js';

describe('Codex integration contracts', () => {
  it('resolves official user and project locations without using the real home directory', () => {
    expect(
      resolveCodexIntegrationPaths({
        scope: 'user',
        userHome: '/tmp/Temporal User',
        projectRoot: '/tmp/project',
        platform: 'linux',
      }),
    ).toMatchObject({
      scopeRoot: '/tmp/Temporal User',
      configPath: '/tmp/Temporal User/.codex/config.toml',
      hooksPath: '/tmp/Temporal User/.codex/hooks.json',
      skillPath: '/tmp/Temporal User/.agents/skills/temporal-awareness/SKILL.md',
      manifestPath: '/tmp/Temporal User/.codex/temporalthread/integration-manifest.json',
    });

    expect(
      resolveCodexIntegrationPaths({
        scope: 'project',
        userHome: '/unused',
        projectRoot: '/tmp/Project Ω',
        platform: 'linux',
      }),
    ).toMatchObject({
      scopeRoot: '/tmp/Project Ω',
      configPath: '/tmp/Project Ω/.codex/config.toml',
      hooksPath: '/tmp/Project Ω/.codex/hooks.json',
      skillPath: '/tmp/Project Ω/.agents/skills/temporal-awareness/SKILL.md',
      manifestPath: '/tmp/Project Ω/.codex/temporalthread.integration.json',
    });
  });

  it('uses Windows path semantics for Windows fixtures', () => {
    expect(
      resolveCodexIntegrationPaths({
        scope: 'user',
        userHome: 'C:\\Users\\Temporal User',
        projectRoot: 'D:\\Code\\TemporalThread',
        platform: 'win32',
      }).skillPath,
    ).toBe('C:\\Users\\Temporal User\\.agents\\skills\\temporal-awareness\\SKILL.md');
  });

  it('validates a content-free versioned ownership manifest and rejects unknown fields', () => {
    const manifest = {
      schemaVersion: 1,
      temporalThreadVersion: '0.1.0',
      integrationVersion: '0.1.0',
      installedAt: '2026-07-20T00:00:00.000Z',
      scope: 'project',
      privacyMode: 'temporal-references-only',
      supportedSurface: 'codex-cli',
      installedComponents: ['mcp', 'skill', 'hooks'],
      managedFiles: ['/tmp/project/.codex/config.toml'],
      backupPaths: [],
      managedHashes: { skill: 'a'.repeat(64) },
    };
    expect(CodexInstallationManifestSchema.parse(manifest)).toEqual(manifest);
    expect(() =>
      CodexInstallationManifestSchema.parse({ ...manifest, prompt: "Let's continue tomorrow" }),
    ).toThrow();
  });

  it('compares semantic versions for upgrades and downgrade refusal', () => {
    expect(compareSemanticVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareSemanticVersions('1.3.0', '1.2.9')).toBe(1);
    expect(compareSemanticVersions('1.2.3', '2.0.0')).toBe(-1);
    expect(() => compareSemanticVersions('latest', '1.0.0')).toThrow('Invalid semantic version');
  });
});
