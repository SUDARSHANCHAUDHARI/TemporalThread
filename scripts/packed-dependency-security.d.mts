export interface AuditSummary {
  passed: boolean;
  exitStatus: number;
  vulnerabilities: {
    info: number;
    low: number;
    moderate: number;
    high: number;
    critical: number;
    total: number;
  };
}

export interface PackedDependencyAssessment {
  resolvedSecurityDependencies: Record<string, string[]>;
  minimumsSatisfied: boolean;
  audit: AuditSummary;
  secure: boolean;
}

export const securityMinimums: Readonly<
  Record<string, Readonly<{ major: number; minor: number; patch: number }>>
>;

export function productionVersions(graph: unknown, packageName: string): string[];

export function hasVersionAtLeast(
  versions: string[],
  expectedMajor: number,
  expectedMinor: number,
  expectedPatch: number,
): boolean;

export function summarizeAudit(report: unknown, exitStatus: number): AuditSummary;

export function assessPackedDependencyGraph(graph: unknown, audit: AuditSummary): PackedDependencyAssessment;
