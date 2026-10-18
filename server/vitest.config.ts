import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      TEST_MONGODB_URI: 'mongodb://127.0.0.1:27017/pathforge_test',
      LOG_LEVEL: 'silent',
    },
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    isolate: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
