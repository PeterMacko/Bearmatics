import { expect, test, type Page } from '@playwright/test';
import { ALL_DEVICES, DEVICE } from './support/devices';
import { setLanguage } from './support/language';
import { mockApi } from './support/mockApi';

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
          // The board fit re-measures one frame after the result line fills (input opens at
          // once since QA271-01): judge the settled layout.
          await expect
            .poll(async () => (await lessonLayout(page)).pageScroll, { timeout: 2000 })
            .toBeLessThanOrEqual(1);
        }
        const layout = await lessonLayout(page);
        expect(layout.pageScroll, `${state}: page scroll`).toBeLessThanOrEqual(1);
        expect(layout.sideScroll, `${state}: side scroll`).toBeLessThanOrEqual(0);
        expect(layout.inView, `${state}: board, slots, pad, Go/Next, Show me on screen`).toBe(true);
        expect(layout.cell, `${state}: grid cell`).toBeGreaterThanOrEqual(56);
        expect(layout.smallestTarget, `${state}: smallest button`).toBeGreaterThanOrEqual(48);
      }
    });

/** Menu mode, page scroll and the smallest control of the Logic menu. */
const menuState = (page: Page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        '.logic-home .start-button, .logic-home .session-options label > span, .logic-home .level-option',
      ),
    ];
    return {
      mode: document.querySelector<HTMLElement>('.workspace')!.dataset.menuMode,
      overflow: d.scrollHeight - d.clientHeight,
      smallestTarget: Math.min(...controls.map((c) => Math.min(c.offsetWidth, c.offsetHeight))),
    };
  });

