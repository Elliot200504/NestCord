import { expect, type Page } from '@playwright/test';

/**
 * The only thing `pnpm db:seed` creates. Everything else these journeys need is
 * built over the API by `world.setup.ts` before they run.
 */
export const TEST_ACCOUNT = {
  email: 'test@nestcord.local',
  password: 'password123',
  username: 'testuser',
} as const;

/**
 * The world the setup project builds, named once so a spec reads as a journey
 * rather than a pile of string literals.
 *
 * The names are fixed rather than stamped per run, because the setup only creates
 * what is missing. A second run finds the world already there and does nothing.
 */
export const WORLD = {
  server: 'Playwright',
  /** Created with the server, so the setup never has to make it. */
  channel: 'general',
  otherChannel: 'random',
  /** An accepted friend, and someone whose request is still waiting. */
  friend: 'e2e.friend',
  requester: 'e2e.requester',
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
      'These tests need the API running and the account created — try `pnpm db:seed`.',
  ).toBe(true);
}

/** Signs in and lands in the app, ready for a spec to navigate from. */
export async function signInAndOpenApp(page: Page): Promise<void> {
  await signIn(page);
  await page.goto(APP_HOME);
  await expect(page.getByRole('navigation', { name: 'Servers' })).toBeVisible();
}

/**
 * Clicks through the rail and the sidebar into one of the world's channels — the
 * same two clicks a person makes, so the specs that need to be *in* a channel do
 * not each spell them out.
 */
export async function openWorldChannel(page: Page, channel: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Servers' })
    .getByRole('link', { name: WORLD.server })
    .click();

  await page
    .getByRole('navigation', { name: 'Channels' })
    // Exact: "general" is a substring of nothing here today, but a channel added
    // to the world later should not silently start matching.
    .getByRole('link', { name: channel, exact: true })
    .click();

  await expect(page.getByRole('heading', { name: channel, exact: true })).toBeVisible();
}

/** A channel's message history, by the accessible name the list carries. */
export function historyOf(page: Page, channel: string) {
  return page.getByRole('list', { name: `Messages in #${channel}` });
}
