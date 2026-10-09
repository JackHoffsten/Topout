import { defineConfig } from '@playwright/test';

// Layout and keyboard-viewport simulations run without the API or a database.
export default defineConfig({
  testDir: './browser-tests',
  workers: 1,
  use: { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL },
    },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
