import { expect, test, type Page } from '@playwright/test';
import {
  createAccount as createPasswordAccount,
  leaveProfile,
  uniqueName,
} from '../e2e/support/account';
import { BADGE_DEVICES, DEVICE } from '../e2e/support/devices';
import { answerFor } from '../e2e/support/maths';
import { horizontalOverflow, nextFrames } from '../e2e/support/layout';

// SCRUM-117: points and the bear badge for a signed-in player (real server + local database).
async function createAccount(page: Page, nickname = 'Brave Cub') {
  await page.goto('/');
  await createPasswordAccount(page, uniqueName('pts'), { nickname });
}

async function playMaths(page: Page, size: 5 | 10, wrongFirst = false) {
  await page.getByRole('button', { name: 'Maths', exact: true }).click();
  await page.getByRole('radio', { name: `${size} exercises`, exact: true }).check();
  await page.getByRole('button', { name: 'Let’s count' }).click();
  for (let i = 0; i < size; i++) {
    const value = await answerFor(page);
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
    await page.getByRole('textbox').fill(String(await answerFor(page)));
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
  await leaveProfile(page, 'delete');
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
const DEVICES = BADGE_DEVICES;

test('badge in the app bar at the defined devices', async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  await createAccount(page);
  for (const { width, height } of DEVICES) {
    await page.setViewportSize({ width, height });
    for (const screen of ['courses', 'maths', 'lesson']) {
      await page.goto('/');
      if (screen !== 'courses')
        await page.getByRole('button', { name: 'Maths', exact: true }).click();
      if (screen === 'lesson') await page.getByRole('button', { name: 'Let’s count' }).click();
      // The profile is in the bar on every screen, lessons too (Peter).
      await expect(page.getByRole('button', { name: /^Your profile/ })).toBeVisible();
      if (screen === 'lesson' && height <= 340) {
        // 568x320 lesson: the left column holds only Back, profile and settings.
        await expect(badge(page)).toBeHidden();
        continue;
      }
      await expect(badge(page)).toBeVisible();
      // The streak arrives with the points; let the bar clearance settle (two frames).
      await expect(page.locator('.streak-chip')).toHaveCount(1);
      await nextFrames(page);
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

test('QA124-04: a long nickname plus the badge never cover the menu heading (742x702, 884x600)', async ({
  page,
}) => {
  await createAccount(page, 'W'.repeat(20));
  for (const [width, height] of [
    [742, 702],
    [884, 600],
    [1280, 520],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('button', { name: 'Maths', exact: true }).click();
    await expect(badge(page)).toBeVisible();
    await expect(page.locator('.streak-chip')).toHaveCount(1);
    await nextFrames(page);
    const hits = await page.evaluate(() => {
      const bar = [...document.querySelectorAll('.app-bar-end > *')].map((el) =>
        el.getBoundingClientRect(),
      );
      const found: string[] = [];
      for (const el of document.querySelectorAll('.menu-heading .eyebrow, .menu-heading h2')) {
        const range = document.createRange();
        range.selectNodeContents(el);
        for (const r of range.getClientRects())
          for (const b of bar)
            if (b.left < r.right && r.left < b.right && b.top < r.bottom && r.top < b.bottom)
              found.push(el.textContent ?? '');
      }
      return found;
    });
    expect(hits, `${width}x${height}`).toEqual([]);
  }
});

test('Peter review: the signed-in summary needs no scrolling on phones', async ({ page }) => {
  await createAccount(page);
  for (const [width, height] of [
    [390, 844],
    [369, 700],
    [360, 640],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await playMaths(page, 5);
    await expect(page.locator('.summary-points .badge-meter')).toBeVisible();
    await expect(page.getByText('Every little step helps your brain grow.')).toHaveCount(0);
    const scroll = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    expect(scroll, `${width}x${height}`).toBeLessThanOrEqual(0);
  }
});

test('QA124-05/06: 320x568 bar stays one row with 4-digit points; summary has no scroll', async ({
  page,
}) => {
  await createAccount(page, 'Twelve chars');
  await page.route('**/api/progress', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ points: 1500 }) }),
  );
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Maths', exact: true }).click();
  await expect(badge(page)).toHaveAccessibleName('Bear badge 25, 1500 points');
  const rows = await page.evaluate(() => {
    const tops = [...document.querySelectorAll('.app-bar > *, .app-bar-end > *')].map((el) =>
      Math.round(el.getBoundingClientRect().top),
    );
    return Math.max(...tops) - Math.min(...tops);
  });
  expect(rows).toBeLessThan(20);
  await page.unroute('**/api/progress');
  await page.goto('/');
  await playMaths(page, 5);
  await expect(page.locator('.summary-points .badge-meter')).toBeVisible();
  await page.waitForTimeout(3500);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    ),
  ).toBeLessThanOrEqual(0);
});

// SCRUM-118: the streak next to the badge.
const streak = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Main controls' })
    .getByRole('img', { name: /^(Streak|Séria|No streak)/ });

test('streak: first finished lesson gives 1 day; bar fits at the defined devices (also frozen)', async ({
  page,
}) => {
  test.setTimeout(120_000); // 15 devices x 2 screens x 2 states
  await createAccount(page, 'Twelve chars');
  await expect(
    page.getByRole('img', { name: 'No streak yet. Finish a lesson to start one' }),
  ).toBeVisible();
  await playMaths(page, 5);
  // Beside the check mark: 0 for a second, then 1 with a burning flame.
  const summaryStreak = page.locator('.summary-streak');
  await expect(summaryStreak).toHaveAccessibleName('Streak 1 day');
  await expect(summaryStreak.locator('.summary-streak-days')).toHaveText('1');
  await expect(streak(page)).toHaveAccessibleName('Streak 1 day');
  for (const frozen of [false, true]) {
    if (frozen)
      await page.route('**/api/progress', (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ points: 1500, streak: 12, frozen: true }),
        }),
      );
    for (const { width, height } of [...DEVICES, DEVICE.phone369]) {
      await page.setViewportSize({ width, height });
      for (const screen of ['courses', 'maths']) {
        await page.goto('/');
        if (screen === 'maths')
          await page.getByRole('button', { name: 'Maths', exact: true }).click();
        await expect(streak(page)).toBeVisible();
        const where = `${width}x${height} ${screen} frozen=${frozen}`;
        const m = await page.evaluate(() => {
          const items = [
            ...document.querySelectorAll('.app-bar > :not(.app-bar-end), .app-bar-end > *'),
          ].map((el) => el.getBoundingClientRect());
          const root = document.documentElement;
          const landscape = matchMedia(
            '(max-height: 500px) and (max-width: 950px) and (orientation: landscape)',
          ).matches;
          const overlap = items.some((a, i) =>
            items.some(
              (b, j) =>
                j > i &&
                a.left < b.right - 0.5 &&
                b.left < a.right - 0.5 &&
                a.top < b.bottom - 0.5 &&
                b.top < a.bottom - 0.5,
            ),
          );
          const tops = items.map((r) => r.top);
          return {
            oneRow: landscape || Math.max(...tops) - Math.min(...tops) < 20,
            overlap,
            inside: items.every(
              (r) => r.left >= 0 && r.right <= root.clientWidth && r.bottom <= root.clientHeight,
            ),
            sideScroll: root.scrollWidth - root.clientWidth,
          };
        });
        expect(m, where).toEqual({ oneRow: true, overlap: false, inside: true, sideScroll: 0 });
      }
    }
  }
});