// QA271-02: the Logic menu stays contained (no page scroll, Start on screen) like the other
// menus, at every defined device in EN and SK.
for (const { name, width, height } of ALL_DEVICES)
  for (const lang of ['en', 'sk'] as const)
    test(`Logic menu: contained with no page scroll at ${name} ${width}x${height} ${lang}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await openLogic(page, lang);
      await expect(page.locator('.workspace')).toHaveAttribute('data-menu-mode', 'contained');
      const state = await menuState(page);
      expect(state.overflow, 'page scroll').toBeLessThanOrEqual(1);
      expect(state.smallestTarget, 'smallest control').toBeGreaterThanOrEqual(48);
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
      // Menu: SCRUM-36 rule (contained = no page scroll, otherwise the page scrolls). The phone
      // keeps it contained like the other menus (QA271-02); the smallest phone uses page flow
      // at 200% text on every menu.
      if (width >= 390)
        await expect(page.locator('.workspace')).toHaveAttribute('data-menu-mode', 'contained');
      const menu = await menuState(page);
      if (menu.mode === 'contained') {
        expect(menu.overflow).toBeLessThanOrEqual(1);
        await expect(page.locator('.logic-home .start-button')).toBeInViewport({ ratio: 1 });
      }
      expect(menu.smallestTarget).toBeGreaterThanOrEqual(48);
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

// ---------------------------------------------------------------------------------------------
// SCRUM-289: Level 2 "Around the stones" (1-2 stones, up to 6 arrows).

/** Bear, honey and stones (0-based) from the board's accessible name. */
async function stonePuzzle(page: Page) {
  const label = (await page.locator('.logic-board').getAttribute('aria-label'))!;
  const [bearRow, bearCol, honeyRow, honeyCol, ...rest] = label
    .match(/\d+/g)!
    .map((n) => Number(n) - 1);
  const stones: [number, number][] = [];
  for (let i = 0; i < rest.length; i += 2) stones.push([rest[i], rest[i + 1]]);
  return { bear: [bearRow, bearCol], honey: [honeyRow, honeyCol], stones };
}

const MOVES = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] } as const;

/** Arrow selectors of the shortest way from the bear to `target` around the stones. */
async function wayTo(page: Page, to: 'honey' | 'stone') {
  const p = await stonePuzzle(page);
  const key = ([r, c]: readonly number[]) => `${r},${c}`;
  const stones = new Set(p.stones.map(key));
  const goal = to === 'honey' ? [key(p.honey)] : p.stones.map(key);
  const queue: [number[], string[]][] = [[p.bear, []]];
  const seen = new Set([key(p.bear)]);
  while (queue.length) {
    const [cell, way] = queue.shift()!;
    for (const [name, [dr, dc]] of Object.entries(MOVES)) {
      const next = [cell[0] + dr, cell[1] + dc];
      if (next.some((n) => n < 0 || n > 3) || seen.has(key(next))) continue;
      // Into a stone: the end of a bump way; around the stones otherwise.
      if (goal.includes(key(next))) return [...way, `.arrow-${name}`];
      if (stones.has(key(next))) continue;
      seen.add(key(next));
      queue.push([next, [...way, `.arrow-${name}`]]);
    }
  }
  throw new Error(`no way to the ${to}`);
}

/** Starts a Level 2 lesson whose first puzzle has `stones` stones (new lessons until it has). */
async function startLevel2(page: Page, lang: 'en' | 'sk' = 'en', stones = 2) {
  await openLogic(page, lang);
  await page.locator('.logic-home .level-2').click();
  for (let tries = 0; tries < 30; tries++) {
    await page.locator('.logic-home .start-button').click();
    await expect(page.locator('.logic-board')).toBeVisible({ timeout: DEMO_MS + 3000 });
    if ((await page.locator('.logic-stone').count()) === stones) return;
    await page.locator('.back-button').click();
    await expect(page.locator('.logic-home')).toBeVisible();
  }
  throw new Error(`no first puzzle with ${stones} stones`);
}

for (const { name, width, height } of ALL_DEVICES)
  for (const lang of ['en', 'sk'] as const)
    for (const account of ['signed out', 'signed in'] as const)
      test(`Level 2 fits ${name} ${width}x${height} ${lang} ${account}: 2 stones, 6 arrows, Go on screen, no page scroll`, async ({
        page,
      }) => {
        test.setTimeout(60_000); // new lessons until the first puzzle has two stones
        if (account === 'signed in')
          await mockApi(page, {
            nickname: 'Medvedík Bru',
            points: 1234,
            streak: 12,
            frozen: false,
            today: true,
          });
        await page.setViewportSize({ width, height });
        await startLevel2(page, lang);
        await expect(page.locator('.logic-stone')).toHaveCount(2);
        await expect(page.locator('.arrow-slot')).toHaveCount(6);
        for (const arrow of ['.arrow-right', '.arrow-down', '.arrow-left', '.arrow-up']
          .flatMap((a) => [a, a])
          .slice(0, 6))
          await page.locator(arrow).click();
        await expect(page.locator('.arrow-slot[data-filled]')).toHaveCount(6);
        for (const state of ['plan', 'after Go']) {
          if (state === 'after Go') {
            await page.locator('.logic-go').click();
            await expect(page.locator('#answer-feedback')).not.toHaveText('', { timeout: 6000 });
            await expect(page.locator('.logic-practice')).not.toHaveAttribute('data-walking');
            await expect
              .poll(async () => (await lessonLayout(page)).pageScroll, { timeout: 2000 })
              .toBeLessThanOrEqual(1);
          }
          const layout = await lessonLayout(page);
          test.info().annotations.push({
            type: 'fit',
            description: JSON.stringify({ state, ...layout }),
          });
          expect(layout.pageScroll, `${state}: page scroll`).toBeLessThanOrEqual(1);
          expect(layout.sideScroll, `${state}: side scroll`).toBeLessThanOrEqual(0);
          expect(layout.inView, `${state}: board, slots, pad, Go/Next, Show me on screen`).toBe(
            true,
          );
          expect(layout.cell, `${state}: grid cell`).toBeGreaterThanOrEqual(56);
          expect(layout.smallestTarget, `${state}: smallest button`).toBeGreaterThanOrEqual(48);
          // Every stone stays inside its cell.
          const inside = await page.evaluate(() =>
            [...document.querySelectorAll('.logic-stone svg')].every((svg) => {
              const s = svg.getBoundingClientRect();
              const c = svg.closest('.logic-cell')!.getBoundingClientRect();
              return (
                s.left >= c.left - 0.5 &&
                s.right <= c.right + 0.5 &&
                s.top >= c.top - 0.5 &&
                s.bottom <= c.bottom + 0.5
              );
            }),
          );
          expect(inside, `${state}: stones inside their cells`).toBe(true);
        }
      });

for (const { name, width, height } of [DEVICE.phone, DEVICE.smallPhone])
  for (const lang of ['en', 'sk'] as const)
    test(`Level 2, 200% text ${lang} at ${name} ${width}x${height}: 6 slots usable, no sideways scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await openLogic(page, lang);
      await page.addStyleTag({ content: 'html{font-size:200% !important}' });
      await page.locator('.logic-home .level-2').click();
      await page.locator('.logic-home .start-button').click();
      await expect(page.locator('.logic-board')).toBeVisible({ timeout: DEMO_MS + 3000 });
      for (const arrow of [
        '.arrow-right',
        '.arrow-down',
        '.arrow-left',
        '.arrow-up',
        '.arrow-right',
        '.arrow-down',
      ])
        await page.locator(arrow).click();
      await expect(page.locator('.arrow-slot[data-filled]')).toHaveCount(6);
      const layout = await lessonLayout(page);
      expect(layout.sideScroll).toBeLessThanOrEqual(0);
      expect(layout.cell).toBeGreaterThanOrEqual(56);
      expect(layout.smallestTarget).toBeGreaterThanOrEqual(48);
      // Same rule as Level 1: the phone fits; the smallest phone scrolls with Go reachable.
      if (width >= 390) expect(layout.pageScroll).toBeLessThanOrEqual(1);
      await page.locator('.logic-go').scrollIntoViewIfNeeded();
      await expect(page.locator('.logic-go')).toBeInViewport({ ratio: 1 });
    });

