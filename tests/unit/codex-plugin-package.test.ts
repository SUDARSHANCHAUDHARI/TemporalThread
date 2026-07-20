import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CodexMarketplaceSchema,
  CodexPluginManifestSchema,
  CodexPluginMcpSchema,
  validateCodexPluginPackage,
} from '../../integrations/codex/src/index.js';

const pluginRoot = resolve('integrations/codex/plugin');
const marketplacePath = resolve('.agents/plugins/marketplace.json');
const temporaryRoots: string[] = [];

function json(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('official Codex plugin package', () => {
  it('uses the current official manifest, MCP, hook, skill, and marketplace shapes', () => {
    const manifest = CodexPluginManifestSchema.parse(json(join(pluginRoot, '.codex-plugin', 'plugin.json')));
    const mcp = CodexPluginMcpSchema.parse(json(join(pluginRoot, '.mcp.json')));
    const marketplace = CodexMarketplaceSchema.parse(json(marketplacePath));

    expect(manifest).toMatchObject({
      name: 'temporalthread',
      version: '0.1.0',
      skills: './skills/',
      mcpServers: './.mcp.json',
      hooks: './hooks/hooks.json',
      license: 'MIT',
      interface: { displayName: 'TemporalThread' },
    });
    expect(mcp).toEqual({
      'temporal-thread': { command: 'temporalthread', args: ['start'] },
    });
    expect(marketplace.plugins[0]).toMatchObject({
      name: 'temporalthread',
      source: { source: 'local', path: './integrations/codex/plugin' },
      interface: { displayName: 'TemporalThread' },
    });
  });

  it('validates required legal/privacy/compatibility files and canonical template copies', () => {
    const result = validateCodexPluginPackage({ pluginRoot, marketplacePath });

    expect(result).toMatchObject({ ok: true, pluginName: 'temporalthread', version: '0.1.0' });
    expect(result.files).toEqual([
      '.codex-plugin/plugin.json',
      '.mcp.json',
      'COMPATIBILITY.md',
      'LICENSE',
      'PRIVACY.md',
      'README.md',
      'hooks/hooks.json',
      'skills/temporal-awareness/SKILL.md',
    ]);
    expect(result.hashes['skills/temporal-awareness/SKILL.md']).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8')).toBe(
      readFileSync(resolve('integrations/codex/hooks.json'), 'utf8'),
    );
    expect(readFileSync(join(pluginRoot, 'skills/temporal-awareness/SKILL.md'), 'utf8')).toBe(
      readFileSync(resolve('skills/codex/temporal-awareness/SKILL.md'), 'utf8'),
    );
  });

  it('rejects path traversal and forbidden local files', () => {
    expect(() =>
      CodexPluginManifestSchema.parse({
        ...(json(join(pluginRoot, '.codex-plugin', 'plugin.json')) as Record<string, unknown>),
        skills: './../outside',
      }),
    ).toThrow();

    const temporaryRoot = mkdtempSync(join(tmpdir(), 'temporalthread-plugin-invalid-'));
    temporaryRoots.push(temporaryRoot);
    const copiedPlugin = join(temporaryRoot, 'plugin');
    cpSync(pluginRoot, copiedPlugin, { recursive: true });
    writeFileSync(join(copiedPlugin, 'private.sqlite'), 'not a real database', 'utf8');
    expect(() => validateCodexPluginPackage({ pluginRoot: copiedPlugin })).toThrow(
      'forbidden local or secret files',
    );
  });

  it('keeps package, plugin, and CLI versions aligned and ships runtime assets', () => {
    const integrationPackage = json(resolve('integrations/codex/package.json')) as {
      version: string;
      files: string[];
    };
    const cliPackage = json(resolve('apps/cli/package.json')) as { version: string };
    const plugin = CodexPluginManifestSchema.parse(json(join(pluginRoot, '.codex-plugin', 'plugin.json')));

    expect(plugin.version).toBe(integrationPackage.version);
    expect(plugin.version).toBe(cliPackage.version);
    expect(integrationPackage.files).toEqual([
      'dist/**/*.d.ts',
      'dist/**/*.d.ts.map',
      'dist/**/*.js',
      'dist/**/*.js.map',
      'hooks.json',
      'plugin',
      'README.md',
      'LICENSE',
    ]);
  });
});
