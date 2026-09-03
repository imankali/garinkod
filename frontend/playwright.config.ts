import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * `PLAYWRIGHT_BASE_URL` points the suite at an already-running stack (the usual
 * local case). When it is unset — as in CI — Playwright starts the Vite preview
 * server itself, so the pipeline needs no bespoke orchestration.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const usesExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // A flaky run is retried in CI but never locally, where a failure should be
  // reproduced rather than papered over.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list'], ['junit', { outputFile: 'playwright-report/results.xml' }]]
    : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  },
  projects: [
    // Chromium runs the exhaustive behavioural, accessibility and explicit
    // multi-viewport suite. Other engines run routing/navigation smoke tests;
    // this retains compatibility coverage without multiplying 120+ tests by 6.
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'desktop-firefox',
      testMatch: /public-routes\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      // WebKit stands in for Safari on macOS.
      name: 'desktop-webkit',
      testMatch: /public-routes\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: /(?:public-routes|navigation)\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      testMatch: /(?:public-routes|navigation)\.spec\.ts/,
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'tablet',
      testMatch: /public-routes\.spec\.ts/,
      use: { ...devices['iPad (gen 7)'] },
    },
  ],
  webServer: usesExternalServer
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 5173',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
