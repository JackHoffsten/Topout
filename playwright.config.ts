import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: { baseURL: 'https://localhost:8443', ignoreHTTPSErrors: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  globalSetup: './e2e/setup.ts',
});
