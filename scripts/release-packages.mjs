export const releaseVersion = '0.1.0';

export const releasePackages = [
  {
    name: '@temporalthread/shared-types',
    directory: 'packages/shared-types',
    archive: 'temporalthread-shared-types-0.1.0.tgz',
    nativeDependencies: [],
  },
  {
    name: '@temporalthread/config',
    directory: 'packages/config',
    archive: 'temporalthread-config-0.1.0.tgz',
    nativeDependencies: [],
  },
  {
    name: '@temporalthread/temporal-parser',
    directory: 'packages/temporal-parser',
    archive: 'temporalthread-temporal-parser-0.1.0.tgz',
    nativeDependencies: [],
  },
  {
    name: '@temporalthread/storage-sqlite',
    directory: 'packages/storage-sqlite',
    archive: 'temporalthread-storage-sqlite-0.1.0.tgz',
    nativeDependencies: ['better-sqlite3'],
  },
  {
    name: '@temporalthread/core',
    directory: 'packages/core',
    archive: 'temporalthread-core-0.1.0.tgz',
    nativeDependencies: ['better-sqlite3 (transitive through @temporalthread/storage-sqlite)'],
  },
  {
    name: '@temporalthread/mcp-server',
    directory: 'apps/mcp-server',
    archive: 'temporalthread-mcp-server-0.1.0.tgz',
    nativeDependencies: ['better-sqlite3 (transitive through @temporalthread/storage-sqlite)'],
  },
  {
    name: '@temporalthread/codex-integration',
    directory: 'integrations/codex',
    archive: 'temporalthread-codex-integration-0.1.0.tgz',
    nativeDependencies: ['better-sqlite3 (transitive through @temporalthread/core)'],
  },
  {
    name: 'temporalthread',
    directory: 'apps/cli',
    archive: 'temporalthread-0.1.0.tgz',
    nativeDependencies: ['better-sqlite3 (transitive through @temporalthread/storage-sqlite)'],
  },
];
