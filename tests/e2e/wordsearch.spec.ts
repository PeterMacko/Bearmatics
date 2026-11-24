import { expect, test, type Page } from '@playwright/test';
import { ALL_DEVICES, DEVICE } from './support/devices';
import {
  cell,
  findWord,
  gridWords,
  searchLayout,
  startSearch,
  wrongPair,
} from './support/wordsearch';

// SCRUM-241: Word search (Osemsmerovka) on the defined devices: fit before and after finding
// words, selection, wrong-pair flash, word playback, level 2 speakers, lesson sizes, keyboard.

/** Records which word file each play() uses (window.played). */
async function recordPlays(page: Page) {
  await page.addInitScript(() => {
    const played: string[] = [];
    (window as unknown as { played: string[] }).played = played;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      played.push(decodeURIComponent(this.src.split('/').pop()!.replace('.mp3', '')));
      setTimeout(() => this.dispatchEvent(new Event('ended')), 300);
      return Promise.resolve();
    };
  });
}
const played = (page: Page) =>
  page.evaluate(() => (window as unknown as { played: string[] }).played);

/** Fit numbers must hold: no page or sideways scroll, 48 px cells and targets, list in view. */
function expectFit(m: Awaited<ReturnType<typeof searchLayout>>, where: string) {
  expect(m.pageScroll, `${where} page scroll`).toBeLessThanOrEqual(1);
  expect(m.sideScroll, `${where} sideways scroll`).toBeLessThanOrEqual(0);
  expect(m.cell, `${where} cell`).toBeGreaterThanOrEqual(48);
  expect(m.target, `${where} smallest target`).toBeGreaterThanOrEqual(48);
  expect(m.listVisible, `${where} word list in view`).toBe(true);
  expect(m.chipOverflow, `${where} words fit their buttons`).toBe(0);
}

const FIT_DEVICES = ALL_DEVICES.filter((d) => d !== DEVICE.phone369);
for (const level of [1, 2, 3] as const)
  for (const d of FIT_DEVICES)
    test(`level ${level} fits ${d.name} ${d.width}x${d.height} before and after finding words`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: d.width, height: d.height },
        hasTouch: d.touch,
      });
      const page = await context.newPage();
      await startSearch(page, { level, lang: level === 2 ? 'sk' : 'en' });
      await page.waitForTimeout(200);
      const start = await searchLayout(page);
      expectFit(start, 'start');
      const words = await gridWords(page);
      // Longest words first: the level 2 list shows them, the largest growth.
      words.sort((a, b) => b.word.length - a.word.length);
      await findWord(page, words[0]);
      await findWord(page, words[1]);
      await page.waitForTimeout(200);
      const two = await searchLayout(page);
      expectFit(two, 'two found');
      for (const w of words.slice(2)) await findWord(page, w);
      await page.waitForTimeout(200);
      const solved = await searchLayout(page);
      expectFit(solved, 'solved');
      // The numbers for the report (test output).
      console.log(
        `[ws-fit] ${d.width}x${d.height} L${level} ${level === 2 ? 'sk' : 'en'} ` +
          JSON.stringify({ start, two, solved }),
      );
      await expect(page.locator('.ws-actions .answer-button')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('.ws-actions .answer-button')).toBeFocused();
      await context.close();
    });

