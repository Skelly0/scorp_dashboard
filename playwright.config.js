import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-pixel5',
      use: { ...devices['Pixel 5'], hasTouch: true },
    },
    {
      name: 'mobile-iphone13',
      use: { ...devices['iPhone 13'], hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run preview',
    port: 4173,
    timeout: 30000,
    reuseExistingServer: !process.env.CI,
  },
});
