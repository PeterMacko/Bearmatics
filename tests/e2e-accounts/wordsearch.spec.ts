import { expect, test } from '@playwright/test';
import { createAccount, uniqueName } from '../e2e/support/account';
import { ALL_DEVICES, DEVICE } from '../e2e/support/devices';
import { cell, findWord, gridWords, searchLayout, wrongPair } from '../e2e/support/wordsearch';

// SCRUM-241: Word search for a signed-in player (real server + local database): first-try points
// are saved like other lessons (x1, no multiplier row), and the lesson fits the defined devices
// with the badge, points, streak and a long nickname in the bar.

const badge = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Main controls' }).getByRole('button', { name: /badge/ });

async function start(page: import('@playwright/test').Page, level: 1 | 2 | 3, size: 5 | 10) {
  await page.getByRole('button', { name: 'Word search', exact: true }).click();
  await page.getByRole('radio', { name: new RegExp(`^Level ${level} `) }).check({ force: true });
  await page.getByRole('radio', { name: `${size} exercises`, exact: true }).check({ force: true });
  await page.getByRole('button', { name: /Let’s search/ }).click();
  await expect(page.locator('.ws-board')).toBeVisible();
}

test('signed in: a finished Word search lesson saves its first-try points (x1)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await createAccount(page, uniqueName('ws'), { nickname: 'Brave Cub' });
  await expect(badge(page)).toHaveAccessibleName('No bear badge yet, 0 points');
  await start(page, 1, 5);
  const words = await gridWords(page);
  const [a, b] = wrongPair(words);
  await cell(page, a).click();
  await cell(page, b).click();
  for (const w of words) await findWord(page, w);
  await page.getByRole('button', { name: /See how you did/ }).click();
  await expect(page.locator('.first-try')).toHaveText('First try, without hints 4 / 5');
  await expect(page.getByText('+4 points')).toBeVisible();
  await expect(badge(page)).toHaveAccessibleName('No bear badge yet, 4 points');
  // A second play the same day is still x1 (no multiplier row for Word search).
  await page.getByRole('button', { name: 'Play again' }).click();
  for (const w of await gridWords(page)) await findWord(page, w);
  await page.getByRole('button', { name: /See how you did/ }).click();
  await expect(page.getByText('+5 points')).toBeVisible();
  await expect(badge(page)).toHaveAccessibleName('No bear badge yet, 9 points');
});

test('signed in with a long nickname: the lesson fits every defined device before and after finding words', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await createAccount(page, uniqueName('wsfit'), { nickname: 'Honeybear123' });
  const results: string[] = [];
  for (const d of ALL_DEVICES.filter((x) => x !== DEVICE.phone369))
    for (const level of [1, 2] as const) {
      await page.setViewportSize({ width: d.width, height: d.height });
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Your profile: Honeybear123' })).toBeVisible();
      await start(page, level, 5);
      await page.waitForTimeout(150);
      const before = await searchLayout(page);
      const words = (await gridWords(page)).sort((x, y) => y.word.length - x.word.length);
      await findWord(page, words[0]);
      await findWord(page, words[1]);
      await page.waitForTimeout(150);
      const after = await searchLayout(page);
      for (const w of words.slice(2)) await findWord(page, w);
      await page.waitForTimeout(150);
      const solved = await searchLayout(page);
      for (const [name, m] of [
        ['start', before],
        ['two found', after],
        ['solved', solved],
      ] as const) {
        results.push(
          `${d.width}x${d.height} L${level} ${name}: page ${m.pageScroll} side ${m.sideScroll} cell ${m.cell} target ${m.target} list ${m.listVisible}`,
        );
        const where = `${d.name} L${level} ${name}`;
        expect(m.pageScroll, where).toBeLessThanOrEqual(1);
        expect(m.sideScroll, where).toBeLessThanOrEqual(0);
        expect(m.cell, where).toBeGreaterThanOrEqual(48);
        expect(m.target, where).toBeGreaterThanOrEqual(48);
        expect(m.listVisible, where).toBe(true);
      }
      await expect(page.locator('.ws-actions .answer-button')).toBeInViewport({ ratio: 1 });
    }
  console.log(results.join('\n'));
});
