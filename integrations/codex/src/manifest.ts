import { PrivacyModeSchema } from '@temporalthread/shared-types';
import { z } from 'zod';
import { CodexInstallationScopeSchema } from './paths.js';

const SemanticVersionSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
    'Invalid semantic version',
  );

export const CodexIntegrationComponentSchema = z.enum(['mcp', 'skill', 'hooks', 'plugin']);
export const CodexSurfaceSchema = z.enum(['chatgpt-desktop', 'codex-cli', 'codex-ide', 'manual', 'unknown']);

export const CodexInstallationManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    temporalThreadVersion: SemanticVersionSchema,
    integrationVersion: SemanticVersionSchema,
    installedAt: z.string().datetime({ offset: true }),
    scope: CodexInstallationScopeSchema,
    privacyMode: PrivacyModeSchema,
    supportedSurface: CodexSurfaceSchema,
    installedComponents: z.array(CodexIntegrationComponentSchema).min(1).max(4),
    managedFiles: z.array(z.string().trim().min(1).max(4096)).max(32),
    backupPaths: z.array(z.string().trim().min(1).max(4096)).max(32),
    managedHashes: z
      .record(z.string().trim().min(1).max(128), z.string().regex(/^[a-f0-9]{64}$/))
      .default({}),
  })
  .strict();

export type CodexInstallationManifest = z.infer<typeof CodexInstallationManifestSchema>;

interface ParsedSemanticVersion {
  core: [number, number, number];
  prerelease: string[];
}

function parseSemanticVersion(value: string): ParsedSemanticVersion {
  const parsed = SemanticVersionSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid semantic version: ${value}`);
  const withoutBuild = value.split('+', 1)[0] ?? value;
  const [coreValue, prereleaseValue] = withoutBuild.split('-', 2);
  const coreParts = (coreValue ?? '').split('.').map((part) => Number(part));
  if (coreParts.length !== 3 || coreParts.some((part) => !Number.isSafeInteger(part) || part < 0)) {
    throw new Error(`Invalid semantic version: ${value}`);
  }
  return {
    core: [coreParts[0] ?? 0, coreParts[1] ?? 0, coreParts[2] ?? 0],
    prerelease: prereleaseValue ? prereleaseValue.split('.') : [],
  };
}

function comparePrerelease(left: string[], right: string[]): number {
  if (!left.length && !right.length) return 0;
  if (!left.length) return 1;
  if (!right.length) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
    if (leftNumber !== null && rightNumber !== null) return Math.sign(leftNumber - rightNumber);
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

export function compareSemanticVersions(left: string, right: string): -1 | 0 | 1 {
  const parsedLeft = parseSemanticVersion(left);
  const parsedRight = parseSemanticVersion(right);
  for (let index = 0; index < parsedLeft.core.length; index += 1) {
    const difference = (parsedLeft.core[index] ?? 0) - (parsedRight.core[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  const prereleaseDifference = comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
  return prereleaseDifference === 0 ? 0 : prereleaseDifference < 0 ? -1 : 1;
}
