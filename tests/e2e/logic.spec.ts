import { expect, test, type Page } from '@playwright/test';
import { ALL_DEVICES, DEVICE } from './support/devices';
import { setLanguage } from './support/language';

// SCRUM-262: Logic course, level 1 "Bear goes to the honey" on the defined devices.

const DEMO_MS = 3200;

async function openLogic(page: Page, lang: 'en' | 'sk' = 'en') {
  await page.goto('/');
  if (lang === 'sk') await setLanguage(page, 'Slovenčina');
  await page.locator('.course-logic').click();
  await expect(page.locator('.logic-home')).toBeVisible();
}

/** Starts a lesson and waits until the demo has given way to the board. */
async function startLesson(page: Page, lang: 'en' | 'sk' = 'en') {
  await openLogic(page, lang);
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.logic-demo')).toBeVisible();
  await expect(page.locator('.logic-board')).toBeVisible({ timeout: DEMO_MS + 3000 });
}

/** Bear and honey (0-based) from the board's accessible name ("Bear: row 2, column 1. ..."). */
async function puzzle(page: Page) {
  const label = (await page.locator('.logic-board').getAttribute('aria-label'))!;
  const [bearRow, bearCol, honeyRow, honeyCol] = label.match(/\d+/g)!.map((n) => Number(n) - 1);
  return { bearRow, bearCol, honeyRow, honeyCol };
}

/** The right arrows for the current puzzle: across first, then up or down. */
async function rightPath(page: Page) {
  const p = await puzzle(page);
  const across = p.honeyCol > p.bearCol ? '.arrow-right' : '.arrow-left';
  const down = p.honeyRow > p.bearRow ? '.arrow-down' : '.arrow-up';
  return [
    ...Array<string>(Math.abs(p.honeyCol - p.bearCol)).fill(across),
    ...Array<string>(Math.abs(p.honeyRow - p.bearRow)).fill(down),
  ];
}

/** Layout numbers of the lesson screen. */
const lessonLayout = (page: Page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    // (On phones the arrow pad hides once the puzzle is solved: Next takes its row.)
    const parts = [
      '.logic-board',
      '.arrow-slots',
      '.arrow-pad',
      '.logic-actions .answer-button',
      '.logic-show-me',
    ]
      .map((s) => document.querySelector<HTMLElement>(s)!)
      .filter((el) => el.offsetParent || getComputedStyle(el).display === 'contents');
    const boxes = parts
      .filter((el) => getComputedStyle(el).display !== 'contents')
      .concat(
        [...document.querySelectorAll<HTMLElement>('.logic-practice button')].filter(
          (b) => b.offsetParent,
        ),
      )
      .map((el) => el.getBoundingClientRect());
    const buttons = [...document.querySelectorAll<HTMLElement>('.logic-practice button')].filter(
      (b) => b.offsetParent,
    );
    return {
      pageScroll: d.scrollHeight - d.clientHeight,
      sideScroll: d.scrollWidth - d.clientWidth,
      inView: boxes.every(
        (r) =>
          r.top >= 0 &&
          r.left >= 0 &&
          r.bottom <= d.clientHeight + 1 &&
          r.right <= d.clientWidth + 1,
      ),
      cell: Math.min(
        ...[...document.querySelectorAll<HTMLElement>('.logic-cell')].map((c) =>
          Math.min(c.offsetWidth, c.offsetHeight),
        ),
      ),
      smallestTarget: Math.min(...buttons.map((b) => Math.min(b.offsetWidth, b.offsetHeight))),
    };
  });

