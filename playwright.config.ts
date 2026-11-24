import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/frontend/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_FRONTEND_URL ?? 'http://localhost:3050',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Local runs use the existing application. In CI Playwright owns both servers.
  webServer: process.env.CI
    ? [
        {
          command: 'pnpm backend start',
          url: 'http://localhost:4050/api/health',
          timeout: 120_000,
        },
        {
          command: 'pnpm frontend dev',
          url: 'http://localhost:3050',
          timeout: 120_000,
        },
      ]
    : undefined,
});
