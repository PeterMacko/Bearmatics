import { expect, type Page } from '@playwright/test';
import { setLanguage } from './language';

// SCRUM-241: Word search helpers. The grid's words are found by scanning the letters for the
// 20 list words (each grid holds exactly its 5 words and no other list word), so level 2
// tests need nothing from the app that a child could not see.

export const SEARCH_WORDS = [
  'seven',
  'ten',
  'blue',
  'pink',
  'red',
  'dog',
  'cat',
  'Suzy',
  'eleven',
  'book',
  'green',
  'desk',
  'yellow',
  'girl',
  'boy',
  'pencil',
  'ruler',
  'sister',
  'star',
  'grey',
];

export type GridWord = { word: string; first: [number, number]; last: [number, number] };

/** The grid's words and their first/last cells (row, col from 0), scanned in all directions. */
export async function gridWords(page: Page): Promise<GridWord[]> {
  const letters = await page.locator('.ws-cell').allTextContents();
  expect(letters).toHaveLength(36);
  const at = (r: number, c: number) =>
    r >= 0 && r < 6 && c >= 0 && c < 6 ? letters[r * 6 + c] : '';
  const out: GridWord[] = [];
  for (const word of SEARCH_WORDS) {
    const target = word.toUpperCase();
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++)
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
          [1, 1],
          [-1, 1],
          [0, -1],
          [-1, 0],
          [-1, -1],
          [1, -1],
        ])
          if ([...target].every((ch, i) => at(r + i * dr, c + i * dc) === ch))
            out.push({
              word,
              first: [r, c],
              last: [r + (target.length - 1) * dr, c + (target.length - 1) * dc],
            });
  }
  expect(out).toHaveLength(5);
  return out;
}

export const cell = (page: Page, [row, col]: [number, number]) =>
  page.locator('.ws-cell').nth(row * 6 + col);

/** Taps the first, then the last letter of a word. */
export async function findWord(page: Page, word: GridWord) {
  await cell(page, word.first).click();
  await cell(page, word.last).click();
}

/** A pair of cells that is no word's ends (the second cell beside the first word's start). */
export function wrongPair(words: GridWord[]): [[number, number], [number, number]] {
  const ends = new Set(words.flatMap((w) => [`${w.first}|${w.last}`, `${w.last}|${w.first}`]));
  for (let a = 0; a < 36; a++)
    for (let b = 0; b < 36; b++) {
      const p: [number, number] = [Math.floor(a / 6), a % 6];
      const q: [number, number] = [Math.floor(b / 6), b % 6];
      if (a !== b && !ends.has(`${p}|${q}`)) return [p, q];
    }
  throw new Error('no wrong pair');
}

/** Opens the Word search menu (optionally in Slovak), picks a level and size, starts. */
export async function startSearch(
  page: Page,
  {
    level = 1,
    size = 5,
    lang = 'en',
  }: { level?: 1 | 2 | 3; size?: 5 | 10 | 20; lang?: 'en' | 'sk' } = {},
) {
  await page.goto('/');
  if (lang === 'sk') await setLanguage(page, 'Slovenčina');
  await page.locator('.course-wordsearch').click();
  await expect(page.locator('.wordsearch-home')).toBeVisible();
  // Tap the visible cards and pills (Firefox can report the 1 px radios as covered).
  await page
    .locator('.wordsearch-home .level-option')
    .nth(level - 1)
    .click();
  await page
    .locator('.wordsearch-home .session-options label')
    .filter({ hasText: new RegExp(`^${size}\\b`) })
    .click();
  await expect(page.locator(`input[name="search-level"][value="${level}"]`)).toBeChecked();
  await page.locator('.wordsearch-home .start-button').click();
  await expect(page.locator('.ws-board')).toBeVisible();
}

/** Layout numbers of the word search screen. */
export const searchLayout = (page: Page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    const visible = (el: Element) => (el as HTMLElement).offsetParent !== null;
    const buttons = [...document.querySelectorAll<HTMLElement>('.wordsearch-practice button')]
      .filter(visible)
      .filter((b) => !b.classList.contains('ws-letters-toggle'));
    const cells = [...document.querySelectorAll<HTMLElement>('.ws-cell')];
    const list = document.querySelector('.ws-words')!.getBoundingClientRect();
    const board = document.querySelector('.ws-board')!.getBoundingClientRect();
    const next = document.querySelector('.ws-actions .answer-button')?.getBoundingClientRect();
    return {
      pageScroll: d.scrollHeight - d.clientHeight,
      sideScroll: d.scrollWidth - d.clientWidth,
      cell: Math.min(...cells.map((c) => Math.min(c.offsetWidth, c.offsetHeight))),
      target: Math.min(...buttons.map((b) => Math.min(b.offsetWidth, b.offsetHeight))),
      listBottom: Math.round(list.bottom),
      boardRight: Math.round(board.right),
      nextBottom: next ? Math.round(next.bottom) : null,
      viewport: d.clientHeight,
      width: d.clientWidth,
      listVisible: list.bottom <= d.clientHeight + 0.5 && list.top >= 0,
      /** Word buttons whose text does not fit inside them. */
      chipOverflow: [...document.querySelectorAll<HTMLElement>('.ws-word')].filter(
        (b) => b.scrollWidth > b.clientWidth + 1,
      ).length,
    };
  });
