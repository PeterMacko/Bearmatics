import { expect, test, type Page } from '@playwright/test';
import { solveAll } from './support/bearPicks';
import { answerFor } from './support/maths';
import { mockApi } from './support/mockApi';
import { SETTLE_WAIT_MS } from './support/timing';

// SCRUM-309 "Bear picks a game": the mode's screens and chain in the browser (signed out and
// with a mocked signed-in bar), double taps, keyboard, the English Play gesture and the fit of
// the course choice and the two new screens at the defined devices.

const heading = (page: Page) => page.getByRole('heading', { level: 2 });
const game = (page: Page) =>
  page
    .locator('.pick-game')
    .evaluate(
      (el) =>
        `${el.querySelector('.pick-game-course')!.textContent}|${el.querySelector('.pick-game-level')!.textContent}`,
    );
const store = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('bearmatics-bear-picks') ?? 'null'));
async function openMode(page: Page) {
  await page.getByRole('button', { name: 'Bear picks a game' }).click();
  await page.waitForTimeout(SETTLE_WAIT_MS);
}
/**
 * Choose another until the shown game's course and level text match. By keyboard (Enter is
 * never held back); every new game restarts the 600 ms tap guard, so wait it out at the end.
 */
async function until(page: Page, match: RegExp) {
  let pressed = false;
  for (let i = 0; i < 200 && !match.test(await game(page)); i++) {
    await page.getByRole('button', { name: 'Choose another' }).press('Enter');
    pressed = true;
  }
  expect(await game(page)).toMatch(match);
  if (pressed) await page.waitForTimeout(SETTLE_WAIT_MS);
}
/** SCRUM-324: Math.random always returns `value` (a fixed Bear picks choice). */
const rngAlways = (page: Page, value: number) =>
  page.addInitScript((v) => {
    Math.random = () => v;
  }, value);
/** SCRUM-324: any game but Pexeso (Logic 6-8 have no exercise count on this screen). */
const NOT_PEXESO = /^(?!Logic\|Level [678] )/;

