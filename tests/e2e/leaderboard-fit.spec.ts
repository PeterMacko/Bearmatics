import { expect, test, type Page } from '@playwright/test';
import { setLanguage } from './support/language';
import { nextFrames } from './support/layout';
import { mockApi } from './support/mockApi';
import { OLD_BEARS } from '../../shared/bearLook';

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
    look: OLD_BEARS[(i % 8) + 1],
    points: 1234 - i * 37,
    streak: 12 - i,
    frozen: i === 3,
    me: false,
  })),
  {
    place: 23,
    nickname: 'Miška',
    look: { fur: 3, background: 2, head: 0, neck: 3, eyes: 0 },
    points: 140,
    streak: 2,
    frozen: false,
    me: false,
  },
  {
    place: 24,
    nickname: 'Medvedík77',
    look: { fur: 1, background: 1, head: 2, neck: 0, eyes: 0 },
    points: 200,
    streak: 365,
    frozen: true,
    me: true,
  },
  {
    place: 25,
    nickname: 'Adam',
    look: { fur: 5, background: 4, head: 4, neck: 0, eyes: 0 },
    points: 120,
    streak: 0,
    frozen: false,
    me: false,
  },
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

test('QA154-05 / SCRUM-281: the Leaderboard window keeps keyboard focus; Save is never disabled while saving', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mock(page, 135, 5);
  await page.goto('/');
  await page.getByRole('button', { name: 'Your profile: Brave Cub' }).click();
  const pencil = page.getByRole('button', { name: 'Change leaderboard' });
  await pencil.focus();
  await page.keyboard.press('Enter');
  const window = page.getByRole('dialog', { name: 'Leaderboard' });
  const box = window.getByRole('checkbox', { name: 'Show me on the leaderboard' });
  await expect(box).toBeFocused();
  await page.keyboard.press('Space');
  await expect(box).not.toBeChecked();
  await expect(box).toBeFocused();
  await page.keyboard.press('Space');
  await expect(box).toBeChecked();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await expect(window.getByRole('button', { name: 'Save', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  // The mocked server answers after 300 ms: meanwhile Save keeps focus (never disabled).
  const saving = await page.evaluate(() => {
    const focused = document.activeElement as HTMLButtonElement;
    return {
      text: focused.textContent,
      disabled: focused.disabled,
      busy: focused.getAttribute('aria-disabled'),
    };
  });
  expect(saving).toEqual({ text: 'Just a moment…', disabled: false, busy: 'true' });
  await expect(window).toHaveCount(0);
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
  await expect(pencil).toBeFocused();
  await expect(page.locator('.profile-row', { hasText: 'Leaderboard' })).toContainText('No');
});

// SCRUM-258: the bear badge column (Place | Player | Badge | Streak | Points) fits on every
// defined device with the longest nicknames, 3-4 digit points and a 365-day streak.
const LONG = [
  'Medvedíkovia_Šťastní',
  'Zuzanka.Veľkolepá_77',
  'Kráľovná-Matematiky1',
  'Ema',
  'Šimon Šampión Šikula',
  'Lucia',
  'Peter_Prvák_Najlepší',
  'Dominik',
  'Hugo-Hviezdoslav.123',
  'Kubko',
];
const BADGE_ROWS = [
  ...LONG.map((nickname, i) => ({
    place: i + 1,
    nickname,
    look: OLD_BEARS[(i % 8) + 1],
    points: [1234, 999, 378, 166, 120, 30, 29, 12, 5, 1][i],
    streak: 365 - i,
    frozen: i === 3,
    me: false,
  })),
  { ...ROWS[11], nickname: 'Medvedík_Odvážny_007', points: 999, streak: 365 },
  { ...ROWS[10], nickname: 'Miška_Malá_Múdra_123' },
  { ...ROWS[12], nickname: 'Adam_Andrej_Alžbeta1' },
];

for (const [width, height, language, big] of [
  [320, 568, 'Slovenčina', false],
  [320, 568, 'Slovenčina', true],
  [320, 568, 'English', true],
  [360, 640, 'Slovenčina', true],
  [390, 844, 'Slovenčina', true],
  [390, 844, 'English', false],
  [390, 844, 'Slovenčina', false],
  [360, 640, 'English', false],
  [568, 320, 'Slovenčina', false],
  [844, 390, 'English', false],
  [820, 1180, 'Slovenčina', false],
  [884, 1004, 'Slovenčina', true],
  [1366, 900, 'English', false],
  [1366, 900, 'Slovenčina', true],
] as const) {
  test(`SCRUM-258: badge column fits at ${width}x${height} ${language}${big ? ' 200% text' : ''}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await mockApi(page, {
      nickname: 'Medvedík_Odvážny_007',
      points: 999,
      streak: 365,
      frozen: true,
      today: false,
      leaderboard: { rows: BADGE_ROWS, gapBefore: 10 },
    });
    await page.goto('/');
    if (language !== 'English') await setLanguage(page, language, { gear: 'name' });
    if (big) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.getByRole('button', { name: /^(Leaderboard|Rebríček),/ }).click();
    const dialog = page.getByRole('dialog', {
      name: language === 'English' ? 'Leaderboard' : 'Rebríček',
    });
    await expect(dialog.getByRole('table')).toBeVisible();
    await expect(dialog.getByRole('columnheader').nth(2)).toHaveText(
      language === 'English' ? 'Badge' : 'Odznak',
    );
    await nextFrames(page);
    const m = await dialog.evaluate((box) => {
      const content = box.querySelector('.leaderboard')!.getBoundingClientRect();
      const table = box.querySelector('table')!.getBoundingClientRect();
      const rows = [...box.querySelectorAll('tbody tr:not(.leaderboard-gap)')];
      const textRect = (el: Element) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect();
      };
      const points = rows.map((r) => textRect(r.querySelector('td:last-child')!));
      const medals = rows
        .map((r) => [r.querySelector('td:nth-child(3)')!, r.querySelector('td:nth-child(3) svg')])
        .filter(([, svg]) => svg)
        .map(([td, svg]) => ({
          td: td!.getBoundingClientRect(),
          svg: svg!.getBoundingClientRect(),
        }));
      // Space between the streak number and the points (QA265-02).
      const numberGap = Math.min(
        ...rows
          .filter((r) => r.querySelector('td:nth-child(4) .leaderboard-streak'))
          .map(
            (r) =>
              textRect(r.querySelector('td:last-child')!).left -
              textRect(r.querySelector('td:nth-child(4) .leaderboard-streak')!).right,
          ),
      );
      return {
        numberGap,
        badgeWord: box.querySelector('th:nth-child(3) .th-long')!.getBoundingClientRect().width,
        over: table.right - content.right,
        pointsOut: Math.max(...points.map((p) => p.right - content.right)),
        medals: medals.length,
        medalOut: Math.max(
          ...medals.map(({ td, svg }) => Math.max(td.left - svg.left, svg.right - td.right)),
        ),
        smallest: Math.min(...medals.map(({ svg }) => svg.width)),
        pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        narrowest: Math.min(
          ...rows.map((r) => r.querySelector('td:nth-child(2)')!.getBoundingClientRect().width),
        ),
      };
    });
    expect(m.over, 'table wider than the window').toBeLessThanOrEqual(1);
    expect(m.pointsOut, 'Points cut off').toBeLessThanOrEqual(1);
    expect(m.numberGap, 'streak and points too close').toBeGreaterThanOrEqual(4);
    expect(m.pageScroll, 'horizontal page scroll').toBeLessThanOrEqual(0);
    // 1234, 999, 378, 166, 120, 30 points and the three bottom rows have a badge.
    expect(m.medals).toBe(9);
    expect(m.medalOut, 'medal outside its cell').toBeLessThanOrEqual(0.5);
    expect(m.smallest, 'medal too small to read').toBeGreaterThanOrEqual(21);
    expect(m.narrowest).toBeGreaterThan(40);
    // Peter's header word stays visible on ordinary phones and larger (plain medal only on
    // 320/360 px phones, where the bears hide too, and at 200% text).
    if (!big && width >= 390) expect(m.badgeWord, 'Badge header word').toBeGreaterThan(20);
  });
}
