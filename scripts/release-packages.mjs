export const releaseVersion = '0.1.0';

export const releasePackages = [
  {
    name: '@sudarshanchaudhari/temporalthread-shared-types',
    directory: 'packages/shared-types',
    archive: 'sudarshanchaudhari-temporalthread-shared-types-0.1.0.tgz',
    nativeDependencies: [],
  },
  {
    name: '@sudarshanchaudhari/temporalthread-config',
    directory: 'packages/config',
    archive: 'sudarshanchaudhari-temporalthread-config-0.1.0.tgz',
    nativeDependencies: [],
  },
  {
    name: '@sudarshanchaudhari/temporalthread-temporal-parser',
    directory: 'packages/temporal-parser',
    archive: 'sudarshanchaudhari-temporalthread-temporal-parser-0.1.0.tgz',
    nativeDependencies: [],
  },
  {
    name: '@sudarshanchaudhari/temporalthread-storage-sqlite',
    directory: 'packages/storage-sqlite',
    archive: 'sudarshanchaudhari-temporalthread-storage-sqlite-0.1.0.tgz',
    nativeDependencies: ['better-sqlite3'],
  },
  {
    name: '@sudarshanchaudhari/temporalthread-core',
    directory: 'packages/core',
    archive: 'sudarshanchaudhari-temporalthread-core-0.1.0.tgz',
    nativeDependencies: [
      'better-sqlite3 (transitive through @sudarshanchaudhari/temporalthread-storage-sqlite)',
    ],
  },
  {
    name: '@sudarshanchaudhari/temporalthread-mcp-server',
    directory: 'apps/mcp-server',
    archive: 'sudarshanchaudhari-temporalthread-mcp-server-0.1.0.tgz',
    nativeDependencies: [
      'better-sqlite3 (transitive through @sudarshanchaudhari/temporalthread-storage-sqlite)',
    ],
  },
  {
    name: '@sudarshanchaudhari/temporalthread-codex-integration',
    directory: 'integrations/codex',
    archive: 'sudarshanchaudhari-temporalthread-codex-integration-0.1.0.tgz',
    nativeDependencies: ['better-sqlite3 (transitive through @sudarshanchaudhari/temporalthread-core)'],
  },
  {
    name: 'temporalthread',
    directory: 'apps/cli',
    archive: 'temporalthread-0.1.0.tgz',
    nativeDependencies: [
      'better-sqlite3 (transitive through @sudarshanchaudhari/temporalthread-storage-sqlite)',
    ],
  },
];
