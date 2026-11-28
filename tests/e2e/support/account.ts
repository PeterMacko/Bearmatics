import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'honeyPot42';

let counter = 0;
/** A username (max 20 characters) that no other test run uses. */
export const uniqueName = (prefix: string) =>
  `${prefix}${(Date.now() % 1e7).toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(
    0,
    20,
  );

/** Opens the course choice (in English) and waits for its Maths card. */
export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Maths', exact: true })).toBeVisible();
}

/**
 * Keeps a spec's players off the leaderboard (PATCH /api/me): every accounts spec shares one
 * local database, and the leaderboard spec expects its own 5-point player in the top ten.
 * `check: false` sends the same request without asserting its answer.
 */
export async function hideFromLeaderboard(page: Page, { check = true } = {}) {
  const status = await page.evaluate(
    async () =>
      (
        await fetch('/api/me', {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ leaderboard: false }),
        })
      ).status,
  );
  if (check) expect(status).toBe(200);
}

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
  // SCRUM-249: 4 random looks; take the second one.
  await page.getByRole('group', { name: 'Choose your bear' }).getByRole('radio').nth(1).check();
  await page.getByLabel('A parent knows I am creating this account').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: `Your profile: ${nickname}` })).toBeVisible();
}

/** SCRUM-281 / QA287-01: the profile windows ignore button presses in their first 600 ms. */
export const WINDOW_SETTLE_MS = 650;

/** Reads the open grown-up question ("5³ + 21 = ?") and types its answer. */
export async function answerGrownUp(page: Page, offset = 0) {
  const shown = (await page.locator('.grown-up-question').textContent()) ?? '';
  const match = /(\d)³ \+ (\d+) = \?/.exec(shown);
  expect(match, `grown-up question "${shown}"`).not.toBeNull();
  const answer = Number(match![1]) ** 3 + Number(match![2]) + offset;
  await page.locator('.grown-up-field input').fill(String(answer));
  return answer;
}

/**
 * Profile > Sign out (or Delete account): answers the grown-up question and presses the
 * window's button. The profile must be open. Names in English unless given.
 */
export async function leaveProfile(
  page: Page,
  kind: 'sign-out' | 'delete',
  names = { signOut: 'Sign out', del: 'Delete account', yes: 'Yes, delete forever' },
) {
  await page.getByRole('button', { name: kind === 'delete' ? names.del : names.signOut }).click();
  const window = page.getByRole('dialog');
  await expect(window).toBeVisible();
  await answerGrownUp(page);
  await page.waitForTimeout(WINDOW_SETTLE_MS);
  await window
    .getByRole('button', { name: kind === 'delete' ? names.yes : names.signOut, exact: true })
    .click();
  await expect(window).toHaveCount(0);
}
