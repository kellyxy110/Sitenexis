import { defineConfig, devices } from '@playwright/test';

const testPort = Number(process.env.PLAYWRIGHT_PORT ?? 3010);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : 1,
  reporter: process.env['CI'] ? 'github' : 'list',
  timeout: 60_000,

  use: {
    baseURL: `http://localhost:${testPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `cross-env PLAYWRIGHT_TEST=true pnpm --filter web exec next dev --port ${testPort}`,
    url: `http://localhost:${testPort}`,
    reuseExistingServer: true,
    timeout: 300_000,
    env: {
      PLAYWRIGHT_TEST: 'true',
    },
  },
});
