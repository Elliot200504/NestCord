import { expect, test } from '@playwright/test';

import { historyOf, openSeededChannel, SEEDED, signInAndOpenApp } from './seeded-world';

test('walks from direct messages into a server channel and sees its history', async ({ page }) => {
  await signInAndOpenApp(page);
  await openSeededChannel(page, SEEDED.channel);

  await expect(page.getByRole('textbox', { name: `Message #${SEEDED.channel}` })).toBeVisible();

  // Seeded history, not an empty channel.
  await expect(historyOf(page, SEEDED.channel).getByRole('listitem').first()).toBeVisible();

  // A second channel in the same server swaps the history without a reload.
  await page
    .getByRole('navigation', { name: 'Channels' })
    .getByRole('link', { name: SEEDED.otherChannel, exact: true })
    .click();

  await expect(page.getByRole('heading', { name: SEEDED.otherChannel, exact: true })).toBeVisible();
  await expect(historyOf(page, SEEDED.otherChannel)).toBeVisible();
});
