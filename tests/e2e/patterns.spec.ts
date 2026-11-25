import { expect, test, type Page } from '@playwright/test';
import { ALL_DEVICES, DEVICE } from './support/devices';
import { setLanguage } from './support/language';
import { mockApi } from './support/mockApi';
import {
  answerRight,
  BEAR_DEMO_KEY,
  choiceNames,
  fits,
  leaveLesson,
  PATTERN_DEMO_KEY,
  PATTERN_DEMO_MS,
  rightChoice,
  rowNames,
  skipPatternDemo,
  startPatternLesson,
} from './support/patterns';

// SCRUM-299: Logic Levels 3-5 "What comes next?" picture patterns on the defined devices.

const next = (page: Page) => page.locator('.pattern-actions .answer-button');

/** Fit numbers of the pattern screen. */
const patternLayout = (page: Page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    const visible = (s: string) =>
      [...document.querySelectorAll<HTMLElement>(s)].filter((e) => e.offsetParent);
    const choices = visible('.pattern-choice');
    const buttons = visible('.pattern-practice button');
    const parts = [...visible('.pattern-row'), ...choices, ...buttons];
    const row = document.querySelector('.pattern-row')!.getBoundingClientRect();
    const places = visible('.pattern-place');
    const tops = new Set(places.map((p) => Math.round(p.getBoundingClientRect().top)));
    const choiceTops = new Set(choices.map((c) => Math.round(c.getBoundingClientRect().top)));
    return {
      pageScroll: d.scrollHeight - d.clientHeight,
      sideScroll: d.scrollWidth - d.clientWidth,
      inView: parts.every((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.top >= 0 &&
          r.left >= 0 &&
          r.bottom <= d.clientHeight + 1 &&
          r.right <= d.clientWidth + 1
        );
      }),
      rowFits: row.left >= 0 && row.right <= d.clientWidth,
      rowLines: tops.size,
      choiceLines: choiceTops.size,
      place: Math.min(...places.map((p) => Math.min(p.offsetWidth, p.offsetHeight))),
      smallestChoice: Math.min(...choices.map((c) => Math.min(c.offsetWidth, c.offsetHeight))),
      smallestTarget: Math.min(...buttons.map((b) => Math.min(b.offsetWidth, b.offsetHeight))),
      // The feedback text is never covered by a button or a choice.
      feedbackCovered: (() => {
        const line = document.getElementById('answer-feedback');
        if (!line?.textContent) return false;
        const range = document.createRange();
        range.selectNodeContents(line);
        const text = range.getBoundingClientRect();
        return [...buttons, ...parts].some((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left < text.right - 1 &&
            r.right > text.left + 1 &&
            r.top < text.bottom - 1 &&
            r.bottom > text.top + 1
          );
        });
      })(),
    };
  });

type Layout = Awaited<ReturnType<typeof patternLayout>>;

function checkLayout(layout: Layout, what: string, dice: boolean) {
  test.info().annotations.push({ type: 'fit', description: JSON.stringify({ what, ...layout }) });
  expect(layout.pageScroll, `${what}: page scroll`).toBeLessThanOrEqual(1);
  expect(layout.sideScroll, `${what}: side scroll`).toBeLessThanOrEqual(0);
  expect(layout.inView, `${what}: row, choices, Next and Show me on screen`).toBe(true);
  expect(layout.rowFits, `${what}: row inside the window`).toBe(true);
  expect(layout.place, `${what}: picture place`).toBeGreaterThanOrEqual(dice ? 56 : 40);
  expect(layout.smallestChoice, `${what}: smallest choice`).toBeGreaterThanOrEqual(48);
  expect(layout.choiceLines, `${what}: choices on one line`).toBe(1);
  expect(layout.feedbackCovered, `${what}: feedback text covered`).toBe(false);
  expect(layout.smallestTarget, `${what}: smallest button`).toBeGreaterThanOrEqual(48);
}

/** Measures a row before and after its right answer (the layout settles after the move). */
async function fitRow(page: Page, what: string, dice: boolean) {
  await expect(page.locator('.pattern-row')).toBeVisible();
  checkLayout(await patternLayout(page), `${what} before`, dice);
  await answerRight(page);
  await expect
    .poll(async () => (await patternLayout(page)).pageScroll, { timeout: 2000 })
    .toBeLessThanOrEqual(1);
  const after = await patternLayout(page);
  checkLayout(after, `${what} after`, dice);
  return after;
}

