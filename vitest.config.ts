import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@temporalthread/shared-types': `${root}packages/shared-types/src/index.ts`,
      '@temporalthread/config': `${root}packages/config/src/index.ts`,
      '@temporalthread/temporal-parser': `${root}packages/temporal-parser/src/index.ts`,
      '@temporalthread/storage-sqlite': `${root}packages/storage-sqlite/src/index.ts`,
      '@temporalthread/core': `${root}packages/core/src/index.ts`,
      '@temporalthread/codex-integration': `${root}integrations/codex/src/index.ts`,
      '@temporalthread/mcp-server': `${root}apps/mcp-server/src/index.ts`,
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