test('age screen, next-game screen, Choose another, remembered age and count', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await openMode(page);
  await expect(heading(page)).toHaveText('How old are you?');
  await expect(heading(page)).toBeFocused();
  await page.getByRole('button', { name: '7 years', exact: true }).click();
  await expect(heading(page)).toHaveText('The bear picked this game');
  await expect(heading(page)).toBeFocused();
  expect(await store(page)).toEqual({ age: 7, size: 5 });
  await until(page, NOT_PEXESO);
  await expect(page.getByRole('radio', { name: '5 exercises' })).toBeChecked();
  // Signed out: the sign-in note above the exercise count instead of the × 1.5.
  await expect(page.locator('.pick-note')).toHaveText(
    'Sign in to collect points and compare with other players.',
  );
  await expect(page.locator('.pick-tag-mode')).toHaveCount(0);
  // Age badge of the shown game contains 7.
  const [from, to] = ((await page.locator('.pick-tag-age').textContent()) ?? '')
    .split('–')
    .map(Number);
  expect(from <= 7 && 7 <= to).toBe(true);
  await page.locator('.pick-sizes label').nth(1).click();
  expect(await store(page)).toEqual({ age: 7, size: 10 });
  await page.waitForTimeout(SETTLE_WAIT_MS);
  // Deliberate taps on Choose another: a different game each time.
  for (let i = 0; i < 10; i++) {
    const before = await game(page);
    await page.getByRole('button', { name: 'Choose another' }).click();
    expect(await game(page)).not.toBe(before);
    await page.waitForTimeout(SETTLE_WAIT_MS);
  }
  // Next time the mode opens: no age question, the count from last time.
  await page.reload();
  await openMode(page);
  await expect(heading(page)).toHaveText('The bear picked this game');
  await until(page, NOT_PEXESO);
  await expect(page.getByRole('radio', { name: '10 exercises' })).toBeChecked();
  await page.getByRole('button', { name: 'Change age (7)' }).click();
  await expect(heading(page)).toHaveText('How old are you?');
  await expect(page.getByRole('button', { name: '7 years', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.waitForTimeout(SETTLE_WAIT_MS);
  await page.getByRole('button', { name: '9 years or older' }).click();
  await expect(page.getByRole('button', { name: 'Change age (9+)' })).toBeVisible();
  expect(await store(page)).toEqual({ age: 9, size: 10 });
  expect(Number((await page.locator('.pick-tag-age').textContent())!.split('–')[1])).toBe(9);
  // Stop and the bar's Back lead to the course choice.
  await page.waitForTimeout(SETTLE_WAIT_MS);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(heading(page)).toHaveText('What shall we learn today?');
  await expect(heading(page)).toBeFocused();
  await page.waitForTimeout(SETTLE_WAIT_MS);
  await openMode(page);
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await expect(heading(page)).toHaveText('What shall we learn today?');
});

test('keyboard: Tab order, Enter and Space work at once; Slovak copy', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  // SCRUM-324: a fixed pick (Math.random always 0: the first course and level of the age's
  // pool, Maths Level 2 at 8; Choose another then Maths Level 3), so the bear never shows a
  // Pexeso game here, which has no exercise count to Tab to (its own test is below).
  await rngAlways(page, 0);
  await page.goto('/?lang=sk');
  const pick = page.getByRole('button', { name: 'Medveď vyberie hru' });
  // Signed out: no points, so no × 1,5; the intro invites to sign in.
  await expect(pick).toHaveAccessibleDescription('Hry pre tvoj vek');
  await expect(page.locator('.course-choice .intro')).toHaveText(
    'Prihlás sa, zbieraj body a porovnaj sa s ostatnými hráčmi.',
  );
  await pick.focus();
  await page.keyboard.press('Enter');
  await expect(heading(page)).toHaveText('Koľko máš rokov?');
  await expect(heading(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '5 rokov' })).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '8 rokov' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(heading(page)).toHaveText('Medveď vybral túto hru');
  await expect(heading(page)).toBeFocused();
  // Heading → exercise count → Hrať → Vyber inú → Skončiť → Zmeniť vek.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: '5 príkladov' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: '10 príkladov' })).toBeChecked();
  const names = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    names.push(await page.evaluate(() => document.activeElement?.textContent?.trim()));
  }
  expect(names).toEqual(['Hrať', 'Vyber inú', 'Skončiť', 'Zmeniť vek (8)']);
  const before = await game(page);
  await page.getByRole('button', { name: 'Vyber inú' }).focus();
  await page.keyboard.press('Enter');
  expect(await game(page)).not.toBe(before);
  await expect(page.locator('.pick-game')).toHaveAttribute('aria-live', 'polite');
  // Screen-reader texts on the game: the age range; signed out no x1.5, the sign-in note instead.
  await expect(page.locator('.pick-game .sr-only').first()).toHaveText(/^Vek \d až \d rokov$/);
  await expect(page.locator('.pick-game')).not.toContainText('jeden a pol násobok bodov');
  await expect(page.locator('.pick-note')).toHaveText(
    'Prihlás sa, zbieraj body a porovnaj sa s ostatnými hráčmi.',
  );
});

test('a lesson in the mode: count used, Next game / Stop on the summary, double taps ignored', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem('bearmatics-bear-picks', JSON.stringify({ age: 9, size: 5 })),
  );
  await page.goto('/');
  await openMode(page);
  await until(page, /^Maths\|/);
  const played = await game(page);
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.exercise-position')).toHaveText('Exercise 1 of 5');
  await expect(page.getByRole('button', { name: 'Back to courses' })).toBeVisible();
  await solveAll(page);
  const next = page.getByRole('button', { name: 'Next game' });
  await expect(next).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play again' })).toHaveCount(0);
  // Double tap on Next game: the second press lands on the new screen's Play (detail 2) and a
  // quick fresh tap on Stop (detail 1) follows; both are ignored.
  // Dispatched in one go, so a slow engine cannot stretch the taps past the 600 ms guard (React
  // commits the new screen right after the first click, within a task).
  await next.evaluate(async (el) => {
    const click = (target: Element | null | undefined, detail: number) =>
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }));
    click(el, 1);
    await new Promise((resolve) => setTimeout(resolve, 0)); // React commits the new screen
    const find = (name: string) =>
      [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
    if (!find('Choose another')) throw new Error('the next-game screen is not shown yet');
    click(find('Play'), 2);
    click(find('Stop'), 1);
  });
  await expect(heading(page)).toHaveText('The bear picked this game');
  await expect(page.getByRole('textbox')).toHaveCount(0);
  expect(await game(page)).not.toBe(played);
  await page.waitForTimeout(SETTLE_WAIT_MS);
  await until(page, NOT_PEXESO);
  await page.locator('.pick-sizes label').nth(1).click();
  await until(page, /^Maths\|/);
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.exercise-position')).toHaveText('Exercise 1 of 10');
  // Leaving early (with work done): the leave question, then the course choice.
  await page.getByRole('textbox').fill(String(await answerFor(page)));
  await page.locator('.answer-button').click();
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await page.getByRole('button', { name: 'Choose a new trail' }).click();
  await expect(heading(page)).toHaveText('What shall we learn today?');
  await expect(heading(page)).toBeFocused();
  // QA321-06: a tap on a card right after leaving is the rest of the double tap: ignored.
  await page.getByRole('button', { name: 'Small maths' }).click();
  await expect(heading(page)).toHaveText('What shall we learn today?');
  await page.waitForTimeout(SETTLE_WAIT_MS);
  // Normal menus keep their own count (10), untouched by the mode's choice.
  await page.getByRole('button', { name: 'Small maths' }).click();
  await expect(page.getByRole('radio', { name: '10 exercises' })).toBeChecked();
});

