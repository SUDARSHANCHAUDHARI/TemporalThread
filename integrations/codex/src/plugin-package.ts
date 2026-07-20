import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';
import { CODEX_INTEGRATION_VERSION, readCodexIntegrationAssets } from './installer.js';

const RelativePluginPathSchema = z
  .string()
  .regex(/^\.\/[A-Za-z0-9._/-]+$/)
  .refine((value) => !value.split('/').includes('..'));

export const CodexPluginManifestSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    description: z.string().trim().min(1).max(500),
    author: z.object({ name: z.string().trim().min(1).max(200) }).strict(),
    license: z.literal('MIT'),
    keywords: z.array(z.string().trim().min(1).max(64)).min(1).max(20),
    skills: RelativePluginPathSchema,
    mcpServers: RelativePluginPathSchema,
    hooks: RelativePluginPathSchema,
    interface: z
      .object({
        displayName: z.string().trim().min(1).max(100),
        shortDescription: z.string().trim().min(1).max(200),
        longDescription: z.string().trim().min(1).max(1_000),
        developerName: z.string().trim().min(1).max(200),
        category: z.string().trim().min(1).max(100),
        capabilities: z
          .array(z.enum(['Read', 'Write']))
          .min(1)
          .max(2),
        defaultPrompt: z.array(z.string().trim().min(1).max(500)).min(1).max(10),
      })
      .strict(),
  })
  .strict();

export const CodexPluginMcpSchema = z
  .record(
    z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    z
      .object({
        command: z.string().trim().min(1).max(4096),
        args: z.array(z.string().max(4096)).max(64),
      })
      .strict(),
  )
  .refine((servers) => Object.keys(servers).length > 0);

export const CodexMarketplaceSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    plugins: z
      .array(
        z
          .object({
            name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            source: z
              .object({
                source: z.literal('local'),
                path: RelativePluginPathSchema,
              })
              .strict(),
            category: z.string().trim().min(1).max(100),
            interface: z.object({ displayName: z.string().trim().min(1).max(100) }).strict(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export interface CodexPluginValidationResult {
  ok: true;
  pluginName: string;
  version: string;
  files: string[];
  hashes: Record<string, string>;
}

function parseJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON in packaged Codex artifact: ${path.split('/').at(-1) ?? 'file'}`, {
      cause: error,
    });
  }
}

function packageFiles(root: string, current = root): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = resolve(current, entry.name);
    if (lstatSync(path).isSymbolicLink()) throw new Error('Codex plugin package must not contain symlinks');
    if (entry.isDirectory()) files.push(...packageFiles(root, path));
    else if (entry.isFile()) files.push(relative(root, path).replaceAll('\\', '/'));
  }
  return files.sort();
}

function resolveInside(root: string, relativePath: string): string {
  const resolved = resolve(root, relativePath.slice(2));
  const pathFromRoot = relative(root, resolved);
  if (!pathFromRoot || pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
    throw new Error('Codex plugin manifest path escapes the plugin root');
  }
  return resolved;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function validateCodexPluginPackage(options: {
  pluginRoot: string;
  marketplacePath?: string;
}): CodexPluginValidationResult {
  const pluginRoot = resolve(options.pluginRoot);
  const manifest = CodexPluginManifestSchema.parse(
    parseJson(resolve(pluginRoot, '.codex-plugin/plugin.json')),
  );
  if (manifest.version !== CODEX_INTEGRATION_VERSION) {
    throw new Error('Codex plugin and integration versions do not match');
  }
  for (const path of [manifest.skills, manifest.mcpServers, manifest.hooks]) resolveInside(pluginRoot, path);

  const mcp = CodexPluginMcpSchema.parse(parseJson(resolveInside(pluginRoot, manifest.mcpServers)));
  if (Object.keys(mcp).join(',') !== 'temporal-thread') {
    throw new Error('Codex plugin must expose only the TemporalThread MCP server');
  }
  if (mcp['temporal-thread']?.command !== 'temporalthread') {
    throw new Error('Codex plugin requires the installed TemporalThread CLI');
  }
  if (JSON.stringify(mcp['temporal-thread'].args) !== JSON.stringify(['start'])) {
    throw new Error('Codex plugin MCP arguments are invalid');
  }

  const canonical = readCodexIntegrationAssets();
  const packagedSkill = readFileSync(resolve(pluginRoot, 'skills/temporal-awareness/SKILL.md'), 'utf8');
  const packagedHooks = readFileSync(resolve(pluginRoot, 'hooks/hooks.json'), 'utf8');
  if (packagedSkill !== canonical.skillContent) throw new Error('Packaged Codex skill is out of sync');
  if (packagedHooks !== canonical.hooksContent) throw new Error('Packaged Codex hooks are out of sync');

  for (const required of ['README.md', 'PRIVACY.md', 'COMPATIBILITY.md', 'LICENSE']) {
    readFileSync(resolve(pluginRoot, required), 'utf8');
  }
  if (options.marketplacePath) {
    const marketplace = CodexMarketplaceSchema.parse(parseJson(resolve(options.marketplacePath)));
    const entry = marketplace.plugins.find((plugin) => plugin.name === manifest.name);
    if (!entry) throw new Error('Codex marketplace is missing the TemporalThread plugin');
    const marketplaceRoot = resolve(dirname(options.marketplacePath), '../..');
    if (resolveInside(marketplaceRoot, entry.source.path) !== pluginRoot) {
      throw new Error('Codex marketplace source does not match the plugin root');
    }
  }

  const files = packageFiles(pluginRoot);
  const forbidden = files.filter((path) =>
    /(?:^|\/)(?:\.env|local\.properties|.*\.(?:db|sqlite|sqlite3|pem|key|p12))$/i.test(path),
  );
  if (forbidden.length > 0) throw new Error('Codex plugin contains forbidden local or secret files');
  const hashes = Object.fromEntries(
    files.map((path) => [path, sha256(readFileSync(resolve(pluginRoot, path), 'utf8'))]),
  );
  const serialized = files.map((path) => readFileSync(resolve(pluginRoot, path), 'utf8')).join('\n');
  if (/\/(?:Users|home)\/[^/\s]+\//.test(serialized) || /[A-Za-z]:\\Users\\/.test(serialized)) {
    throw new Error('Codex plugin contains a personal absolute path');
  }
  return { ok: true, pluginName: manifest.name, version: manifest.version, files, hashes };
}
