import { expect, test } from '@playwright/test';

import { signInAndOpenApp } from './seeded-world';

/** The seed makes Ada an accepted friend and Linus an incoming request. */
const FRIEND = 'Ada';
const REQUESTER = 'linus';

test('opens the friends page and switches between its tabs', async ({ page }) => {
  await signInAndOpenApp(page);

  // Signing in lands on the friends page already — it is the app's home.
  await expect(page.getByRole('heading', { name: 'Friends' })).toBeVisible();

  const filters = page.getByRole('navigation', { name: 'Friends filters' });
  await expect(filters.getByRole('button', { name: 'Online' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await filters.getByRole('button', { name: 'All' }).click();
  await expect(page.getByText(FRIEND, { exact: true })).toBeVisible();

  // A request waiting on you is reachable, and its accept action is offered.
  await filters.getByRole('button', { name: /^Pending/ }).click();
  await expect(page.getByRole('button', { name: `Accept ${REQUESTER}` })).toBeVisible();
});
