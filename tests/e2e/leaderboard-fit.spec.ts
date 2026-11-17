import { expect, test, type Page } from '@playwright/test';
import { setLanguage } from './support/language';
import { nextFrames } from './support/layout';
import { mockApi } from './support/mockApi';

// SCRUM-148 QA154-02/03/05 with mocked server answers.
const ROWS = [
  ...[
    'Zuzka',
    'Maťko',
    'Medvedík77',
    'Ema',
    'Lucia',
    'Šimon',
    'Peter',
    'Dominik',
    'Hugo',
    'Kubko',
  ].map((nickname, i) => ({
    place: i + 1,
    nickname,
    bear: (i % 8) + 1,
    points: 1234 - i * 37,
    streak: 12 - i,
    frozen: i === 3,
    me: false,
  })),
  { place: 23, nickname: 'Miška', bear: 3, points: 140, streak: 2, frozen: false, me: false },
  { place: 24, nickname: 'Medvedík77', bear: 2, points: 200, streak: 365, frozen: true, me: true },
  { place: 25, nickname: 'Adam', bear: 5, points: 120, streak: 0, frozen: false, me: false },
];

const mock = (page: Page, points: number, streak: number, nickname = 'Brave Cub') =>
  mockApi(page, {
    nickname,
    points,
    streak,
    frozen: false,
    today: true,
    leaderboard: { rows: ROWS, gapBefore: 10 },
  });

test('QA154-03: 320x568 maths menu: Back and every bar item stay in one row', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const [points, streak] of [
    [40, 12],
    [1234, 12],
    [9999, 365],
  ]) {
    await page.unrouteAll();
    await mock(page, points, streak);
    await page.goto('/');
    await page.getByRole('button', { name: 'Maths', exact: true }).click();
    await expect(page.locator('.streak-chip')).toBeVisible();
    await nextFrames(page);
    const m = await page.evaluate(() => {
      const items = [
        ...document.querySelectorAll('.app-bar > :not(.app-bar-end), .app-bar-end > *'),
      ].map((e) => e.getBoundingClientRect());
      return {
        rows: Math.max(...items.map((r) => r.top)) - Math.min(...items.map((r) => r.top)),
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(m.rows, `${points}/${streak}`).toBeLessThan(20);
    expect(m.scroll, `${points}/${streak}`).toBeLessThanOrEqual(0);
  }
});

for (const [width, height, language] of [
  [320, 568, 'English'],
  [320, 568, 'Slovenčina'],
  [360, 640, 'Slovenčina'],
  [369, 700, 'English'],
  [390, 844, 'Slovenčina'],
] as const) {
  test(`QA154-02: 200% text at ${width}x${height} ${language}: the leaderboard table fits`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await mock(page, 135, 5);
    await page.goto('/');
    if (language !== 'English') {
      await setLanguage(page, language, { gear: 'name' });
    }
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.getByRole('button', { name: /^(Leaderboard|Rebríček),/ }).click();
    const dialog = page.getByRole('dialog', {
      name: language === 'English' ? 'Leaderboard' : 'Rebríček',
    });
    await expect(dialog.getByRole('table')).toBeVisible();
    const m = await dialog.evaluate((box) => {
      const table = box.querySelector('table')!.getBoundingClientRect();
      const content = box.querySelector('.leaderboard')!.getBoundingClientRect();
      const name = [...box.querySelectorAll('tbody tr:not(.leaderboard-gap) td:nth-child(2)')].map(
        (cell) => cell.getBoundingClientRect().width,
      );
      return { over: table.right - content.right, narrowest: Math.min(...name) };
    });
    expect(m.over).toBeLessThanOrEqual(1);
    // Nicknames never break down to single letters.
    expect(m.narrowest).toBeGreaterThan(40);
  });
}

test('QA154-05: the profile switch keeps keyboard focus after Space', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mock(page, 135, 5);
  await page.goto('/');
  await page.getByRole('button', { name: 'Your profile: Brave Cub' }).click();
  const box = page.getByRole('checkbox', { name: 'Show me on the leaderboard' });
  await box.focus();
  await page.keyboard.press('Space');
  await expect(box).not.toBeChecked();
  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(box).not.toHaveAttribute('aria-disabled');
  await expect(box).toBeFocused();
  await page.keyboard.press('Space');
  await expect(box).toBeChecked();
});
