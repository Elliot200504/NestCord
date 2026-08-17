import { defineConfig, devices } from '@playwright/test';

const WEB_URL = 'http://localhost:5173';

/**
 * End-to-end journeys (PLAN.MD §34, phase 10).
 *
 * These drive the real stack — Vite, NestJS and PostgreSQL — so they are not part of
 * `pnpm test`, which must stay runnable with nothing else on. Run them with
 * `pnpm --filter @nestcord/web test:e2e` against a database that has been seeded.
 *
 * Chromium only. A handful of journeys on one engine is what the testing rules ask
 * for; a browser matrix would cost minutes per run and catch nothing this app does.
 */
export default defineConfig({
  testDir: './e2e',

  // One worker, in order. Every spec signs in as the same seeded account, and the
  // login route is rate limited to 10 attempts a minute — parallel workers would
  // race each other into a 429. They also share one database.
  fullyParallel: false,
  workers: 1,

  // A retry is another login against that same limit, so only CI gets one.
  retries: process.env.CI ? 1 : 0,
  // Failing on `test.only` left behind in a commit.
  forbidOnly: Boolean(process.env.CI),

  reporter: 'list',

  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // The root script builds the shared packages first, then starts the API and the
    // web app together — the same command a developer runs by hand.
    command: 'pnpm dev',
    cwd: '../..',
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    // Cold start builds two packages before Vite or Nest even boots.
    timeout: 180_000,
  },
});
