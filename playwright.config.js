import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  workers: 2,
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    timeout: 120000,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
  },
});