test('Level 2: the right way round the stones finds the honey; a walk into a stone bumps (paw dots, back to start)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startLevel2(page, 'en', 2);
  const p = await stonePuzzle(page);
  const bump = await wayTo(page, 'stone');
  for (const arrow of bump) await page.locator(arrow).click();
  await page.locator('.logic-go').click();
  await expect(page.locator('#answer-feedback')).toHaveText(
    'The bear bumped into a stone. Fix the arrows and try again.',
  );
  await expect(page.locator('.logic-cell[data-paw]')).toHaveCount(bump.length - 1);
  await expect(page.locator('.logic-bear')).toHaveAttribute(
    'style',
    new RegExp(`--row: ${p.bear[0]}; --col: ${p.bear[1]}`),
  );
  await expect(page.locator('.arrow-slot[data-filled]')).toHaveCount(bump.length);
  for (let i = 0; i < bump.length; i++) await page.locator('.logic-remove').click();
  for (const arrow of await wayTo(page, 'honey')) await page.locator(arrow).click();
  await page.locator('.logic-go').click();
  await expect(page.locator('#answer-feedback')).toHaveText('The bear found the honey! Well done.');
  await expect(page.locator('.logic-bear')).toHaveAttribute(
    'style',
    new RegExp(`--row: ${p.honey[0]}; --col: ${p.honey[1]}`),
  );
});

test('Level 2: a whole lesson of 5 (tiers easier first), first try counted on the summary', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openLogic(page);
  await page.locator('.logic-home .level-2').click();
  await page.getByRole('radio', { name: '5 exercises' }).check({ force: true });
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.logic-board')).toBeVisible({ timeout: DEMO_MS + 3000 });
  const lengths: number[] = [];
  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(`Exercise ${i + 1} of 5`)).toBeVisible();
    const way = await wayTo(page, 'honey');
    lengths.push(way.length);
    for (const arrow of way) await page.locator(arrow).click();
    await page.locator('.logic-go').click();
    await expect(page.locator('#answer-feedback')).toHaveText(/found the honey/, {
      timeout: 6000,
    });
    await page.getByRole('button', { name: i < 4 ? 'Next exercise' : 'See how you did' }).click();
  }
  // Tier A (2-3 moves), B (4-5), B, C (6), C.
  expect(lengths[0]).toBeLessThanOrEqual(3);
  expect(lengths.slice(1, 3).every((n) => n === 4 || n === 5)).toBe(true);
  expect(lengths.slice(3)).toEqual([6, 6]);
  await expect(page.getByText('5 / 5')).toBeVisible();
});

// ---------------------------------------------------------------------------------------------
// SCRUM-289 / SCRUM-294: the demo once per device and the "?" balloon.

const DEMO_SEEN_KEY = 'bearmatics-logic-demo-seen';
const demoFlag = (page: Page) => page.evaluate((key) => localStorage.getItem(key), DEMO_SEEN_KEY);

