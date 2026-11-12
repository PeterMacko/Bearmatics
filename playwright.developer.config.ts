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
  ],
  webServer: { command: 'npm run preview -- --port 4186 --strictPort', url: 'http://127.0.0.1:4186', reuseExistingServer: false },
});
