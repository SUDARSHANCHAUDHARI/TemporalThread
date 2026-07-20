import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CodexInstallationManifestSchema,
  getCodexIntegrationStatus,
  inspectCodexMcpConfiguration,
  installCodexIntegration,
  resolveCodexIntegrationPaths,
  uninstallCodexIntegration,
} from '../../integrations/codex/src/index.js';

const temporaryRoots: string[] = [];
const installedAt = '2026-07-20T12:00:00.000Z';
const successfulProbe = async () => ({
  ok: true,
  toolNames: [
    'get_current_time',
    'record_interaction',
    'get_temporal_context',
    'get_last_interaction',
    'calculate_elapsed_time',
    'resolve_relative_time',
    'record_commitment',
    'list_commitments',
    'update_commitment',
  ],
  durationMs: 1,
});

function temporaryRoot(label = 'project'): string {
  const root = mkdtempSync(join(tmpdir(), `temporalthread-${label}-`));
  temporaryRoots.push(root);
  return root;
}

function projectOptions(projectRoot: string, overrides: Record<string, unknown> = {}) {
  return {
    scope: 'project' as const,
    projectRoot,
    privacyMode: 'temporal-references-only' as const,
    installedAt,
    probe: successfulProbe,
    ...overrides,
  };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Codex integration installer', () => {
  it('installs user and project scopes with a content-free ownership manifest', async () => {
    const projectRoot = temporaryRoot('Project Ω ');
    const project = await installCodexIntegration(projectOptions(projectRoot));
    const projectPaths = resolveCodexIntegrationPaths({ scope: 'project', projectRoot });

    expect(project).toMatchObject({
      action: 'installed',
      scope: 'project',
      components: ['mcp', 'skill', 'hooks'],
      requiresTrustReview: true,
      databasePreserved: true,
    });
    expect(inspectCodexMcpConfiguration(readFileSync(projectPaths.configPath, 'utf8'))).toMatchObject({
      valid: true,
      managed: true,
      matchesRecommended: true,
    });
    expect(readFileSync(projectPaths.skillPath, 'utf8')).toContain('name: temporal-awareness');
    expect(readFileSync(projectPaths.hooksPath, 'utf8')).toContain('temporalthread hook codex');
    const manifestText = readFileSync(projectPaths.manifestPath, 'utf8');
    const manifest = CodexInstallationManifestSchema.parse(JSON.parse(manifestText));
    expect(manifest).toMatchObject({
      integrationVersion: '0.1.0',
      scope: 'project',
      privacyMode: 'temporal-references-only',
      installedComponents: ['mcp', 'skill', 'hooks'],
    });
    expect(manifestText).not.toContain('prompt');
    expect(manifestText).not.toContain('conversation');

    const userHome = temporaryRoot('user');
    const user = await installCodexIntegration({
      ...projectOptions(projectRoot),
      scope: 'user',
      userHome,
    });
    expect(user.scope).toBe('user');
    expect(user.paths.configPath).toBe(join(userHome, '.codex', 'config.toml'));
  });

  it('makes no changes during dry-run while reporting paths and planned backups', async () => {
    const projectRoot = temporaryRoot('dry-run');
    const paths = resolveCodexIntegrationPaths({ scope: 'project', projectRoot });
    mkdirSync(dirname(paths.configPath), { recursive: true });
    writeFileSync(paths.configPath, 'model = "gpt-5"\n', 'utf8');

    const result = await installCodexIntegration(projectOptions(projectRoot, { dryRun: true }));

    expect(result.dryRun).toBe(true);
    expect(result.changed).toContain(paths.configPath);
    expect(result.backups).toHaveLength(1);
    expect(readFileSync(paths.configPath, 'utf8')).toBe('model = "gpt-5"\n');
    expect(existsSync(paths.skillPath)).toBe(false);
    expect(existsSync(paths.hooksPath)).toBe(false);
    expect(existsSync(paths.manifestPath)).toBe(false);
  });

  it('preserves unrelated TOML and hook groups and creates timestamped backups', async () => {
    const projectRoot = temporaryRoot('existing');
    const paths = resolveCodexIntegrationPaths({ scope: 'project', projectRoot });
    mkdirSync(dirname(paths.configPath), { recursive: true });
    writeFileSync(paths.configPath, '# keep\n[mcp_servers.docs]\ncommand = "docs"\nargs = []\n', 'utf8');
    writeFileSync(
      paths.hooksPath,
      `${JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'other' }] }] } })}\n`,
      'utf8',
    );

    const result = await installCodexIntegration(projectOptions(projectRoot));

    expect(readFileSync(paths.configPath, 'utf8')).toContain('[mcp_servers.docs]');
    expect(readFileSync(paths.hooksPath, 'utf8')).toContain('"command": "other"');
    expect(result.backups).toHaveLength(2);
    expect(result.backups.every((path) => existsSync(path))).toBe(true);
  });

  it('is idempotent when the same integration version and templates are already installed', async () => {
    const projectRoot = temporaryRoot('idempotent');
    await installCodexIntegration(projectOptions(projectRoot));

    const repeated = await installCodexIntegration(projectOptions(projectRoot));

    expect(repeated.action).toBe('unchanged');
    expect(repeated.changed).toEqual([]);
    expect(repeated.backups).toEqual([]);
  });

  it('refuses malformed or externally owned configuration before writing anything', async () => {
    const malformedRoot = temporaryRoot('malformed');
    const malformedPaths = resolveCodexIntegrationPaths({ scope: 'project', projectRoot: malformedRoot });
    mkdirSync(dirname(malformedPaths.configPath), { recursive: true });
    writeFileSync(malformedPaths.configPath, '[mcp_servers', 'utf8');

    await expect(installCodexIntegration(projectOptions(malformedRoot))).rejects.toMatchObject({
      code: 'malformed-config',
    });
    expect(existsSync(malformedPaths.skillPath)).toBe(false);

    const externalRoot = temporaryRoot('external');
    const externalPaths = resolveCodexIntegrationPaths({ scope: 'project', projectRoot: externalRoot });
    mkdirSync(dirname(externalPaths.configPath), { recursive: true });
    writeFileSync(
      externalPaths.configPath,
      '[mcp_servers.temporal-thread]\ncommand = "custom"\nargs = []\n',
      'utf8',
    );
    await expect(installCodexIntegration(projectOptions(externalRoot))).rejects.toMatchObject({
      code: 'ownership-uncertain',
    });
    expect(existsSync(externalPaths.skillPath)).toBe(false);
  });

  it('refuses malformed hooks before applying an otherwise valid installation plan', async () => {
    const projectRoot = temporaryRoot('malformed-hooks');
    const paths = resolveCodexIntegrationPaths({ scope: 'project', projectRoot });
    mkdirSync(dirname(paths.hooksPath), { recursive: true });
    writeFileSync(paths.hooksPath, '{"hooks":', 'utf8');

    await expect(installCodexIntegration(projectOptions(projectRoot))).rejects.toMatchObject({
      code: 'malformed-hooks',
    });
    expect(existsSync(paths.configPath)).toBe(false);
    expect(existsSync(paths.skillPath)).toBe(false);
    expect(readFileSync(paths.hooksPath, 'utf8')).toBe('{"hooks":');
  });

  it.each([
    ['without hooks', { includeHooks: false }, ['mcp', 'skill']],
    ['skill-only', { components: ['skill'] }, ['skill']],
    ['MCP-only', { components: ['mcp'] }, ['mcp']],
  ] as const)('supports %s installation', async (_label, overrides, components) => {
    const projectRoot = temporaryRoot('components');
    const result = await installCodexIntegration(projectOptions(projectRoot, overrides));
    const selected = components as readonly string[];

    expect(result.components).toEqual(components);
    expect(existsSync(result.paths.skillPath)).toBe(selected.includes('skill'));
    expect(existsSync(result.paths.hooksPath)).toBe(selected.includes('hooks'));
    expect(existsSync(result.paths.configPath)).toBe(selected.includes('mcp'));
  });

  it('upgrades managed files with backups and refuses a silent downgrade', async () => {
    const projectRoot = temporaryRoot('upgrade');
    const first = await installCodexIntegration(projectOptions(projectRoot, { integrationVersion: '1.0.0' }));
    writeFileSync(first.paths.skillPath, 'locally modified managed skill\n', 'utf8');

    const upgraded = await installCodexIntegration(
      projectOptions(projectRoot, { integrationVersion: '1.1.0', installedAt: '2026-07-21T00:00:00.000Z' }),
    );
    expect(upgraded.action).toBe('upgraded');
    expect(upgraded.backups.some((path) => path.startsWith(first.paths.skillPath))).toBe(true);
    expect(readFileSync(first.paths.skillPath, 'utf8')).toContain('name: temporal-awareness');

    const beforeDowngrade = readFileSync(first.paths.manifestPath, 'utf8');
    await expect(
      installCodexIntegration(projectOptions(projectRoot, { integrationVersion: '0.9.0' })),
    ).rejects.toMatchObject({ code: 'downgrade-refused' });
    expect(readFileSync(first.paths.manifestPath, 'utf8')).toBe(beforeDowngrade);
  });

  it('rolls back every managed file when post-write validation fails', async () => {
    const projectRoot = temporaryRoot('rollback');
    const paths = resolveCodexIntegrationPaths({ scope: 'project', projectRoot });
    mkdirSync(dirname(paths.configPath), { recursive: true });
    writeFileSync(paths.configPath, 'model = "gpt-5"\n', 'utf8');

    await expect(
      installCodexIntegration(
        projectOptions(projectRoot, {
          validateInstalledState: () => {
            throw new Error('simulated validation failure');
          },
        }),
      ),
    ).rejects.toThrow('Codex installation validation failed');
    expect(readFileSync(paths.configPath, 'utf8')).toBe('model = "gpt-5"\n');
    expect(existsSync(paths.skillPath)).toBe(false);
    expect(existsSync(paths.hooksPath)).toBe(false);
    expect(existsSync(paths.manifestPath)).toBe(false);
  });

  it('uninstalls only owned content, preserves the database, and is idempotent', async () => {
    const projectRoot = temporaryRoot('uninstall');
    const installed = await installCodexIntegration(projectOptions(projectRoot));
    const databasePath = join(projectRoot, 'temporalthread.sqlite');
    writeFileSync(databasePath, 'database sentinel', 'utf8');
    const configBefore = readFileSync(installed.paths.configPath, 'utf8');
    writeFileSync(installed.paths.configPath, `model = "gpt-5"\n${configBefore}`, 'utf8');

    const removed = await uninstallCodexIntegration({
      scope: 'project',
      projectRoot,
      installedAt: '2026-07-22T00:00:00.000Z',
    });
    expect(removed.databasePreserved).toBe(true);
    expect(readFileSync(databasePath, 'utf8')).toBe('database sentinel');
    expect(readFileSync(installed.paths.configPath, 'utf8')).toBe('model = "gpt-5"\n');
    expect(existsSync(installed.paths.skillPath)).toBe(false);
    expect(existsSync(installed.paths.manifestPath)).toBe(false);

    const repeated = await uninstallCodexIntegration({ scope: 'project', projectRoot });
    expect(repeated.changed).toEqual([]);
    expect(readFileSync(databasePath, 'utf8')).toBe('database sentinel');
  });

  it('updates ownership when removing one component from a complete installation', async () => {
    const projectRoot = temporaryRoot('partial-uninstall');
    const installed = await installCodexIntegration(projectOptions(projectRoot));

    await uninstallCodexIntegration({ scope: 'project', projectRoot, components: ['skill'] });

    expect(existsSync(installed.paths.skillPath)).toBe(false);
    expect(existsSync(installed.paths.configPath)).toBe(true);
    expect(existsSync(installed.paths.hooksPath)).toBe(true);
    const manifest = CodexInstallationManifestSchema.parse(
      JSON.parse(readFileSync(installed.paths.manifestPath, 'utf8')),
    );
    expect(manifest.installedComponents).toEqual(['mcp', 'hooks']);
    expect(manifest.managedFiles).not.toContain(installed.paths.skillPath);
    expect(manifest.managedHashes).not.toHaveProperty('skill');
  });

  it('preserves a user-modified managed skill when ownership no longer matches', async () => {
    const projectRoot = temporaryRoot('modified-skill');
    const installed = await installCodexIntegration(projectOptions(projectRoot));
    writeFileSync(installed.paths.skillPath, 'user-owned replacement\n', 'utf8');

    const removed = await uninstallCodexIntegration({ scope: 'project', projectRoot });

    expect(readFileSync(installed.paths.skillPath, 'utf8')).toBe('user-owned replacement\n');
    expect(removed.preserved).toContain(installed.paths.skillPath);
    expect(removed.warnings.join(' ')).toContain('modified skill');
  });

  it('reports a safe status without reading conversation content', async () => {
    const projectRoot = temporaryRoot('status');
    await installCodexIntegration(projectOptions(projectRoot));

    const status = getCodexIntegrationStatus({ scope: 'project', projectRoot });
    expect(status).toMatchObject({
      installed: true,
      integrationVersion: '0.1.0',
      mcp: { present: true, managed: true, valid: true },
      skill: { installed: true, matchesManagedContent: true },
      hooks: { installed: true, valid: true },
    });
    expect(JSON.stringify(status)).not.toContain('rawText');
  });
});