const phonePortrait = (width: number, height: number) => width <= 420 && height > width;

for (const { name, width, height } of ALL_DEVICES)
  for (const lang of ['en', 'sk'] as const)
    for (const account of ['signed out', 'signed in'] as const)
      test(`Levels 3-5 fit ${name} ${width}x${height} ${lang} ${account}: row, 48 px choices, Next on screen before and after the answer`, async ({
        page,
      }) => {
        test.setTimeout(90_000);
        if (account === 'signed in')
          await mockApi(page, {
            nickname: 'Medvedík Bru',
            points: 1234,
            streak: 12,
            frozen: false,
            today: true,
          });
        await skipPatternDemo(page);
        await page.setViewportSize({ width, height });
        await page.goto('/');
        if (lang === 'sk') await setLanguage(page, 'Slovenčina');
        for (const level of [3, 4, 5] as const) {
          await startPatternLesson(page, level, { goto: false });
          const after = await fitRow(page, `Level ${level}`, level === 5);
          // Level 4 (8 places) is two rows of 4 on phones in portrait, one row elsewhere.
          if (level === 4) expect(after.rowLines).toBe(phonePortrait(width, height) ? 2 : 1);
          if (level === 5) {
            // Counts come first; answer through to the first arrow row (row 4 of 5).
            for (let i = 1; i < 3; i++) {
              await next(page).click();
              await answerRight(page);
            }
            await next(page).click();
            await expect(page.locator('.pattern-arrow').first()).toBeVisible();
            await fitRow(page, 'Level 5 arrows', false);
          }
          await leaveLesson(page);
        }
      });

/** The Logic menu with 5 levels: heading, count and Start on screen; only the list scrolls. */
const menuLayout = (page: Page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const list = document.querySelector<HTMLElement>('.logic-home .level-options')!;
    const shown = (r: DOMRect) => r.top >= 0 && r.bottom <= d.clientHeight + 1;
    return {
      mode: document.querySelector<HTMLElement>('.workspace')!.dataset.menuMode,
      pageScroll: d.scrollHeight - d.clientHeight,
      listScroll: list.scrollHeight - list.clientHeight,
      heading: shown(box('.logic-home .menu-heading')),
      count: shown(box('.logic-home .session-options')),
      start: shown(box('.logic-home .start-button')),
      levels: list.querySelectorAll('.level-option').length,
    };
  });

