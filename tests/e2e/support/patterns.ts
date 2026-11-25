import { expect, type Page } from '@playwright/test';
import { setLanguage } from './language';

/** SCRUM-299: Logic Levels 3-5 ("What comes next?") helpers for browser specs and probes. */
export const PATTERN_DEMO_KEY = 'bearmatics-pattern-demo-seen';
export const BEAR_DEMO_KEY = 'bearmatics-logic-demo-seen';
export const PATTERN_DEMO_MS = 3200;

/** Marks the pattern demo as seen before the page loads (the lesson starts with a row). */
export const skipPatternDemo = (page: Page) =>
  page.addInitScript((key) => localStorage.setItem(key, '1'), PATTERN_DEMO_KEY);

/** Opens the Logic menu, picks a level (1-5) and size, and starts the lesson. */
export async function startPatternLesson(
  page: Page,
  level: 3 | 4 | 5,
  {
    lang = 'en',
    size = 5,
    goto = true,
  }: { lang?: 'en' | 'sk'; size?: 5 | 10 | 20; goto?: boolean } = {},
) {
  if (goto) await page.goto('/');
  if (lang === 'sk') await setLanguage(page, 'Slovenčina');
  if (!(await page.locator('.logic-home').isVisible())) await page.locator('.course-logic').click();
  await expect(page.locator('.logic-home')).toBeVisible();
  await page.locator(`.logic-home .level-${level}`).click();
  const sizes = { 5: 0, 10: 1, 20: 2 } as const;
  await page.locator('.logic-home .session-options label').nth(sizes[size]).click();
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.pattern-practice')).toBeVisible();
}

const ARROW_TURN: Record<string, number> = {
  up: 0,
  right: 1,
  down: 2,
  left: 3,
  nahor: 0,
  doprava: 1,
  nadol: 2,
  doľava: 3,
};

/** Independent rule (from the visible names): is `candidate` right for the "?" place? */
export function fits(names: string[], gap: number, candidate: string): boolean {
  const row = names.map((n, i) => (i === gap ? candidate.toLowerCase() : n.toLowerCase()));
  const arrows = row.map((n) => ARROW_TURN[n.split(' ').at(-1)!]);
  if (arrows.every((a) => a !== undefined)) {
    const step = (arrows[1] - arrows[0] + 4) % 4;
    return (
      (step === 1 || step === 3) &&
      arrows.every((a, i) => i === 0 || (a - arrows[i - 1] + 4) % 4 === step)
    );
  }
  const counts = row.map((n) => Number(n.split(' ')[0]));
  if (counts.every((c) => Number.isInteger(c))) {
    const step = counts[1] - counts[0];
    return Math.abs(step) === 1 && counts.every((c, i) => i === 0 || c - counts[i - 1] === step);
  }
  for (let p = 2; p <= 4 && 2 * p <= row.length; p++)
    if (row.every((n, i) => i < p || n === row[i - p])) return true;
  return false;
}

/** The row's names (from its accessible name) and where the "?" is. */
export async function rowNames(page: Page) {
  const label = (await page.locator('.pattern-row').getAttribute('aria-label'))!;
  const names = label.split(', ');
  const gap = names.findIndex((n) => /^(question mark|otáznik)$/i.test(n));
  return { names, gap };
}

/** The accessible names of the choices, in screen order. */
export const choiceNames = (page: Page) =>
  page
    .locator('.pattern-choice')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!));

/** Index of the right choice (worked out from the visible row, not from the app's answer). */
export async function rightChoice(page: Page): Promise<number> {
  const { names, gap } = await rowNames(page);
  const choices = await choiceNames(page);
  const right = choices.map((c, i) => (fits(names, gap, c) ? i : -1)).filter((i) => i >= 0);
  if (right.length !== 1) throw new Error(`${right.length} right choices: ${names} / ${choices}`);
  return right[0];
}

/** Taps the right choice and waits for Next. */
export async function answerRight(page: Page) {
  await page
    .locator('.pattern-choice')
    .nth(await rightChoice(page))
    .click();
  await expect(page.locator('.pattern-actions .answer-button')).toBeVisible();
}

/** Back to the Logic menu (through the leave question when the lesson has progress). */
export async function leaveLesson(page: Page) {
  await page.locator('.back-button').click();
  const leave = page.locator('.leave-dialog .secondary');
  if (await leave.isVisible()) await leave.click();
  await expect(page.locator('.logic-home')).toBeVisible();
}