test('SCRUM-324 AC10: a Pexeso pick has no exercise count, keeps the remembered count and plays its own board', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem('bearmatics-bear-picks', JSON.stringify({ age: 8, size: 20 })),
  );
  // Math.random always 0.45: at 8 the courses are Maths, Logic, English, Word search -> Logic
  // (index 1 of 4); its levels 2, 5, 6, 7, 8 -> Level 6 (index 2 of 5), a Pexeso. Choose
  // another then leaves 2, 5, 7, 8 -> Level 5; once more 2, 6, 7, 8 -> Level 6 again.
  await rngAlways(page, 0.45);
  await page.goto('/');
  await openMode(page);
  await expect(heading(page)).toHaveText('The bear picked this game');
  await expect(heading(page)).toBeFocused();
  expect(await game(page)).toBe('Logic|Level 6 · Matching pairs');
  // No exercise count: no radio for screen readers or the keyboard, and Tab goes from the
  // heading straight to Play.
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.locator('.pick-sizes')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.pick-sizes')).toHaveAttribute('inert', '');
  const names = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    names.push(await page.evaluate(() => document.activeElement?.textContent?.trim()));
  }
  expect(names).toEqual(['Play', 'Choose another', 'Stop', 'Change age (8)']);
  expect(await store(page)).toEqual({ age: 8, size: 20 });
  // A game with a count: the remembered 20 is still chosen.
  await page.getByRole('button', { name: 'Choose another' }).press('Enter');
  expect(await game(page)).toBe('Logic|Level 5 · Growing and turning');
  await expect(page.getByRole('radio', { name: '20 exercises' })).toBeChecked();
  await expect(page.getByRole('radio')).toHaveCount(3);
  // Back to the Pexeso and play it: 12 cards (6 pictures), whatever the remembered count.
  await page.getByRole('button', { name: 'Choose another' }).press('Enter');
  expect(await game(page)).toBe('Logic|Level 6 · Matching pairs');
  await page.getByRole('button', { name: 'Play' }).press('Enter');
  await expect(page.locator('.pexeso-card')).toHaveCount(12);
  expect(await store(page)).toEqual({ age: 8, size: 20 });
});

test('English listen: the first word plays from the Play tap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('bearmatics-bear-picks', JSON.stringify({ age: 5, size: 5 }));
    const played: string[] = [];
    (window as unknown as { played: string[] }).played = played;
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      played.push(this.src);
      return original.call(this).catch(() => undefined);
    };
  });
  await page.goto('/');
  await openMode(page);
  await until(page, /^English\|Level 1 /);
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.word-option').first()).toBeVisible();
  const played = await page.evaluate(() => (window as unknown as { played: string[] }).played);
  expect(played).toHaveLength(1);
  expect(played[0]).toMatch(/\/audio\/words\/.+\.mp3$/);
});

