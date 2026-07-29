import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@sudarshanchaudhari/temporalthread-shared-types': `${root}packages/shared-types/src/index.ts`,
      '@sudarshanchaudhari/temporalthread-config': `${root}packages/config/src/index.ts`,
      '@sudarshanchaudhari/temporalthread-temporal-parser': `${root}packages/temporal-parser/src/index.ts`,
      '@sudarshanchaudhari/temporalthread-storage-sqlite': `${root}packages/storage-sqlite/src/index.ts`,
      '@sudarshanchaudhari/temporalthread-core': `${root}packages/core/src/index.ts`,
      '@sudarshanchaudhari/temporalthread-codex-integration': `${root}integrations/codex/src/index.ts`,
      '@sudarshanchaudhari/temporalthread-mcp-server': `${root}apps/mcp-server/src/index.ts`,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
    },
  },
});
