import { defineConfig } from 'vitest/config';
// Server (Worker) tests: Node environment, separate from the jsdom app tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['worker/**/*.test.ts'],
    restoreMocks: true,
    testTimeout: 30_000,
  },
});
