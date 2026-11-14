import process from 'node:process';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Isolated developer checks; never silently reuse a different build/server.
export default defineConfig(base, {
  outputDir: process.env.DEVELOPER_OUTPUT_DIR || './test-results/developer',
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4186', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    // Accounts (SCRUM-97) need the real server and a local database: wrangler dev on :4187.
    ...(['chromium', 'firefox'] as const).map((browserName) => ({
      name: `accounts-${browserName}`,
      testDir: './tests/e2e-accounts',
      use: { browserName, baseURL: 'http://127.0.0.1:4187' },
    })),
  ],
  webServer: [
    {
      command: 'npm run preview -- --port 4186 --strictPort',
      url: 'http://127.0.0.1:4186',
      reuseExistingServer: false,
    },
    {
      command: 'bash scripts/accounts-server.sh 4187',
      url: 'http://127.0.0.1:4187/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
