import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Tests run the real Express app against a throwaway SQLite database. Vite must
 * not try to bundle node built-ins, so they stay external to the SSR graph.
 */
export default defineConfig({
  resolve: {
    alias: [
      // Vite strips the `node:` prefix before checking its built-in list, and
      // that list predates node:sqlite. Route it to a shim that loads the real
      // built-in with createRequire.
      { find: /^sqlite$/, replacement: path.resolve(__dirname, 'tests/sqlite-shim.ts') },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: '@shared', replacement: path.resolve(__dirname, 'shared') },
    ],
  },
  ssr: {
    external: ['node:sqlite'],
  },
  test: {
    environment: 'node',
    server: {
      deps: {
        external: [/^node:/],
      },
    },
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Each test file configures its own database, so files must not run
    // concurrently inside one process.
    fileParallelism: false,
  },
});
