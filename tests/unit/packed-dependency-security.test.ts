import { describe, expect, it } from 'vitest';

const security = await import('../../scripts/packed-dependency-security.mjs');

function graph(honoVersions: string[], fastUriVersions = ['3.1.4']) {
  return {
    dependencies: {
      '@modelcontextprotocol/sdk': {
        version: '1.29.0',
        dependencies: Object.fromEntries([
          ...honoVersions.map((version, index) => [
            index === 0 ? '@hono/node-server' : `nested-${index}`,
            index === 0
              ? { version }
              : { version: '1.0.0', dependencies: { '@hono/node-server': { version } } },
          ]),
          [
            'fast-uri-root',
            { version: '1.0.0', dependencies: { 'fast-uri': { version: fastUriVersions[0] } } },
          ],
          ...fastUriVersions
            .slice(1)
            .map((version, index) => [
              `fast-uri-nested-${index}`,
              { version: '1.0.0', dependencies: { 'fast-uri': { version } } },
            ]),
        ]),
      },
    },
  };
}

const cleanAudit = security.summarizeAudit({ metadata: { vulnerabilities: { total: 0 } } }, 0);

describe('packed dependency security policy', () => {
  it('accepts a fully patched graph with a clean production audit', () => {
    const result = security.assessPackedDependencyGraph(graph(['2.0.10']), cleanAudit);

    expect(result.secure).toBe(true);
    expect(result.resolvedSecurityDependencies).toEqual({
      '@modelcontextprotocol/sdk': ['1.29.0'],
      '@hono/node-server': ['2.0.10'],
      'fast-uri': ['3.1.4'],
    });
  });

  it('rejects a mixed graph when any Hono copy remains vulnerable', () => {
    const result = security.assessPackedDependencyGraph([graph(['2.0.11']), graph(['1.19.14'])], cleanAudit);

    expect(result.minimumsSatisfied).toBe(false);
    expect(result.secure).toBe(false);
    expect(result.resolvedSecurityDependencies['@hono/node-server']).toEqual(['1.19.14', '2.0.11']);
  });

  it('rejects missing or non-release dependency versions', () => {
    expect(security.hasVersionAtLeast([], 2, 0, 10)).toBe(false);
    expect(security.hasVersionAtLeast(['2.0.10-beta.1'], 2, 0, 10)).toBe(false);
    expect(security.hasVersionAtLeast(['3.0.0'], 2, 0, 10)).toBe(false);
  });

  it('rejects a graph when the package-manager audit reports a vulnerability', () => {
    const audit = security.summarizeAudit({ metadata: { vulnerabilities: { moderate: 1 } } }, 1);
    const result = security.assessPackedDependencyGraph(graph(['2.0.11']), audit);

    expect(audit).toEqual({
      passed: false,
      exitStatus: 1,
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 1,
        high: 0,
        critical: 0,
        total: 1,
      },
    });
    expect(result.minimumsSatisfied).toBe(true);
    expect(result.secure).toBe(false);
  });
});
