import { expect, test, type Page } from '@playwright/test';

// SCRUM-117: points and the bear badge for a signed-in player (real server + local database).
const PASSWORD = 'honeyPot42';
let counter = 0;
const uniqueName = () =>
  `pts${(Date.now() % 1e7).toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(
    0,
    20,
  );

async function createAccount(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Username').fill(uniqueName());
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Password again').fill(PASSWORD);
  await page.getByLabel('Nickname').fill('Brave Cub');
  await page.getByRole('radio', { name: 'Panda' }).check();
  await page.getByLabel('A parent knows I am creating this account').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Your profile: Brave Cub' })).toBeVisible();
}

async function answer(page: Page): Promise<number> {
  return page.locator('.equation').evaluate((el) => {
    const terms = [...el.querySelectorAll('[data-term]')];
    const blank = terms.findIndex((term) => term.querySelector('input'));
    const [a, b, c] = terms.map((term) => Number(term.textContent));
    const op = el.querySelector('.operator')?.textContent?.trim();
    const inverse = (x: number, y: number, add: boolean) => (add ? x - y : x + y);
    if (op === '+' || op === '−' || op === '-') {
      const add = op === '+';
      if (blank === 2) return add ? a + b : a - b;
      if (blank === 0) return inverse(c, b, add);
      return add ? c - a : a - c;
    }
    const times = op === '×';
    if (blank === 2) return times ? a * b : a / b;
    if (blank === 0) return times ? c / b : c * b;
    return times ? c / a : a / c;
  });
}

async function playMaths(page: Page, size: 5 | 10, wrongFirst = false) {
  await page.getByRole('button', { name: 'Maths', exact: true }).click();
  await page.getByRole('radio', { name: `${size} exercises`, exact: true }).check();
  await page.getByRole('button', { name: 'Let’s count' }).click();
  for (let i = 0; i < size; i++) {
    const value = await answer(page);
    if (wrongFirst && i === 0) {
      await page.getByRole('textbox').fill(String(value + 1));
      await page.getByRole('button', { name: 'Check answer', exact: true }).click();
    }
    await page.getByRole('textbox').fill(String(value));
    await page.getByRole('button', { name: 'Check answer', exact: true }).click();
    const next = page.getByRole('button', {
      name: /^(Next exercise|See how you did|Review tricky ones)$/,
    });
    await next.click();
  }
  if (wrongFirst) {
    await page.getByRole('textbox').fill(String(await answer(page)));
    await page.getByRole('button', { name: 'Check answer', exact: true }).click();
    await page.getByRole('button', { name: 'See how you did' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Look how far you’ve come!' })).toBeVisible();
}

const badge = (page: Page) =>
  page.getByRole('navigation', { name: 'Main controls' }).getByRole('button', { name: /badge/ });

test('a finished lesson adds its first-try points once; leaving early adds nothing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await createAccount(page);
  await expect(badge(page)).toHaveAccessibleName('No bear badge yet, 0 points');
  await playMaths(page, 5, true);
  await expect(page.getByText('+4 points')).toBeVisible();
  await expect(page.getByText('26 points to go to bear badge 1')).toBeVisible();
  await expect(badge(page)).toHaveAccessibleName('No bear badge yet, 4 points');
  // Play again saves a new lesson; leaving one early saves nothing.
  await page.getByRole('button', { name: 'Play again' }).click();
  await page.getByRole('button', { name: 'Choose level' }).click();
  await page.reload();
  await expect(badge(page)).toHaveAccessibleName('No bear badge yet, 4 points');
  // The details panel.
  await badge(page).click();
  const dialog = page.getByRole('dialog', { name: 'Your bear badge' });
  await expect(dialog).toContainText('No badge yet');
  await expect(dialog).toContainText('4 points');
  await page.keyboard.press('Escape');
  await expect(badge(page)).toBeFocused();
  // Deleting the account removes the points: a new account starts at 0.
  await page.getByRole('button', { name: 'Your profile: Brave Cub' }).click();
  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.getByRole('button', { name: 'Yes, delete forever' }).click();
  await expect(badge(page)).toHaveCount(0);
});

test('signed out: no badge, the summary invites to sign in', async ({ page }) => {
  await page.goto('/');
  await playMaths(page, 5);
  await expect(page.getByText('Sign in to collect points')).toBeVisible();
  await expect(badge(page)).toHaveCount(0);
});

// Defined devices: the badge sits in the bar (left bar on short landscape phones), 48 px,
// never over the screen's text, on the menus and in a lesson.
const DEVICES: [number, number][] = [
  [390, 844],
  [360, 640],
  [320, 568],
  [844, 390],
  [568, 320],
  [820, 1180],
  [1180, 820],
  [884, 1004],
  [884, 600],
  [1280, 520],
  [733, 500],
  [1366, 900],
];

test('badge in the app bar at the defined devices', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await createAccount(page);
  for (const [width, height] of DEVICES) {
    await page.setViewportSize({ width, height });
    for (const screen of ['courses', 'maths', 'lesson']) {
      await page.goto('/');
      if (screen !== 'courses')
        await page.getByRole('button', { name: 'Maths', exact: true }).click();
      if (screen === 'lesson') await page.getByRole('button', { name: 'Let’s count' }).click();
      await expect(badge(page)).toBeVisible();
      const where = `${width}x${height} ${screen}`;
      const m = await page.evaluate(() => {
        const button = document.querySelector('.badge-button')!.getBoundingClientRect();
        const texts = [...document.querySelectorAll('main h2, main p, main label, main button')];
        const hits = texts.filter((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...range.getClientRects()].some(
            (r) =>
              r.width > 0 &&
              button.left < r.right - 0.5 &&
              r.left < button.right - 0.5 &&
              button.top < r.bottom - 0.5 &&
              r.top < button.bottom - 0.5,
          );
        });
        const root = document.documentElement;
        return {
          w: button.width,
          h: button.height,
          inside:
            button.left >= 0 &&
            button.top >= 0 &&
            button.right <= root.clientWidth &&
            button.bottom <= root.clientHeight,
          hits: hits.map((el) => el.className || el.tagName),
          sideScroll: root.scrollWidth - root.clientWidth,
        };
      });
      expect(m.hits, where).toEqual([]);
      expect(m.inside, where).toBe(true);
      expect(Math.min(m.w, m.h), where).toBeGreaterThanOrEqual(48);
      expect(m.sideScroll, where).toBeLessThanOrEqual(0);
    }
  }
  await context.close();
});
