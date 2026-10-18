import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setupEnv.js'],
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
  },
});
