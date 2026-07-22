const securityMinimums = Object.freeze({
  '@hono/node-server': Object.freeze({ major: 2, minor: 0, patch: 10 }),
  'fast-uri': Object.freeze({ major: 3, minor: 1, patch: 4 }),
});

function dependencyRoots(graph) {
  if (Array.isArray(graph)) return graph;
  if (graph && typeof graph === 'object') return [graph];
  throw new Error('Packed production dependency graph must be an object or array');
}

export function productionVersions(graph, packageName) {
  const versions = new Set();

  function visit(dependencies) {
    if (!dependencies || typeof dependencies !== 'object') return;
    for (const [name, dependency] of Object.entries(dependencies)) {
      if (!dependency || typeof dependency !== 'object') continue;
      if (name === packageName && typeof dependency.version === 'string') {
        versions.add(dependency.version);
      }
      visit(dependency.dependencies);
    }
  }

  for (const project of dependencyRoots(graph)) visit(project.dependencies);
  return [...versions].sort();
}

export function hasVersionAtLeast(versions, expectedMajor, expectedMinor, expectedPatch) {
  return (
    versions.length > 0 &&
    versions.every((version) => {
      const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
      if (!match) return false;
      const [, major, minor, patch] = match.map(Number);
      return (
        major === expectedMajor &&
        (minor > expectedMinor || (minor === expectedMinor && patch >= expectedPatch))
      );
    })
  );
}

export function summarizeAudit(report, exitStatus) {
  const vulnerabilityCounts = report?.metadata?.vulnerabilities;
  if (!vulnerabilityCounts || typeof vulnerabilityCounts !== 'object') {
    throw new Error('Package-manager audit did not return vulnerability metadata');
  }

  const severityCounts = Object.fromEntries(
    ['info', 'low', 'moderate', 'high', 'critical'].map((severity) => {
      const count = Number(vulnerabilityCounts[severity] ?? 0);
      if (!Number.isInteger(count) || count < 0) {
        throw new Error(`Package-manager audit returned an invalid ${severity} count`);
      }
      return [severity, count];
    }),
  );
  const calculatedTotal = Object.values(severityCounts).reduce((total, count) => total + count, 0);
  const reportedTotal = 'total' in vulnerabilityCounts ? Number(vulnerabilityCounts.total) : calculatedTotal;
  if (!Number.isInteger(reportedTotal) || reportedTotal < calculatedTotal) {
    throw new Error('Package-manager audit returned an invalid total vulnerability count');
  }
  const counts = { ...severityCounts, total: reportedTotal };

  return {
    passed: exitStatus === 0 && counts.total === 0,
    exitStatus,
    vulnerabilities: counts,
  };
}

export function assessPackedDependencyGraph(graph, audit) {
  const resolvedSecurityDependencies = {
    '@modelcontextprotocol/sdk': productionVersions(graph, '@modelcontextprotocol/sdk'),
    '@hono/node-server': productionVersions(graph, '@hono/node-server'),
    'fast-uri': productionVersions(graph, 'fast-uri'),
  };
  const minimumsSatisfied = Object.entries(securityMinimums).every(([name, minimum]) =>
    hasVersionAtLeast(resolvedSecurityDependencies[name], minimum.major, minimum.minor, minimum.patch),
  );

  return {
    resolvedSecurityDependencies,
    minimumsSatisfied,
    audit,
    secure: minimumsSatisfied && audit.passed,
  };
}

export { securityMinimums };
