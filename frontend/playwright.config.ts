import { defineConfig } from '@playwright/test';

if (!process.env.EX08_BROWSER_RUN_DIR || !process.env.EX08_BROWSER_BASE_URL) {
  throw new Error('Use npm run test:browser: it verifies ownership and starts isolated real services.');
}

export default defineConfig({
  testDir: './e2e/specs',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: `${process.env.EX08_BROWSER_RUN_DIR}/playwright-output`,
  reporter: [['./e2e/sanitized-reporter.mjs']],
  use: {
    baseURL: process.env.EX08_BROWSER_BASE_URL,
    browserName: 'chromium',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
});
