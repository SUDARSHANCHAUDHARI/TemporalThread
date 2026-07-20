import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';
import { z } from 'zod';

export const CodexInstallationScopeSchema = z.enum(['user', 'project']);
export type CodexInstallationScope = z.infer<typeof CodexInstallationScopeSchema>;

export interface CodexIntegrationPaths {
  scope: CodexInstallationScope;
  scopeRoot: string;
  configPath: string;
  hooksPath: string;
  skillDirectory: string;
  skillPath: string;
  manifestPath: string;
}

export interface ResolveCodexIntegrationPathsOptions {
  scope: CodexInstallationScope;
  projectRoot?: string;
  userHome?: string;
  platform?: NodeJS.Platform;
}

function requiredRoot(value: string | undefined, label: string): string {
  if (!value?.trim())
    throw new Error(`${label} is required for Codex ${label === 'projectRoot' ? 'project' : 'user'} scope`);
  return value;
}

export function resolveCodexIntegrationPaths(
  options: ResolveCodexIntegrationPathsOptions,
): CodexIntegrationPaths {
  const scope = CodexInstallationScopeSchema.parse(options.scope);
  const platform = options.platform ?? process.platform;
  const path = platform === 'win32' ? win32 : posix;
  const rootInput =
    scope === 'user'
      ? requiredRoot(options.userHome ?? homedir(), 'userHome')
      : requiredRoot(options.projectRoot, 'projectRoot');
  const scopeRoot = path.resolve(rootInput);
  const codexDirectory = path.join(scopeRoot, '.codex');
  const skillDirectory = path.join(scopeRoot, '.agents', 'skills', 'temporal-awareness');

  return {
    scope,
    scopeRoot,
    configPath: path.join(codexDirectory, 'config.toml'),
    hooksPath: path.join(codexDirectory, 'hooks.json'),
    skillDirectory,
    skillPath: path.join(skillDirectory, 'SKILL.md'),
    manifestPath:
      scope === 'user'
        ? path.join(codexDirectory, 'temporalthread', 'integration-manifest.json')
        : path.join(codexDirectory, 'temporalthread.integration.json'),
  };
}
