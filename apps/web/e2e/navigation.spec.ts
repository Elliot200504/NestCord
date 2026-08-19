import { expect, test } from '@playwright/test';

import { historyOf, openWorldChannel, signInAndOpenApp, WORLD } from './world';

test('walks from direct messages into a server channel and sees its history', async ({ page }) => {
  await signInAndOpenApp(page);
  await openWorldChannel(page, WORLD.channel);

  await expect(page.getByRole('textbox', { name: `Message #${WORLD.channel}` })).toBeVisible();

  // History the setup put there, not an empty channel.
  await expect(historyOf(page, WORLD.channel).getByRole('listitem').first()).toBeVisible();

  // A second channel in the same server swaps the history without a reload.
  await page
    .getByRole('navigation', { name: 'Channels' })
    .getByRole('link', { name: WORLD.otherChannel, exact: true })
    .click();

  await expect(page.getByRole('heading', { name: WORLD.otherChannel, exact: true })).toBeVisible();
  await expect(historyOf(page, WORLD.otherChannel)).toBeVisible();
});
