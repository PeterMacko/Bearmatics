import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'honeyPot42';

let counter = 0;
/** A username (max 20 characters) that no other test run uses. */
export const uniqueName = (prefix: string) =>
  `${prefix}${(Date.now() % 1e7).toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(
    0,
    20,
  );

/** Creates a password account from the current screen (the Sign in button must be visible). */
export async function createAccount(
  page: Page,
  username: string,
  { email, nickname = 'Brave Cub' }: { email?: string; nickname?: string } = {},
) {
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeFocused();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Password again').fill(PASSWORD);
  if (email) await page.getByLabel('Email (optional)').fill(email);
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByRole('radio', { name: 'Panda' }).check();
  await page.getByLabel('A parent knows I am creating this account').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: `Your profile: ${nickname}` })).toBeVisible();
}