for (const { name, width, height } of ALL_DEVICES)
  for (const lang of ['en', 'sk'] as const)
    test(`Logic lesson fits ${name} ${width}x${height} ${lang}: board, slots, arrows and Go on screen, no page scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await startLesson(page, lang);
      for (const arrow of ['.arrow-right', '.arrow-right', '.arrow-down'])
        await page.locator(arrow).click();
      // Plan state, then after Go (the feedback line filled, right or wrong).
      for (const state of ['plan', 'after Go']) {
        if (state === 'after Go') {
          await page.locator('.logic-go').click();
          await expect(page.locator('#answer-feedback')).not.toHaveText('', { timeout: 5000 });
          await expect(page.locator('.logic-practice')).not.toHaveAttribute('data-walking');
        }
        const layout = await lessonLayout(page);
        expect(layout.pageScroll, `${state}: page scroll`).toBeLessThanOrEqual(1);
        expect(layout.sideScroll, `${state}: side scroll`).toBeLessThanOrEqual(0);
        expect(layout.inView, `${state}: board, slots, pad, Go/Next, Show me on screen`).toBe(true);
        expect(layout.cell, `${state}: grid cell`).toBeGreaterThanOrEqual(56);
        expect(layout.smallestTarget, `${state}: smallest button`).toBeGreaterThanOrEqual(48);
      }
    });

for (const { name, width, height } of ALL_DEVICES)
  test(`Logic menu: no page scroll while contained at ${name} ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await openLogic(page);
    const state = await page.evaluate(() => ({
      mode: document.querySelector<HTMLElement>('.workspace')!.dataset.menuMode,
      overflow: document.documentElement.scrollHeight - innerHeight,
    }));
    expect(state.mode).toMatch(/contained|flow/);
    if (state.mode === 'contained') expect(state.overflow).toBeLessThanOrEqual(1);
    await expect(page.locator('.logic-home .start-button')).toBeInViewport({ ratio: 1 });
  });

