import { expect, test, type Page } from '@playwright/test';
import { answerFor } from './support/maths';
import { mockApi } from './support/mockApi';

// SCRUM-309 "Bear picks a game": the mode's screens and chain in the browser (signed out and
// with a mocked signed-in bar), double taps, keyboard, the English Play gesture and the fit of
// the course choice and the two new screens at the defined devices.

const SETTLE = 650; // the screens ignore taps for 600 ms after they appear
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
  await page.waitForTimeout(SETTLE);
}
/** Choose another until the shown game's course and level text match. */
async function until(page: Page, match: RegExp) {
  for (let i = 0; i < 200 && !match.test(await game(page)); i++)
    await page.getByRole('button', { name: 'Choose another' }).click();
  expect(await game(page)).toMatch(match);
}
/** Answers a maths lesson to its summary, all first try. */
async function solveAll(page: Page) {
  while (!(await page.locator('.summary').isVisible())) {
    await page.getByRole('textbox').fill(String(await answerFor(page)));
    await page.locator('.answer-button').click();
    await page.locator('.answer-button').click();
  }
}

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
  await expect(page.getByRole('radio', { name: '5 exercises' })).toBeChecked();
  // Age badge of the shown game contains 7.
  const [from, to] = ((await page.locator('.pick-tag-age').textContent()) ?? '')
    .split('–')
    .map(Number);
  expect(from <= 7 && 7 <= to).toBe(true);
  await page.locator('.pick-sizes label').nth(1).click();
  expect(await store(page)).toEqual({ age: 7, size: 10 });
  await page.waitForTimeout(SETTLE);
  // Deliberate taps on Choose another: a different game each time.
  for (let i = 0; i < 10; i++) {
    const before = await game(page);
    await page.getByRole('button', { name: 'Choose another' }).click();
    expect(await game(page)).not.toBe(before);
  }
  // Next time the mode opens: no age question, the count from last time.
  await page.reload();
  await openMode(page);
  await expect(heading(page)).toHaveText('The bear picked this game');
  await expect(page.getByRole('radio', { name: '10 exercises' })).toBeChecked();
  await page.getByRole('button', { name: 'Change age (7)' }).click();
  await expect(heading(page)).toHaveText('How old are you?');
  await expect(page.getByRole('button', { name: '7 years', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.waitForTimeout(SETTLE);
  await page.getByRole('button', { name: '9 years or older' }).click();
  await expect(page.getByRole('button', { name: 'Change age (9+)' })).toBeVisible();
  expect(await store(page)).toEqual({ age: 9, size: 10 });
  expect(Number((await page.locator('.pick-tag-age').textContent())!.split('–')[1])).toBe(9);
  // Stop and the bar's Back lead to the course choice.
  await page.waitForTimeout(SETTLE);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(heading(page)).toHaveText('What shall we learn today?');
  await expect(heading(page)).toBeFocused();
  await openMode(page);
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await expect(heading(page)).toHaveText('What shall we learn today?');
});

test('keyboard: Tab order, Enter and Space work at once; Slovak copy', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/?lang=sk');
  const pick = page.getByRole('button', { name: 'Medveď vyberie hru' });
  await expect(pick).toHaveAccessibleDescription('Hry pre tvoj vek, body × 1,5');
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
  // Screen-reader texts on the game: age range and the mode's x1.5.
  await expect(page.locator('.pick-game .sr-only').first()).toHaveText(/^Vek \d až \d rokov$/);
  await expect(page.locator('.pick-game')).toContainText(
    'Medveď vyberie hru: jeden a pol násobok bodov',
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
  const nextBox = (await next.boundingBox())!;
  await page.mouse.click(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2);
  await expect(heading(page)).toHaveText('The bear picked this game');
  const playBox = (await page.getByRole('button', { name: 'Play' }).boundingBox())!;
  await page.mouse.move(playBox.x + playBox.width / 2, playBox.y + playBox.height / 2);
  await page.mouse.down({ clickCount: 2 });
  await page.mouse.up({ clickCount: 2 });
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(heading(page)).toHaveText('The bear picked this game');
  await expect(page.getByRole('textbox')).toHaveCount(0);
  expect(await game(page)).not.toBe(played);
  await page.waitForTimeout(SETTLE);
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
  // Normal menus keep their own count (10), untouched by the mode's choice.
  await page.getByRole('button', { name: 'Small maths' }).click();
  await expect(page.getByRole('radio', { name: '10 exercises' })).toBeChecked();
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
    return {
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
        await page.waitForTimeout(SETTLE);
        const age = await fit(page);
        await page.locator('.pick-age-button').nth(3).click();
        await page.waitForTimeout(SETTLE);
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
          expect(age.pageScroll, `${where}: age page scroll`).toBeLessThanOrEqual(0);
          expect(next.pageScroll, `${where}: next-game page scroll`).toBeLessThanOrEqual(0);
        }
        await context.close();
      }
      test.info().annotations.push({ type: 'fit', description: JSON.stringify(results) });
    });