// Fit at the defined devices: page scroll, sideways scroll, 48 px targets, everything visible.
const DEVICES: [string, number, number, boolean][] = [
  ['390x844', 390, 844, false],
  ['360x640', 360, 640, false],
  ['320x568', 320, 568, false],
  ['844x390', 844, 390, false],
  ['568x320', 568, 320, false],
  ['820x1180', 820, 1180, false],
  ['1180x820', 1180, 820, false],
  ['884x1004', 884, 1004, false],
  ['884x838', 884, 838, false],
  ['884x600', 884, 600, false],
  ['1366x900', 1366, 900, false],
  ['1280x520', 1280, 520, false],
  ['733x500', 733, 500, false],
  ['390x844 200%', 390, 844, true],
  ['320x568 200%', 320, 568, true],
];
async function fit(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector('main')!;
    const small = [
      ...main.querySelectorAll(
        '.bear-picks-button, .course-option, .pick-panel button, .pick-sizes label',
      ),
    ]
      .filter((e) => (e as HTMLElement).offsetWidth < 48 || (e as HTMLElement).offsetHeight < 48)
      .map((e) => e.textContent);
    const inner = [...main.querySelectorAll('*')]
      .filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowX))
      .map((e) => e.scrollWidth - e.clientWidth);
    // Every control of the new screens can be reached (inside the page, not clipped sideways).
    const outside = [...main.querySelectorAll('.pick-panel button, .pick-panel label')]
      .filter((e) => {
        const b = e.getBoundingClientRect();
        return b.left < -1 || b.right > doc.clientWidth + 1 || b.bottom > doc.scrollHeight + 1;
      })
      .map((e) => e.textContent);
    // App bar buttons over the screen's text or controls (text measured on its Range boxes, as
    // in app-bar.spec).
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== 'hidden';
    };
    const items = [...document.querySelectorAll('.app-bar button')].filter(visible);
    const content = [
      ...main.querySelectorAll('h2, p, label, legend, button, .pick-game, .course-option'),
    ].filter(visible);
    const barOverlaps: string[] = [];
    for (const item of items) {
      const a = item.getBoundingClientRect();
      for (const c of content) {
        let boxes = [c.getBoundingClientRect()];
        if (/^(P|H2|LABEL|LEGEND)$/.test(c.tagName)) {
          const range = document.createRange();
          range.selectNodeContents(c);
          boxes = [...range.getClientRects()];
        }
        if (
          boxes.some(
            (r) =>
              r.width > 0 &&
              a.left < r.right - 0.5 &&
              r.left < a.right - 0.5 &&
              a.top < r.bottom - 0.5 &&
              r.top < a.bottom - 0.5,
          )
        )
          barOverlaps.push(`${item.getAttribute('aria-label')} / ${c.tagName}.${c.className}`);
      }
    }
    return {
      barOverlaps,
      mode: main.dataset.menuMode ?? null,
      pageScroll: doc.scrollHeight - doc.clientHeight,
      sideScroll: Math.max(doc.scrollWidth - doc.clientWidth, 0, ...inner),
      small,
      outside,
    };
  });
}

