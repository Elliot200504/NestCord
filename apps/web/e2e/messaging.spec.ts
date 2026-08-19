import { expect, test } from '@playwright/test';

import { historyOf, openWorldChannel, signInAndOpenApp, WORLD } from './world';

/**
 * The world is built once and reused, so each run leaves its messages behind in it.
 * They carry a stamp — otherwise a second run would match the first run's message and
 * pass without having sent anything.
 */
function uniqueText(label: string): string {
  return `${label} ${Date.now()}`;
}

test('sends a message and shows it in the channel', async ({ page }) => {
  await signInAndOpenApp(page);
  await openWorldChannel(page, WORLD.channel);

  const composer = page.getByRole('textbox', { name: `Message #${WORLD.channel}` });
  const history = historyOf(page, WORLD.channel);
  await expect(composer).toBeVisible();

  const plain = uniqueText('hello from playwright');
  await composer.fill(plain);
  await composer.press('Enter');

  await expect(history.getByText(plain)).toBeVisible();
  // The composer empties itself so the next message can be typed straight away.
  await expect(composer).toHaveValue('');

  // Markdown is rendered rather than shown as source (PLAN.MD §15).
  const stamp = Date.now();
  await composer.fill(`**bold${stamp}** and \`code${stamp}\``);
  await composer.press('Enter');

  await expect(history.getByRole('strong').filter({ hasText: `bold${stamp}` })).toBeVisible();
  await expect(history.getByRole('code').filter({ hasText: `code${stamp}` })).toBeVisible();
  await expect(history.getByText(`**bold${stamp}**`)).toHaveCount(0);
});