test('QA131-03: at 568x320 every offer and confirmation button is in view', async ({ page }) => {
  await createAccount(page);
  const state = { points: 135, streak: 12, frozen: true, today: false };
  await page.route('**/api/progress', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) }),
  );
  await page.route('**/api/progress/lessons/finish', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ...body, ...state, offer: { streak: 12, missed: 2, cost: 14 } }),
    });
  });
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto('/');
  await playMaths(page, 5);
  const dialog = page.getByRole('dialog', { name: 'Frozen streak' });
  await expect(dialog).toBeVisible({ timeout: 8000 });
  for (const name of ['Unlock', 'No thanks'])
    await expect(dialog.getByRole('button', { name })).toBeInViewport({ ratio: 1 });
  await page.waitForTimeout(700);
  await dialog.getByRole('button', { name: 'Unlock' }).click();
  for (const name of ['Yes', 'Back'])
    await expect(dialog.getByRole('button', { name })).toBeInViewport({ ratio: 1 });
});

test('frozen streak text shows on tablets, ice only on phones', async ({ page }) => {
  await createAccount(page);
  await page.route('**/api/progress', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ points: 135, streak: 12, frozen: true, today: false }),
    }),
  );
  for (const [width, height, text] of [
    [820, 1180, true],
    [390, 844, false],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('.streak-warm-up')).toBeVisible({ visible: text });
  }
});

// SCRUM-148: leaderboard against the real server.
test('leaderboard: two players see each other; switch off hides me; window fits the devices', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const first = await (await browser.newContext()).newPage();
  await createAccount(first, 'Board One');
  await playMaths(first, 5);
  const second = await (await browser.newContext()).newPage();
  await createAccount(second, 'Board Two');
  await playMaths(second, 5, true);
  const open = async (page: Page) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Main controls' })
      .getByRole('button', { name: /^Leaderboard,/ })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Leaderboard' });
    await expect(dialog.getByRole('table')).toBeVisible();
    return dialog;
  };
  let dialog = await open(second);
  await expect(dialog.getByRole('row', { name: /Board One/ })).toBeVisible();
  // SCRUM-249: each row shows that player's look (its parts come from the server).
  const firstLook = await first.locator('.app-bar .account-button svg').getAttribute('data-look');
  await expect(
    dialog.getByRole('row', { name: /Board One/ }).locator('svg.bear-icon'),
  ).toHaveAttribute('data-look', firstLook!);
  await expect(dialog.locator('tr.me')).toContainText('Board Two');
  // The first player switches it off (SCRUM-281: in the Leaderboard window, saved on Save):
  // gone for the second at once.
  await first.getByRole('button', { name: 'Your profile: Board One' }).click();
  await first.getByRole('button', { name: 'Change leaderboard' }).click();
  await first.getByRole('checkbox', { name: 'Show me on the leaderboard' }).uncheck();
  await first.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first.getByRole('dialog')).toHaveCount(0);
  await expect(first.locator('.profile-row', { hasText: 'Leaderboard' })).toContainText('No');
  dialog = await open(second);
  await expect(dialog.getByRole('row', { name: /Board One/ })).toHaveCount(0);
  for (const { width, height } of [...DEVICES, DEVICE.phone369]) {
    await second.setViewportSize({ width, height });
    dialog = await open(second);
    const where = `${width}x${height}`;
    const box = (await dialog.boundingBox())!;
    expect(box.x, where).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, where).toBeLessThanOrEqual(width + 0.5);
    expect(await horizontalOverflow(second), where).toBeLessThanOrEqual(0);
    await second.keyboard.press('Escape');
  }
});