for (const signed of ['out', 'in'] as const)
  for (const lang of ['en', 'sk'] as const)
    test(`fit at the defined devices: course choice, age and next-game screens (signed ${signed}, ${lang})`, async ({
      browser,
    }) => {
      test.setTimeout(240_000);
      const results: Record<string, unknown> = {};
      for (const [name, width, height, big] of DEVICES) {
        const context = await browser.newContext({ viewport: { width, height } });
        const page = await context.newPage();
        if (signed === 'in')
          await mockApi(page, {
            nickname: 'Abcdefghijkl',
            points: 1234,
            streak: 12,
            frozen: false,
            today: true,
          });
        await page.goto(lang === 'sk' ? '/?lang=sk' : '/');
        if (big) await page.addStyleTag({ content: 'html{font-size:200% !important}' });
        if (signed === 'in')
          await expect(page.getByRole('button', { name: /Abcdefghijkl/ })).toBeVisible();
        await page.waitForTimeout(300);
        const choice = await fit(page);
        await page.locator('.bear-picks-button').click();
        await page.waitForTimeout(SETTLE_WAIT_MS);
        const age = await fit(page);
        await page.locator('.pick-age-button').nth(3).click();
        await page.waitForTimeout(SETTLE_WAIT_MS);
        // The worst of several games (titles differ in length).
        let next = await fit(page);
        for (let i = 0; i < 8; i++) {
          await page.locator('.pick-another').click();
          const m = await fit(page);
          if (m.pageScroll > next.pageScroll) next = m;
        }
        results[name] = { choice, age, next };
        const where = `${name} ${lang} signed ${signed}`;
        for (const [screen, m] of Object.entries({ choice, age, next })) {
          expect(m.sideScroll, `${where} ${screen}: sideways`).toBeLessThanOrEqual(0);
          expect(m.small, `${where} ${screen}: targets`).toEqual([]);
          expect(m.outside, `${where} ${screen}: reachable`).toEqual([]);
        }
        // The course choice keeps its page fit (only 320x568 at 200% text flowed before), and
        // the new screens fit without page scroll at normal text size.
        if (name !== '320x568 200%') {
          expect(choice.pageScroll, `${where}: course choice page scroll`).toBeLessThanOrEqual(0);
          expect(choice.mode, `${where}: course choice mode`).toBe('contained');
        }
        if (!big) {
          // (At 200% text on phones the floating bar meets the eyebrow on every menu with Back,
          // as on main; recorded in the annotation only.)
          for (const [screen, m] of Object.entries({ choice, age, next }))
            expect(m.barOverlaps, `${where} ${screen}: app bar overlaps`).toEqual([]);
          expect(age.pageScroll, `${where}: age page scroll`).toBeLessThanOrEqual(0);
          expect(next.pageScroll, `${where}: next-game page scroll`).toBeLessThanOrEqual(0);
        }
        await context.close();
      }
      test.info().annotations.push({ type: 'fit', description: JSON.stringify(results) });
    });

test.describe('QA321-01/04: double taps on Stop and Choose another (touch)', () => {
  test.use({ hasTouch: true });
  test('Stop: the course choice only, no course card opened; Choose another picks once', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() =>
      localStorage.setItem('bearmatics-bear-picks', JSON.stringify({ age: 9, size: 5 })),
    );
    await page.goto('/');
    const centre = async (name: string) => {
      const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    await page.getByRole('button', { name: 'Bear picks a game' }).tap();
    await page.waitForTimeout(SETTLE_WAIT_MS);
    // Choose another: two taps 150 ms apart give one new game.
    const before = await game(page);
    const another = await centre('Choose another');
    await page.touchscreen.tap(another.x, another.y);
    const once = await game(page);
    expect(once).not.toBe(before);
    await page.waitForTimeout(150);
    await page.touchscreen.tap(another.x, another.y);
    expect(await game(page)).toBe(once);
    await page.waitForTimeout(SETTLE_WAIT_MS);
    // Stop, then the rest of the double tap on a course card (wherever the layout puts it
    // under the finger): nothing opens.
    const stop = await centre('Stop');
    await page.touchscreen.tap(stop.x, stop.y);
    await expect(heading(page)).toHaveText('What shall we learn today?');
    const card = await centre('Maths');
    await page.waitForTimeout(150);
    await page.touchscreen.tap(card.x, card.y);
    await page.waitForTimeout(300);
    await expect(heading(page)).toHaveText('What shall we learn today?');
    // A deliberate tap later opens the card as before.
    await page.waitForTimeout(SETTLE_WAIT_MS);
    await page.touchscreen.tap(card.x, card.y);
    await expect(heading(page)).toHaveText('Where shall we explore?');
  });
});

test('QA321-01: summary Stop: a double click opens no course menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem('bearmatics-bear-picks', JSON.stringify({ age: 9, size: 5 })),
  );
  await page.goto('/');
  await openMode(page);
  await until(page, /^Maths\|/);
  await page.getByRole('button', { name: 'Play' }).click();
  await solveAll(page);
  await page.getByRole('button', { name: 'Stop' }).dblclick();
  await page.waitForTimeout(300);
  await expect(heading(page)).toHaveText('What shall we learn today?');
});

for (const [width, height] of [
  [390, 844],
  [320, 568],
  [820, 1180],
  [1366, 900],
]) {
  test(`Peter: the Bear picks button ends where the course cards end (${width}x${height})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const card = page.locator('.course-option').first();
    await card.waitFor();
    const button = (await page.locator('.bear-picks-button').boundingBox())!;
    const box = (await card.boundingBox())!;
    expect(Math.abs(button.x - box.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(button.x + button.width - (box.x + box.width))).toBeLessThanOrEqual(1);
  });
}
