import { defineConfig, devices } from '@playwright/test';

const port = 3000;
// Lets CI or a cloud sandbox point at a preinstalled Chromium instead of downloading one.
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'tests/e2e',
  // Multi-step flows (onboarding + PBKDF2 + several screens) can exceed 30 s under parallel load.
  timeout: 60_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
    {
      // Phone layout with a touch pointer: bottom tabs, compact month, 48 px targets.
      name: 'mobile',
      grep: /@mobile/,
      use: {
        ...devices['Pixel 7'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    // e2e covers the flagged pairing (Phase 6) and AI intake (Phase 7) flows too.
    command: `NEXT_PUBLIC_FEATURE_SYNC=true NEXT_PUBLIC_FEATURE_INTAKE=true pnpm build && pnpm start --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