// 200% text: cells and targets stay 48 px, nothing runs off sideways (the page may scroll).
for (const d of [DEVICE.phone, DEVICE.smallPhone])
  for (const level of [1, 2] as const)
    test(`200% text level ${level} at ${d.width}x${d.height}: 48 px cells, no sideways scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: d.width, height: d.height });
      await startSearch(page, { level });
      await page.addStyleTag({ content: 'html{font-size:200% !important}' });
      await page.waitForTimeout(300);
      const words = await gridWords(page);
      await findWord(page, words[0]);
      await page.waitForTimeout(200);
      const m = await searchLayout(page);
      expect(m.sideScroll).toBeLessThanOrEqual(0);
      expect(m.cell).toBeGreaterThanOrEqual(48);
      expect(m.target).toBeGreaterThanOrEqual(48);
      expect(m.boardRight).toBeLessThanOrEqual(d.width);
    });

test('level 1: tapping a listed word plays it; a found word plays again and is struck through', async ({
  page,
}) => {
  await recordPlays(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await startSearch(page, { level: 1 });
  const list = page.getByRole('list', { name: 'Words to find' });
  const first = list.getByRole('button').first();
  const word = (await first.textContent())!;
  await first.click();
  expect(await played(page)).toEqual([word.toLowerCase()]);
  await expect(first).toHaveAttribute('data-playing', 'true');
  const target = (await gridWords(page)).find((w) => w.word.toUpperCase() === word)!;
  await findWord(page, target);
  expect(await played(page)).toEqual([word.toLowerCase(), word.toLowerCase()]);
  await expect(list.getByRole('button', { name: `${word}, found` })).toBeVisible();
  await expect(list.locator('s')).toHaveText([word]);
  await expect(page.getByRole('status')).toHaveText(`Well done, you found ${word}!`);
  await expect(cell(page, target.first)).toHaveAttribute('data-word', '0');
});

test('level 2: speakers play the words; a found word appears struck through beside its speaker', async ({
  page,
}) => {
  await recordPlays(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await startSearch(page, { level: 2 });
  const speakers = page.getByRole('list', { name: 'Words to find' }).getByRole('button');
  await expect(speakers).toHaveCount(5);
  for (let i = 0; i < 5; i++) await expect(speakers.nth(i)).toHaveAccessibleName(`Word ${i + 1}`);
  await speakers.nth(2).click();
  const spoken = (await played(page)).at(-1)!;
  await expect(speakers.nth(2)).toHaveAttribute('data-playing', 'true');
  await expect(page.locator('.ws-revealed')).toHaveCount(0);
  const words = await gridWords(page);
  await findWord(
    page,
    words.find((w) => w.word.toLowerCase() === spoken)!,
  );
  expect((await played(page)).at(-1)).toBe(spoken);
  await expect(speakers.nth(2)).toHaveAccessibleName(`Word 3: ${spoken.toUpperCase()}, found`);
  await expect(page.locator('.ws-revealed')).toHaveText([spoken.toUpperCase()]);
  await expect(page.locator('.ws-revealed')).toHaveCSS('text-decoration-line', 'line-through');
});

// QA247-01: at 320x568 with 200% text the Slovak "Ďalšia osemsmerovka" did not fit the Next
// button in the top-right corner (74 px of "osemsmerovka" stuck out, the page scrolled
// sideways); at 742x702 the same word widened the narrow words' column by 47 px (19 px sideways
// scroll). Every word of the label must sit inside the button and nothing may scroll sideways.
for (const [width, height, text, lang] of [
  [320, 568, 200, 'sk'],
  [320, 568, 200, 'en'],
  [742, 702, 100, 'sk'],
] as const)
  test(`${text}% text ${lang.toUpperCase()} ${width}x${height} solved: Next keeps its label inside, no sideways scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await startSearch(page, { level: 1, size: 10, lang });
    if (text === 200) await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await page.waitForTimeout(300);
    for (const w of await gridWords(page)) await findWord(page, w);
    const next = page.locator('.ws-actions .answer-button');
    await expect(next).toHaveText(lang === 'sk' ? 'Ďalšia osemsmerovka →' : 'Next word search →');
    await page.waitForTimeout(300);
    const m = await searchLayout(page);
    const label = await next.evaluate((button) => {
      const range = document.createRange();
      range.selectNodeContents(button);
      const words = range.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      return {
        left: words.left - box.left,
        right: box.right - words.right,
        scroll: button.scrollWidth - button.clientWidth,
      };
    });
    console.log(`[ws-next] ${width}x${height} ${text}% ${lang} ` + JSON.stringify({ ...m, label }));
    expect(m.sideScroll, 'sideways scroll').toBeLessThanOrEqual(0);
    expect(label.scroll, 'label overflow').toBeLessThanOrEqual(0);
    expect(label.left, 'label inside on the left').toBeGreaterThanOrEqual(0);
    expect(label.right, 'label inside on the right').toBeGreaterThanOrEqual(0);
    expect(m.chipOverflow, 'words fit their buttons').toBe(0);
    expect(m.cell).toBeGreaterThanOrEqual(48);
    await next.scrollIntoViewIfNeeded();
    await expect(next).toBeInViewport({ ratio: 1 });
    await expect(next).toBeFocused();
  });

