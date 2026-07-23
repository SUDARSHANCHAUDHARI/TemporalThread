import type { PlatformPath } from 'node:path';

export const EXPECTED_MCP_TOOLS: readonly string[];
export const ROOT_MARKER_FILE: string;

export interface CertificationPaths {
  root: string;
  projectRoot: string;
  setupHome: string;
  codexHome: string;
  temporalThreadHome: string;
  consumerRoot: string;
  packageDirectory: string;
  processTemp: string;
  pnpmStore: string;
  npmCache: string;
  npmUserConfig: string;
  executableDirectory: string;
  manifestPath: string;
  privacyMarkerPath: string;
  instructionsPath: string;
}

export interface ControlledScenario {
  now: string;
  previous: string;
  due: string;
}

export function isPathInside(root: string, candidate: string, pathApi?: PlatformPath): boolean;
export function certificationPaths(root: string): CertificationPaths;
export function buildIsolatedEnvironment(
  paths: CertificationPaths,
  baseEnvironment?: NodeJS.ProcessEnv,
  platform?: NodeJS.Platform,
): NodeJS.ProcessEnv;
export function createCertificationConsumerManifest(
  localPackages: Record<string, string>,
  mcpSdkVersion: string,
): {
  name: string;
  private: boolean;
  version: string;
  packageManager: string;
  dependencies: Record<string, string>;
};
export function assertSafeCertificationParent(options: {
  parent: string;
  userHome: string;
  repositoryRoot: string;
  systemTemp: string;
}): string;
export function createCertificationRoot(parent: string): string;
export function initializeCertificationRoot(root: string, certificationId: string): void;
export function assertManagedPath(root: string, candidate: string): string;
export function sanitizeCertificationDiagnostic(
  value: unknown,
  replacements: {
    repositoryRoot?: string;
    userHome?: string;
    temporaryRoot?: string;
    privacyMarker?: string;
  },
): string;
export function assertExactToolDiscovery(tools: readonly string[]): void;
export function computeControlledScenario(nowMilliseconds?: number): ControlledScenario;
export function evaluateCertificationStage(
  stage: 'installed' | 'uninstalled' | 'purged',
  state: {
    integrationPresent: boolean;
    databaseExists: boolean;
    unrelatedConfigPreserved: boolean;
    interactions: number;
    commitments: number;
  },
): string[];
export function renderPosixLauncher(): string;
export function renderWindowsLauncher(): string;
export function renderPosixTemporalThreadRunner(): string;
export function renderWindowsTemporalThreadRunner(): string;
export function runCertificationCommand(options: {
  operation: string;
  executable: string;
  arguments?: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  input?: string;
  replacements?: {
    repositoryRoot?: string;
    userHome?: string;
    temporaryRoot?: string;
    privacyMarker?: string;
  };
  timeoutMs?: number;
}): string;
export function parseJsonCommandOutput(operation: string, output: string): unknown;
export function createCertificationManifest(options: {
  certificationId: string;
  expectedCommit: string;
  timezone: string;
  paths: CertificationPaths;
  privacyMarkerSha256: string;
  createdAt: string;
  scenario: ControlledScenario;
}): Record<string, unknown>;
export function validateCertificationManifest(
  manifest: unknown,
  expectedRoot?: string,
): Record<string, unknown>;
export function assertPrivacyMarkerAbsent(value: unknown, marker: string): void;
export function cleanupCertificationRoot(options: {
  root: string;
  certificationId: string;
  userHome: string;
  repositoryRoot: string;
  systemTemp: string;
}): { removed: boolean; alreadyRemoved: boolean };
export function removeTestDirectory(root: string): void;
export function sha256Text(value: string): string;
export function ensureCertificationDirectories(paths: CertificationPaths): void;