// 200% text (set after the document exists, so both engines really enlarge it).
for (const { name, width, height } of [DEVICE.phone, DEVICE.smallPhone])
  for (const lang of ['en', 'sk'] as const)
    test(`200% text ${lang} at ${name} ${width}x${height}: lesson and menu stay usable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await openLogic(page, lang);
      await page.addStyleTag({ content: 'html{font-size:200% !important}' });
      // Menu: SCRUM-36 rule (contained = no page scroll, otherwise the page scrolls).
      const menu = await page.evaluate(() => ({
        mode: document.querySelector<HTMLElement>('.workspace')!.dataset.menuMode,
        overflow: document.documentElement.scrollHeight - innerHeight,
      }));
      if (menu.mode === 'contained') expect(menu.overflow).toBeLessThanOrEqual(1);
      await page.locator('.logic-home .start-button').click();
      await expect(page.locator('.logic-board')).toBeVisible({ timeout: DEMO_MS + 3000 });
      for (const arrow of ['.arrow-right', '.arrow-down']) await page.locator(arrow).click();
      const layout = await lessonLayout(page);
      expect(layout.sideScroll).toBeLessThanOrEqual(0);
      expect(layout.cell).toBeGreaterThanOrEqual(56);
      expect(layout.smallestTarget).toBeGreaterThanOrEqual(48);
      // The phone fits without scrolling; the smallest phone cannot hold a 56 px grid plus
      // the controls at 200% text, so there the page scrolls and Go stays reachable.
      if (width >= 390) expect(layout.pageScroll).toBeLessThanOrEqual(1);
      await page.locator('.logic-go').scrollIntoViewIfNeeded();
      await expect(page.locator('.logic-go')).toBeInViewport({ ratio: 1 });
    });

test('right walk: the bear ends on the honey, happy bear, Next; first try counted on the summary', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLogic(page);
  await page.getByRole('radio', { name: '5 exercises' }).check({ force: true });
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.logic-board')).toBeVisible({ timeout: DEMO_MS + 3000 });
  for (let i = 0; i < 5; i++) {
    for (const arrow of await rightPath(page)) await page.locator(arrow).click();
    await page.locator('.logic-go').click();
    await expect(page.locator('#answer-feedback')).toHaveText(
      'The bear found the honey! Well done.',
    );
    await expect(page.locator('.logic-bear svg')).toHaveAttribute('data-mood', 'happy');
    const p = await puzzle(page);
    await expect(page.locator('.logic-bear')).toHaveAttribute(
      'style',
      new RegExp(`--row: ${p.honeyRow}; --col: ${p.honeyCol}`),
    );
    await page.getByRole('button', { name: i < 4 ? 'Next exercise' : 'See how you did' }).click();
  }
  await expect(page.getByText('5 / 5')).toBeVisible();
});

test('wrong walk: paw dots, the bear back at the start, arrows kept; a change clears the dots', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startLesson(page, 'sk');
  const p = await puzzle(page);
  // One arrow away from the bear, never to the honey (the honey is 2-4 moves away).
  const arrow = p.bearCol < 3 ? '.arrow-right' : '.arrow-left';
  await page.locator(arrow).click();
  await page.locator('.logic-go').click();
  await expect(page.locator('#answer-feedback')).toHaveText(
    /Medveď nie je pri mede\. Oprav šípky a skús znova\./,
  );
  await expect(page.locator('.logic-cell[data-paw]')).toHaveCount(1);
  await expect(page.locator('.logic-bear')).toHaveAttribute(
    'style',
    new RegExp(`--row: ${p.bearRow}; --col: ${p.bearCol}`),
  );
  await expect(page.locator('.arrow-slot[data-filled]')).toHaveCount(1);
  await page.locator('.logic-remove').click();
  await expect(page.locator('.logic-cell[data-paw]')).toHaveCount(0);
  await expect(page.locator('#answer-feedback')).toHaveText('');
});

test('keyboard: arrow keys plan, Backspace removes, Enter goes; Tab + Enter on Show me stays Show me', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await startLesson(page);
  await expect(page.locator('.logic-board')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Backspace');
  const keys = (await rightPath(page)).map((a) =>
    a === '.arrow-right'
      ? 'ArrowRight'
      : a === '.arrow-left'
        ? 'ArrowLeft'
        : a === '.arrow-up'
          ? 'ArrowUp'
          : 'ArrowDown',
  );
  for (const key of keys) await page.keyboard.press(key);
  await expect(page.locator('.arrow-slot[data-filled]')).toHaveCount(keys.length);
  // No page scroll from the arrow keys.
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.locator('.logic-show-me').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.logic-demo')).toBeVisible();
  await expect(page.locator('.logic-board')).toBeVisible({ timeout: DEMO_MS + 3000 });
  await expect(page.locator('.arrow-slot[data-filled]')).toHaveCount(keys.length);
  await page.locator('.logic-board').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#answer-feedback')).toHaveText(/found the honey/);
  await expect(page.getByRole('button', { name: 'Next exercise' })).toBeFocused();
});

test('a double tap on Go walks once and counts one try', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startLesson(page);
  const p = await puzzle(page);
  await page.locator(p.bearCol < 3 ? '.arrow-right' : '.arrow-left').click();
  await page.locator('.logic-go').dblclick();
  await expect(page.locator('#answer-feedback')).toHaveText(/not at the honey/);
  await expect(page.locator('.logic-cell[data-paw]')).toHaveCount(1);
});

test('QA271-01: right after a wrong walk an arrow tap counts at once and Go walks again', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startLesson(page);
  const p = await puzzle(page);
  const away = p.bearCol < 3 ? '.arrow-right' : '.arrow-left';
  await page.locator(away).click();
  await page.locator('.logic-go').click();
  // Tap an arrow in the same frame the retry text appears (no waiting for the walk back).
  const tapped = await page.evaluate(
    (selector) =>
      new Promise<{ before: number; after: number }>((resolve) => {
        const filled = () => document.querySelectorAll('.arrow-slot[data-filled]').length;
        const poll = () => {
          if (!document.getElementById('answer-feedback')!.textContent) {
            requestAnimationFrame(poll);
            return;
          }
          const before = filled();
          document.querySelector<HTMLButtonElement>(selector)!.click();
          setTimeout(() => resolve({ before, after: filled() }), 50);
        };
        poll();
      }),
    p.bearRow < 3 ? '.arrow-down' : '.arrow-up',
  );
  expect(tapped).toEqual({ before: 1, after: 2 });
  await expect(page.locator('.logic-cell[data-paw]')).toHaveCount(0);
  // The bear is on the start, and Go walks again straight away.
  await expect(page.locator('.logic-bear')).toHaveAttribute(
    'style',
    new RegExp(`--row: ${p.bearRow}; --col: ${p.bearCol}`),
    { timeout: 200 },
  );
  await page.locator('.logic-go').click();
  await expect(page.locator('.logic-practice')).toHaveAttribute('data-walking', 'true', {
    timeout: 300,
  });
  await expect(page.locator('#answer-feedback')).not.toHaveText('');
});

test('reduced motion: the demo is three still steps, then the puzzle', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await openLogic(page);
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.logic-demo-still .demo-frame')).toHaveCount(3);
  const animations = await page
    .locator('.logic-demo')
    .evaluate((el) => el.getAnimations({ subtree: true }).length);
  expect(animations).toBe(0);
  await expect(page.locator('.logic-board')).toBeVisible({ timeout: 8000 });
  // The bear jumps from cell to cell: no transition.
  expect(
    await page.locator('.logic-bear').evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toMatch(/^0s/);
  await context.close();
});