test('Next below the lesson goes back to its place when the language or the window changes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 742, height: 702 });
  await startSearch(page, { level: 1, size: 10, lang: 'sk' });
  for (const w of await gridWords(page)) await findWord(page, w);
  const section = page.locator('.wordsearch-practice');
  const next = page.locator('.ws-actions .answer-button');
  await expect(section).toHaveAttribute('data-next-below', 'true');
  await expect(page.locator('.ws-side .ws-actions')).toHaveCount(0);
  await expect(next).toBeFocused();
  // English "Next word search" fits the words' column: back in place.
  await page.locator('.settings-button').click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(next).toHaveText('Next word search →');
  await expect(section).not.toHaveAttribute('data-next-below');
  await expect(page.locator('.ws-side .ws-actions')).toHaveCount(1);
  // Slovak again: below; a wider window gives the column room: back in place.
  await page.locator('.settings-button').click();
  await page.getByRole('button', { name: 'Slovenčina', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(section).toHaveAttribute('data-next-below', 'true');
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(section).not.toHaveAttribute('data-next-below');
  await expect(page.locator('.ws-side .ws-actions')).toHaveCount(1);
  const m = await searchLayout(page);
  expect(m.sideScroll).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 742, height: 702 });
  await expect(section).toHaveAttribute('data-next-below', 'true');
  expect((await searchLayout(page)).sideScroll).toBeLessThanOrEqual(0);
});

test('selection: first tap marks, wrong pair flashes and clears, double tap keeps the mark', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startSearch(page, { level: 1 });
  const words = await gridWords(page);
  const [a, b] = wrongPair(words);
  await cell(page, a).click();
  await expect(cell(page, a)).toHaveAttribute('aria-pressed', 'true');
  await cell(page, b).click();
  await expect(cell(page, a)).toHaveAttribute('aria-pressed', 'false');
  await expect(cell(page, a)).toHaveAttribute('data-flash', 'true');
  await expect(page.getByRole('status')).toHaveText('That is not a word from the list. Try again.');
  await expect(cell(page, a)).not.toHaveAttribute('data-flash', 'true', { timeout: 2000 });
  // A double tap on one letter: the second click (detail 2) must not cancel the mark.
  const box = (await cell(page, a).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ clickCount: 1 });
  await page.mouse.up({ clickCount: 1 });
  await page.mouse.down({ clickCount: 2 });
  await page.mouse.up({ clickCount: 2 });
  await expect(cell(page, a)).toHaveAttribute('aria-pressed', 'true');
  // A deliberate second tap cancels it.
  await page.waitForTimeout(600);
  await cell(page, a).click();
  await expect(cell(page, a)).toHaveAttribute('aria-pressed', 'false');
  // A quick last tap right after the first one on another letter counts (crossing words too).
  await cell(page, words[0].first).click();
  await cell(page, words[0].last).click({ delay: 0 });
  await expect(cell(page, words[0].first)).toHaveAttribute('data-word', /^[0-4]$/);
});

