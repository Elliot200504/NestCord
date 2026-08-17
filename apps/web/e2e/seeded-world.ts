import { expect, type Page } from '@playwright/test';

/**
 * What `pnpm db:seed` puts in the database, named once so a spec reads as a journey
 * rather than a pile of string literals. If the seed changes, this file changes with
 * it and the specs do not.
 */
export const TEST_ACCOUNT = {
  email: 'test@nestcord.local',
  password: 'password123',
  username: 'testuser',
} as const;

export const SEEDED = {
  /** The server the test account owns a membership in, with three text channels. */
  server: 'NestCord HQ',
  channel: 'general',
  otherChannel: 'random',
} as const;

/** Where the app drops you after signing in. */
export const APP_HOME = '/app/@me/friends';

/**
 * Signs in over the API rather than through the login form.
 *
 * `page.request` shares the browser context's cookie jar, so the refresh cookie the
 * API sets lands exactly where a real login would put it, and the route guard turns
 * it into a session on the next navigation. The login form itself is a journey of its
 * own — driving it here as well would only make every other spec slower.
 *
 * Called per test, never cached to disk: refresh tokens rotate on use, and the API
 * revokes the whole session when it sees a replayed one.
 */
export async function signIn(page: Page): Promise<void> {
  const response = await page.request.post('/api/auth/login', {
    data: { email: TEST_ACCOUNT.email, password: TEST_ACCOUNT.password },
  });

  expect(
    response.ok(),
    `could not sign in as ${TEST_ACCOUNT.email} (HTTP ${response.status()}). ` +
      'These tests need the API running and the database seeded — try `pnpm db:seed`.',
  ).toBe(true);
}

/** Signs in and lands in the app, ready for a spec to navigate from. */
export async function signInAndOpenApp(page: Page): Promise<void> {
  await signIn(page);
  await page.goto(APP_HOME);
  await expect(page.getByRole('navigation', { name: 'Servers' })).toBeVisible();
}

/**
 * Clicks through the rail and the sidebar into one of the seeded server's channels —
 * the same two clicks a person makes, so the specs that need to be *in* a channel do
 * not each spell them out.
 */
export async function openSeededChannel(page: Page, channel: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Servers' })
    .getByRole('link', { name: SEEDED.server })
    .click();

  await page
    .getByRole('navigation', { name: 'Channels' })
    // Exact: the seed also puts a "General Voice" channel in this server.
    .getByRole('link', { name: channel, exact: true })
    .click();

  await expect(page.getByRole('heading', { name: channel, exact: true })).toBeVisible();
}

/** A channel's message history, by the accessible name the list carries. */
export function historyOf(page: Page, channel: string) {
  return page.getByRole('list', { name: `Messages in #${channel}` });
}