for (const { name, width, height } of ALL_DEVICES)
  for (const lang of ['en', 'sk'] as const)
    test(`Logic menu with Levels 1-5 at ${name} ${width}x${height} ${lang}: heading, count and Start on screen, no page scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      if (lang === 'sk') await setLanguage(page, 'Slovenčina');
      await page.locator('.course-logic').click();
      await expect(page.locator('.workspace')).toHaveAttribute('data-menu-mode', 'contained');
      const menu = await menuLayout(page);
      test.info().annotations.push({ type: 'menu', description: JSON.stringify(menu) });
      expect(menu.levels).toBe(5);
      expect(menu.pageScroll, 'page scroll').toBeLessThanOrEqual(1);
      expect(menu.heading, 'heading on screen').toBe(true);
      expect(menu.count, 'count on screen').toBe(true);
      expect(menu.start, 'Start on screen').toBe(true);
      // The last level can be reached by scrolling the list (contained) when it does not fit.
      await page.locator('.logic-home .level-5').scrollIntoViewIfNeeded();
      await expect(page.locator('.logic-home .level-5')).toBeInViewport();
      expect((await menuLayout(page)).pageScroll).toBeLessThanOrEqual(1);
    });

test('Logic menu names Levels 3-5 after the bear levels (EN and SK)', async ({ page }) => {
  await page.goto('/');
  await page.locator('.course-logic').click();
  const titles = () => page.locator('.logic-home .level-title').allTextContents();
  expect(await titles()).toEqual([
    'Level 1 · Bear goes to the honey',
    'Level 2 · Around the stones',
    'Level 3 · What comes next?',
    'Level 4 · What is missing?',
    'Level 5 · Growing and turning',
  ]);
  await setLanguage(page, 'Slovenčina');
  expect(await titles()).toEqual([
    'Úroveň 1 · Medveď ide po med',
    'Úroveň 2 · Okolo kameňov',
    'Úroveň 3 · Čo príde ďalej?',
    'Úroveň 4 · Čo chýba?',
    'Úroveň 5 · Rastie a otáča sa',
  ]);
});

for (const { name, width, height } of [DEVICE.phone, DEVICE.smallPhone])
  for (const lang of ['en', 'sk'] as const)
    test(`200% text ${lang} at ${name} ${width}x${height}: rows usable, no sideways scroll, app bar one row`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await skipPatternDemo(page);
      await page.setViewportSize({ width, height });
      await page.goto('/');
      if (lang === 'sk') await setLanguage(page, 'Slovenčina');
      await page.addStyleTag({ content: 'html{font-size:200% !important}' });
      for (const level of [3, 4, 5] as const) {
        await startPatternLesson(page, level, { goto: false });
        const tops = await page
          .locator('.app-bar > :not(.app-bar-end), .app-bar-end > *')
          .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
        expect(Math.max(...tops) - Math.min(...tops), 'app bar one row').toBeLessThanOrEqual(20);
        // Show me never covers the position line ("Exercise 1 of 5") or the row.
        const covers = await page.evaluate(() => {
          const show = document.querySelector('.pattern-show-me')!.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(document.querySelector('.exercise-position')!);
          return [
            range.getBoundingClientRect(),
            document.querySelector('.pattern-row')!.getBoundingClientRect(),
          ].some(
            (r) =>
              show.left < r.right - 1 &&
              show.right > r.left + 1 &&
              show.top < r.bottom - 1 &&
              show.bottom > r.top + 1,
          );
        });
        expect(covers, 'Show me covers the position or the row').toBe(false);
        for (const state of ['before', 'after']) {
          if (state === 'after') await answerRight(page);
          const layout = await patternLayout(page);
          test.info().annotations.push({
            type: 'fit',
            description: JSON.stringify({ level, state, ...layout }),
          });
          expect(layout.sideScroll).toBeLessThanOrEqual(0);
          expect(layout.rowFits).toBe(true);
          expect(layout.smallestChoice).toBeGreaterThanOrEqual(48);
          expect(layout.smallestTarget).toBeGreaterThanOrEqual(48);
        }
        await next(page).scrollIntoViewIfNeeded();
        await expect(next(page)).toBeInViewport({ ratio: 1 });
        await leaveLesson(page);
      }
    });

test('a tap answers at once: wrong = red mark and retry with every choice; right fills the "?" with a move', async ({
  page,
}) => {
  await skipPatternDemo(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await startPatternLesson(page, 3);
  const { names, gap } = await rowNames(page);
  expect(names.at(-1)).toBe('question mark');
  const right = await rightChoice(page);
  const choices = page.locator('.pattern-choice');
  const wrong = (right + 1) % 3;
  await choices.nth(wrong).click();
  await expect(choices.nth(wrong)).toHaveAttribute('data-state', 'incorrect');
  await expect(page.locator('#answer-feedback')).toHaveText('Not this one. Try another picture.');
  await expect(page.locator('.bear')).toHaveClass(/bear-sad/);
  for (let i = 0; i < 3; i++) {
    await expect(choices.nth(i)).toBeEnabled();
    await expect(choices.nth(i)).not.toHaveAttribute('aria-disabled', 'true');
  }
  await choices.nth(right).click();
  await expect(page.locator('.pattern-arrive[data-moving]')).toHaveCount(1);
  const moving = await page.locator('.pattern-arrive').evaluate((el) => el.getAnimations().length);
  expect(moving).toBeGreaterThan(0);
  await expect(page.locator('#answer-feedback')).toHaveText('Yes! That picture fits.');
  await expect(page.locator('.bear')).toHaveClass(/bear-happy/);
  const filled = (await page.locator('.pattern-row').getAttribute('aria-label'))!.split(', ');
  expect(fits(names, gap, filled[gap])).toBe(true);
  await expect(next(page)).toBeFocused();
  // A tap after the right one changes nothing.
  const untouched = 3 - right - wrong;
  await choices.nth(untouched).click({ force: true });
  await expect(choices.nth(untouched)).not.toHaveAttribute('data-state');
  await expect(choices.nth(wrong)).toHaveAttribute('data-state', 'incorrect');
  await expect(page.locator('#answer-feedback')).toHaveText('Yes! That picture fits.');
});

test('a double tap on a choice is one try; a double tap on Next moves on one row', async ({
  page,
}) => {
  await skipPatternDemo(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await startPatternLesson(page, 4);
  const right = await rightChoice(page);
  await page.locator('.pattern-choice').nth(right).dblclick();
  await expect(next(page)).toBeVisible();
  await next(page).dblclick();
  await expect(page.locator('.exercise-position')).toHaveText('Exercise 2 of 5');
  await expect(page.locator('#answer-feedback')).toHaveText('');
});

test('a whole lesson of 5 on Level 5: counts (growing first), then arrows; one wrong try = review; summary', async ({
  page,
}) => {
  await skipPatternDemo(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await startPatternLesson(page, 5);
  const kinds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const { names } = await rowNames(page);
    kinds.push(
      /arrow/i.test(names[0])
        ? 'arrow'
        : Number(names[1][0]) > Number(names[0][0])
          ? 'grow'
          : 'shrink',
    );
    if (i === 1) {
      const right = await rightChoice(page);
      await page
        .locator('.pattern-choice')
        .nth((right + 1) % 3)
        .click();
    }
    await answerRight(page);
    await next(page).click();
  }
  expect(kinds).toEqual(['grow', 'grow', 'shrink', 'arrow', 'arrow']);
  await expect(page.locator('.pattern-practice h2')).toHaveText('Let’s try these rows again');
  await answerRight(page);
  await next(page).click();
  await expect(page.locator('.summary')).toBeVisible();
  await expect(page.locator('.summary')).toContainText('4');
});

test('choices are named in Slovak too ("Šípka …", counted nouns)', async ({ page }) => {
  await skipPatternDemo(page);
  await startPatternLesson(page, 5, { lang: 'sk' });
  const { names } = await rowNames(page);
  expect(names.at(-1)).toBe('otáznik');
  for (const n of [...names.slice(0, -1), ...(await choiceNames(page))])
    expect(n).toMatch(/^[1-6] (pirát|medve|lízan|lod|loď|lietad)/i);
});

test('demo once per device: the first pattern lesson shows it, later ones start with the row; Show me plays it', async ({
  page,
}) => {
  // A device that already saw the bear demo still gets the pattern demo once.
  await page.addInitScript((key) => localStorage.setItem(key, '1'), BEAR_DEMO_KEY);
  await page.setViewportSize({ width: 390, height: 844 });
  await startPatternLesson(page, 4);
  await expect(page.locator('.pattern-demo-moving')).toBeVisible();
  await expect(page.locator('.pattern-row')).toHaveCount(0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: test.info().outputPath('demo-mid.png') });
  await expect(page.locator('.pattern-row')).toBeVisible({ timeout: PATTERN_DEMO_MS + 3000 });
  expect(await page.evaluate((k) => localStorage.getItem(k), PATTERN_DEMO_KEY)).toBe('1');
  await leaveLesson(page);
  await page.locator('.logic-home .level-3').click();
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.pattern-row')).toBeVisible();
  await expect(page.locator('.pattern-demo')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show me', exact: true }).click();
  await expect(page.locator('.pattern-demo')).toBeVisible();
  await expect(page.locator('.pattern-row')).toBeVisible({ timeout: PATTERN_DEMO_MS + 3000 });
});

test('demo once per device: leaving during the demo is not "seen"', async ({ page }) => {
  await startPatternLesson(page, 3);
  await expect(page.locator('.pattern-demo')).toBeVisible();
  await leaveLesson(page);
  await page.waitForTimeout(PATTERN_DEMO_MS + 300);
  expect(await page.evaluate((k) => localStorage.getItem(k), PATTERN_DEMO_KEY)).toBeNull();
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.pattern-demo')).toBeVisible();
});

test('reduced motion: the demo is three still steps; the right picture appears in place without moving', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await startPatternLesson(page, 3);
  await expect(page.locator('.pattern-demo-still .pattern-demo-frame')).toHaveCount(3);
  expect(
    await page
      .locator('.pattern-demo')
      .evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await expect(page.locator('.pattern-row')).toBeVisible({ timeout: 8000 });
  await answerRight(page);
  await expect(page.locator('.pattern-arrive')).toHaveCount(1);
  await expect(page.locator('.pattern-arrive[data-moving]')).toHaveCount(0);
  expect(await page.locator('.pattern-arrive').evaluate((el) => el.getAnimations().length)).toBe(0);
  await context.close();
});