// QA247-04: Firefox reports a quick second touch tap with detail 1, which cancelled the mark.
// Both clicks are sent with detail 1 here (checked), in a touch context, in both engines.
test('selection: a quick second tap with detail 1 on the marked letter keeps it; a slow one cancels', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await startSearch(page, { level: 1 });
  await page.evaluate(() => {
    const details: number[] = [];
    (window as unknown as { details: number[] }).details = details;
    document.addEventListener('click', (e) => details.push(e.detail), true);
  });
  const words = await gridWords(page);
  const [a] = wrongPair(words);
  const box = (await cell(page, a).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const singleClick = async () => {
    await page.mouse.down({ clickCount: 1 });
    await page.mouse.up({ clickCount: 1 });
  };
  await page.mouse.move(x, y);
  await singleClick();
  await singleClick();
  expect(await page.evaluate(() => (window as unknown as { details: number[] }).details)).toEqual([
    1, 1,
  ]);
  await expect(cell(page, a)).toHaveAttribute('aria-pressed', 'true');
  // A touch tap right after it (Firefox: detail 1) keeps the mark too.
  await page.waitForTimeout(100);
  await cell(page, a).tap();
  await expect(cell(page, a)).toHaveAttribute('aria-pressed', 'true');
  // A slow, deliberate second tap cancels it.
  await page.waitForTimeout(600);
  await cell(page, a).tap();
  await expect(cell(page, a)).toHaveAttribute('aria-pressed', 'false');
  await context.close();
});

test('a lesson of 10 words is two grids; the summary shows found on the first try', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await startSearch(page, { level: 3, size: 10 });
  await expect(page.getByText('Word search 1 of 2')).toBeVisible();
  let words = await gridWords(page);
  await cell(page, wrongPair(words)[0]).click();
  await cell(page, wrongPair(words)[1]).click();
  for (const w of words) await findWord(page, w);
  await page.getByRole('button', { name: /Next word search/ }).click();
  await expect(page.getByText('Word search 2 of 2')).toBeVisible();
  await expect(page.locator('.ws-cell').first()).toBeFocused();
  words = await gridWords(page);
  for (const w of words) await findWord(page, w);
  await page.getByRole('button', { name: /See how you did/ }).click();
  await expect(page.getByText('10 words found')).toBeVisible();
  await expect(page.locator('.first-try')).toHaveText('First try, without hints 9 / 10');
  await expect(page.getByRole('heading', { name: 'Look how far you’ve come!' })).toBeFocused();
});

test('keyboard: Tab reaches the grid once, arrows move, Enter taps; letters-in-order mode works', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await startSearch(page, { level: 1 });
  await expect(page.locator('.ws-cell').first()).toBeFocused();
  const words = await gridWords(page);
  const w = words[0];
  /** Arrow keys from one cell to another (rows, then columns). */
  const move = async (from: [number, number], to: [number, number]) => {
    for (let r = from[0]; r !== to[0]; r += Math.sign(to[0] - from[0]))
      await page.keyboard.press(to[0] > from[0] ? 'ArrowDown' : 'ArrowUp');
    for (let c = from[1]; c !== to[1]; c += Math.sign(to[1] - from[1]))
      await page.keyboard.press(to[1] > from[1] ? 'ArrowRight' : 'ArrowLeft');
  };
  await move([0, 0], w.first);
  await page.keyboard.press('Enter');
  await expect(cell(page, w.first)).toBeFocused();
  await move(w.first, w.last);
  await page.keyboard.press('Space');
  await expect(cell(page, w.first)).toHaveAttribute('data-word', /\d/);
  // Tab leaves the grid in one step: the hidden letters-mode switch appears on focus.
  await page.keyboard.press('Tab');
  const toggle = page.getByRole('button', { name: 'Choose the letters in order' });
  await expect(toggle).toBeFocused();
  await expect(toggle).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const label = (await page.locator('.ws-letters-word').textContent())!;
  const word = label.split(': ')[1];
  for (const letter of word)
    await page
      .getByRole('group', { name: 'Letter buttons' })
      .getByRole('button', { name: letter, exact: true })
      .click();
  await expect(page.getByRole('button', { name: `${word}, found` })).toBeVisible();
});

test('the app bar stays one row at 320x568 during the lesson', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await startSearch(page, { level: 2 });
  const tops = await page
    .locator('.app-bar button:visible')
    .evaluateAll((items) => items.map((b) => Math.round(b.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
});
