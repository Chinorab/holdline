import { defineConfig, devices } from '@playwright/test';

// Web page checks: landing, privacy, the unsupported message and the Enter mixed reality
// flow. "dev" runs against the IWSDK dev server (emulator injected on localhost); "prod"
// runs against the production build served by vite preview.
export default defineConfig({
  testDir: 'tests/web',
  timeout: 60000,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'dev',
      use: { baseURL: process.env.HOLDLINE_DEV_URL ?? 'https://localhost:8081' },
    },
    {
      name: 'prod',
      use: { baseURL: process.env.HOLDLINE_PROD_URL ?? 'https://localhost:4173' },
    },
  ],
  webServer: process.env.HOLDLINE_SKIP_PREVIEW
    ? undefined
    : {
        command: 'npm run build && npm run preview',
        url: 'https://localhost:4173',
        ignoreHTTPSErrors: true,
        reuseExistingServer: true,
        timeout: 180000,
      },
});
