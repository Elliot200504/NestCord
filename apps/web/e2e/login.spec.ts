import { expect, test } from '@playwright/test';

import { APP_HOME, TEST_ACCOUNT } from './world';

test.describe('signing in', () => {
  test('sends a signed-out visitor to the login page and back again', async ({ page }) => {
    await page.goto(APP_HOME);

    await expect(page).toHaveURL(/\/login\?redirect=/);
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();

    await page.getByLabel('Email').fill(TEST_ACCOUNT.email);
    await page.getByLabel('Password').fill(TEST_ACCOUNT.password);
    await page.getByRole('button', { name: 'Log in' }).click();

    // Straight back to where the guard interrupted them, not to a generic home page.
    await expect(page).toHaveURL(APP_HOME);
    await expect(page.getByRole('navigation', { name: 'Servers' })).toBeVisible();
  });

  test('keeps a visitor on the page when the password is wrong', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(TEST_ACCOUNT.email);
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });
});