test('demo once per device: fresh device sees it; after it finished the next lesson starts with the puzzle; Show me still plays it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLogic(page);
  expect(await demoFlag(page)).toBeNull();
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.logic-demo')).toBeVisible();
  await expect(page.locator('.logic-board')).toBeVisible({ timeout: DEMO_MS + 3000 });
  expect(await demoFlag(page)).toBe('1');
  await page.locator('.back-button').click();
  await page.locator('.logic-home .level-2').click();
  await page.locator('.logic-home .start-button').click();
  // Straight to the puzzle: the demo never shows (not even for a frame).
  await expect(page.locator('.logic-board')).toBeVisible();
  await expect(page.locator('.logic-board')).toBeFocused();
  await expect(page.locator('.logic-demo')).toHaveCount(0);
  // A new visit (reload) on this device too.
  await page.reload();
  await page.locator('.course-logic').click();
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.logic-board')).toBeVisible();
  await expect(page.locator('.logic-demo')).toHaveCount(0);
  await page.locator('.logic-show-me').click();
  await expect(page.locator('.logic-demo')).toBeVisible();
  await expect(page.locator('.logic-board')).toBeVisible({ timeout: DEMO_MS + 3000 });
});

test('demo once per device: leaving during the demo is not "seen"', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLogic(page);
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.logic-demo')).toBeVisible();
  await page.locator('.back-button').click();
  await expect(page.locator('.logic-home')).toBeVisible();
  await page.waitForTimeout(DEMO_MS + 300);
  expect(await demoFlag(page)).toBeNull();
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.logic-demo')).toBeVisible();
});

test('demo once per device: blocked storage plays the demo at every lesson (as before)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    for (const name of ['getItem', 'setItem'] as const)
      Storage.prototype[name] = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLogic(page);
  for (let lesson = 0; lesson < 2; lesson++) {
    await page.locator('.logic-home .start-button').click();
    await expect(page.locator('.logic-demo')).toBeVisible();
    await expect(page.locator('.logic-board')).toBeVisible({ timeout: DEMO_MS + 3000 });
    await page.locator('.back-button').click();
    await expect(page.locator('.logic-home')).toBeVisible();
  }
});

/** The balloon's box, the board's box and what a tap at the balloon's centre would hit. */
const balloonState = (page: Page) =>
  page.evaluate(() => {
    const balloon = document.querySelector<HTMLElement>('.logic-balloon');
    if (!balloon) return null;
    const b = balloon.getBoundingClientRect();
    const board = document.querySelector('.logic-board')!.getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return {
      inside:
        b.left >= board.left - 0.5 &&
        b.right <= board.right + 0.5 &&
        b.top >= board.top - 0.5 &&
        b.bottom <= board.bottom + 0.5,
      hitsBalloon: !!hit?.closest('.logic-balloon'),
      hidden: balloon.getAttribute('aria-hidden'),
      animations: balloon.getAnimations({ subtree: true }).length,
    };
  });

test('balloon: pops in on the first puzzle when the bear appears, inside the board, takes no taps, fades after 3 s', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openLogic(page);
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.logic-demo')).toBeVisible();
  await expect(page.locator('.logic-balloon')).toHaveCount(0);
  await expect(page.locator('.logic-balloon')).toBeVisible({ timeout: DEMO_MS + 3000 });
  await page.waitForTimeout(400); // the pop in (0.3 s)
  const state = await balloonState(page);
  expect(state).toMatchObject({ inside: true, hitsBalloon: false, hidden: 'true' });
  await expect(page.locator('.logic-balloon')).toHaveCount(0, { timeout: 4000 });
});

for (const width of [320, 1366])
  test(`balloon stays inside the board on every bear column (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    await page.addInitScript((key) => localStorage.setItem(key, '1'), DEMO_SEEN_KEY);
    await openLogic(page);
    const columns = new Set<number>();
    for (let tries = 0; tries < 40 && columns.size < 4; tries++) {
      await page.locator('.logic-home .start-button').click();
      await expect(page.locator('.logic-balloon')).toBeVisible();
      const { bearCol } = await puzzle(page);
      if (!columns.has(bearCol)) {
        columns.add(bearCol);
        await expect(page.locator('.logic-balloon')).toHaveAttribute(
          'data-side',
          bearCol === 3 ? 'left' : 'right',
        );
        await page.waitForTimeout(400);
        expect((await balloonState(page))!.inside, `bear column ${bearCol + 1}`).toBe(true);
      }
      await page.locator('.back-button').click();
      await expect(page.locator('.logic-home')).toBeVisible();
    }
    expect(columns.size).toBe(4);
  });

test('balloon, reduced motion: appears without growing (no animation)', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await context.addInitScript((key) => localStorage.setItem(key, '1'), DEMO_SEEN_KEY);
  const page = await context.newPage();
  await openLogic(page);
  await page.locator('.logic-home .start-button').click();
  await expect(page.locator('.logic-balloon')).toBeVisible();
  expect((await balloonState(page))!.animations).toBe(0);
  await context.close();
});
