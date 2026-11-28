import { expect, test, type Page, type Route } from '@playwright/test';
import { ALL_DEVICES, DEVICE, type Device } from './support/devices';
import { cardNames, playPerfect, startPexeso, tapCard } from './support/pexeso';

// SCRUM-324: Pexeso (memory game), Logic Levels 6-8, on the defined devices.

const LEVELS = [
  { level: 6, pairs: 6, portrait: '3x4', landscape: '4x3' },
  { level: 7, pairs: 10, portrait: '4x5', landscape: '5x4' },
  { level: 8, pairs: 15, portrait: '5x6', landscape: '6x5' },
] as const;

/** Signed in (a 12-character nickname) with the lesson endpoints; records finish requests. */
async function signedIn(page: Page) {
  const finished: unknown[] = [];
  const started: unknown[] = [];
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/me')
      return json({
        account: {
          kind: 'password',
          username: 'kid',
          nickname: 'Medvedik1234',
          look: { fur: 1, background: 1, head: 2, neck: 0, eyes: 0 },
          email: null,
          leaderboard: false,
        },
      });
    if (path === '/api/progress')
      return json({ points: 1234, streak: 3, frozen: false, today: true });
    if (path === '/api/progress/lessons') {
      started.push(request.postDataJSON());
      return json({ lessonId: 'c'.repeat(32) }, 201);
    }
    if (path === '/api/progress/lessons/finish') {
      const body = request.postDataJSON() as { points: number };
      finished.push(body);
      return json({
        points: 1234 + body.points,
        streak: 3,
        frozen: false,
        today: true,
        added: body.points,
        offer: null,
      });
    }
    return json({ available: false });
  });
  return { finished, started };
}

/** Signed out: the server answers 401 for the account. */
const signedOut = (page: Page) =>
  page.route('**/api/**', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"error":"not_signed_in"}',
    }),
  );

/** Fit numbers of the board. */
const boardFit = (page: Page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    const cards = [...document.querySelectorAll<HTMLElement>('.pexeso-card')];
    const rects = cards.map((c) => c.getBoundingClientRect());
    let overlaps = 0;
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        if (
          a.left < b.right - 0.5 &&
          b.left < a.right - 0.5 &&
          a.top < b.bottom - 0.5 &&
          b.top < a.bottom - 0.5
        )
          overlaps++;
      }
    const controls = [...document.querySelectorAll<HTMLElement>('.pexeso-practice button')];
    const bar = [...document.querySelectorAll('.app-bar > :not(.app-bar-end), .app-bar-end > *')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0);
    // The status (counter, chip, hearts, help) never sits on an app bar item.
    const status = document.querySelector('.pexeso-status')!.getBoundingClientRect();
    const statusOnBar = bar.some(
      (r) =>
        r.left < status.right &&
        status.left < r.right &&
        r.top < status.bottom &&
        status.top < r.bottom,
    );
    return {
      shape: (document.querySelector('.pexeso-practice') as HTMLElement).dataset.shape,
      count: cards.length,
      card: Math.min(...cards.map((c) => Math.min(c.offsetWidth, c.offsetHeight))),
      overlaps,
      cut: rects.filter((r) => r.left < -0.5 || r.right > d.clientWidth + 0.5 || r.top < -0.5)
        .length,
      sideScroll: d.scrollWidth - d.clientWidth,
      pageScroll: d.scrollHeight - d.clientHeight,
      smallestControl: Math.min(...controls.map((b) => Math.min(b.offsetWidth, b.offsetHeight))),
      statusOnBar,
    };
  });

function checkFit(
  fit: Awaited<ReturnType<typeof boardFit>>,
  d: Device,
  pairs: number,
  where: string,
) {
  expect(fit.count, where).toBe(pairs * 2);
  expect(fit.overlaps, where).toBe(0);
  expect(fit.cut, where).toBe(0);
  expect(fit.sideScroll, where).toBeLessThanOrEqual(0);
  expect(fit.card, where).toBeGreaterThanOrEqual(48);
  expect(fit.smallestControl, where).toBeGreaterThanOrEqual(44);
  expect(fit.statusOnBar, where).toBe(false);
  // At 100% text no board makes the page scroll on the defined devices.
  expect(fit.pageScroll, where).toBeLessThanOrEqual(0);
}

test.describe('menu (AC 1)', () => {
  for (const sk of [false, true])
    test(`Logic Levels 6-8: names, detail lines, ages 5-9+, no count choice (${sk ? 'sk' : 'en'})`, async ({
      page,
    }) => {
      await signedOut(page);
      await page.goto(sk ? '/?lang=sk' : '/');
      await page
        .getByRole('button', { name: sk ? /^Logika/ : /^Logic/ })
        .first()
        .click();
      const levels = page.locator('input[name="logic-level"]');
      await expect(levels).toHaveCount(8);
      for (const { level, pairs } of LEVELS) {
        const row = page.locator(`.level-option.level-${level}`);
        await expect(row.locator('.level-title')).toHaveText(
          `${sk ? 'Úroveň' : 'Level'} ${level} · ${sk ? 'Pexeso' : 'Matching pairs'}`,
        );
        await expect(row.locator('.level-detail')).toHaveText(
          sk
            ? `${pairs} obrázkov: otoč dve karty a nájdi dvojice`
            : `${pairs} pictures: turn two cards and find the pairs`,
        );
        await expect(row.locator('.level-age')).toHaveText('5–9');
        await row.locator('input').check({ force: true });
        // The count keeps its room, invisible and out of reach (the menu does not move).
        await expect(page.locator('.selection .session-options')).toBeHidden();
        await expect(page.getByRole('radio', { name: /(exercises|príkladov)$/ })).toHaveCount(0);
      }
      await page.locator('.level-option.level-2 input').check({ force: true });
      await expect(page.locator('.selection .session-options')).toBeVisible();
    });
});

test.describe('boards fit the defined devices (AC 2, 3)', () => {
  for (const d of ALL_DEVICES)
    test(`${d.name} ${d.width}x${d.height}: 12 / 20 / 30 cards, shape, >= 48 px, no overlap or sideways scroll`, async ({
      browser,
    }) => {
      test.setTimeout(120_000);
      for (const sk of [false, true]) {
        const context = await browser.newContext({
          viewport: { width: d.width, height: d.height },
          hasTouch: d.touch,
        });
        const page = await context.newPage();
        // EN signed in (chip, hearts, long nickname), SK signed out.
        if (sk) await signedOut(page);
        else await signedIn(page);
        await page.goto(sk ? '/?lang=sk' : '/');
        if (!sk) await expect(page.getByRole('button', { name: /Medvedik1234/ })).toBeVisible();
        for (const { level, pairs, portrait, landscape } of LEVELS) {
          await startPexeso(page, level, sk);
          const where = `${d.name} ${sk ? 'sk out' : 'en in'} L${level}`;
          const before = await boardFit(page);
          expect(before.shape, where).toBe(d.width > d.height ? landscape : portrait);
          checkFit(before, d, pairs, where);
          await tapCard(page, 0);
          await tapCard(page, 1);
          checkFit(await boardFit(page), d, pairs, `${where} (2 open)`);
          await page.locator('.back-button').click();
          const leave = page.locator('.leave-dialog .secondary');
          if (await leave.isVisible()) await leave.click();
          await expect(page.locator('.logic-home')).toBeVisible();
          await page.locator('.back-button').click();
        }
        await context.close();
      }
    });

  for (const d of [DEVICE.phone, DEVICE.smallPhone])
    test(`200% text ${d.width}x${d.height}: cards >= 48 px, no sideways scroll, bar clear of the board (EN and SK, signed in)`, async ({
      browser,
    }) => {
      test.setTimeout(90_000);
      for (const sk of [false, true]) {
        const context = await browser.newContext({
          viewport: { width: d.width, height: d.height },
          hasTouch: true,
        });
        const page = await context.newPage();
        await signedIn(page);
        await page.goto(sk ? '/?lang=sk' : '/');
        await page.addStyleTag({ content: 'html{font-size:200% !important}' });
        for (const { level, pairs } of LEVELS) {
          await startPexeso(page, level, sk);
          const fit = await boardFit(page);
          const where = `${sk ? 'sk' : 'en'} L${level}`;
          expect(fit.count, where).toBe(pairs * 2);
          expect(fit.card, where).toBeGreaterThanOrEqual(48);
          expect(fit.sideScroll, where).toBeLessThanOrEqual(0);
          expect(fit.overlaps, where).toBe(0);
          // The app bar keeps its usual lesson layout at 200% (as in the other Logic lessons);
          // none of its items covers the status or the board.
          expect(fit.statusOnBar, where).toBe(false);
          const barOnBoard = await page.evaluate(() => {
            const board = document.querySelector('.pexeso-board')!.getBoundingClientRect();
            return [...document.querySelectorAll('.app-bar > :not(.app-bar-end), .app-bar-end > *')]
              .map((e) => e.getBoundingClientRect())
              .some(
                (r) =>
                  r.width > 0 &&
                  r.bottom > board.top + 0.5 &&
                  r.left < board.right &&
                  board.left < r.right,
              );
          });
          expect(barOnBoard, where).toBe(false);
          await page.locator('.back-button').click();
          await page.locator('.back-button').click();
        }
        await context.close();
      }
    });
});

test('negative controls: the fit check sees small cards, overlaps, cut cards and the status on the bar', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await signedIn(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Medvedik1234/ })).toBeVisible();
  await startPexeso(page, 8);
  const clean = await boardFit(page);
  expect([clean.card >= 48, clean.overlaps, clean.cut, clean.statusOnBar]).toEqual([
    true,
    0,
    0,
    false,
  ]);
  const controls: [string, (f: typeof clean) => boolean][] = [
    ['.pexeso-practice{--card:40px !important}', (f) => f.card < 48],
    ['.pexeso-card:nth-child(2){transform:translateX(-20px) !important}', (f) => f.overlaps > 0],
    [
      '.pexeso-board{grid-template-columns:repeat(var(--cols),90px) !important}',
      (f) => f.cut > 0 && f.sideScroll > 0,
    ],
    [
      '.pexeso-status{position:fixed !important;top:4px !important;left:4px !important}',
      (f) => f.statusOnBar,
    ],
  ];
  for (const [css, caught] of controls) {
    const tag = await page.addStyleTag({ content: css });
    await page.waitForTimeout(100);
    expect(caught(await boardFit(page)), css).toBe(true);
    await tag.evaluate((el) => (el as Element).remove());
  }
  await context.close();
});

test.describe('turns (AC 4, 11)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  // A fixed board for these tests: Math.random from a seeded generator (the app is unchanged).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      let state = 324;
      Math.random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
    });
  });

  test('two open at most, the 1.5 s close, the next tap closes at once; a double tap opens one card', async ({
    page,
  }) => {
    await signedOut(page);
    await page.goto('/');
    await startPexeso(page, 8);
    const names = () => cardNames(page);
    const openCount = async () => (await names()).filter((n) => !n.endsWith('face down')).length;
    // A double tap on one card opens just that card.
    await page.locator('.pexeso-card').nth(0).dblclick();
    expect(await openCount()).toBe(1);
    await tapCard(page, 0); // the open card again: nothing
    expect(await openCount()).toBe(1);
    // Find a second card that is not the partner (a miss), learn its picture by opening it.
    let second = 1;
    await tapCard(page, second);
    let shown = await names();
    if (shown[0].endsWith('found')) {
      // It was the pair: open two new cards for the miss.
      await tapCard(page, 2);
      second = 3;
      await tapCard(page, second);
      shown = await names();
    }
    if (shown[second].endsWith('found')) test.skip(true, 'two pairs in a row on a random board');
    expect(await openCount()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.pexeso-message')).toHaveText('Not a pair');
    const openBefore = (await names()).filter((n) => /^Card \d+, (?!face down)/.test(n));
    expect(openBefore).toHaveLength(2);
    // Fast double tap on a third card during the 1.5 s: the miss closes, one card opens.
    const third = (await names()).findIndex((n, i) => i > second && n.endsWith('face down'));
    await page.waitForTimeout(320);
    await page.locator('.pexeso-card').nth(third).dblclick();
    const after = (await names()).filter((n) => /^Card \d+, (?!face down)/.test(n));
    expect(after).toEqual([expect.stringMatching(new RegExp(`^Card ${third + 1}, `))]);
    // Second card of a new miss: both close by themselves after 1.5 s.
    const fourth = (await names()).findIndex((n, i) => i > third && n.endsWith('face down'));
    await tapCard(page, fourth);
    const pairNow = (await names())[fourth].endsWith('found');
    if (!pairNow) {
      await page.waitForTimeout(1300);
      expect((await names()).filter((n) => /^Card \d+, (?!face down)/.test(n))).toHaveLength(2);
      await page.waitForTimeout(400);
      expect((await names()).filter((n) => /^Card \d+, (?!face down)/.test(n))).toHaveLength(0);
    }
  });

  test('keyboard: Tab reaches the cards in order, Enter and Space turn them; focus stays', async ({
    page,
  }) => {
    await signedOut(page);
    await page.goto('/');
    await startPexeso(page, 6);
    await expect(page.getByRole('heading', { level: 2, name: 'Find the pairs' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.pexeso-card').nth(0)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.pexeso-card').nth(0)).toHaveAttribute(
      'aria-label',
      /^Card 1, (?!face down)/,
    );
    await expect(page.locator('.pexeso-card').nth(0)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.pexeso-card').nth(1)).toBeFocused();
    await page.waitForTimeout(320); // a deliberate next press (300 ms between accepted turns)
    await page.keyboard.press('Space');
    await expect(page.locator('.pexeso-card').nth(1)).not.toHaveAttribute(
      'aria-label',
      /face down$/,
    );
    await expect(page.locator('.pexeso-message')).toHaveText(
      /^(Not a pair|Pair found: .+, 1 of 6)$/,
    );
  });
  test('keyboard: a held or fast repeated Enter on card 2 does not close the miss at once', async ({
    page,
  }) => {
    await signedOut(page);
    await page.goto('/');
    await startPexeso(page, 8);
    const cards = page.locator('.pexeso-card');
    const openCount = async () =>
      (await cardNames(page)).filter((n) => /^Card \d+, (?!face down)/.test(n)).length;
    // Card 1 by keyboard, then the next face-down cards until a turn is a miss.
    let first = 0;
    let second = 1;
    for (;;) {
      await cards.nth(first).focus();
      await page.keyboard.press('Enter');
      await expect(cards.nth(first)).toHaveAttribute('aria-label', /^Card \d+, (?!face down)/);
      await page.waitForTimeout(320);
      await cards.nth(second).focus();
      await page.keyboard.down('Enter'); // card 2, and the key stays down
      await expect(page.locator('.pexeso-message')).toHaveText(/^(Not a pair|Pair found: .+)$/);
      if (
        (await cardNames(page))[second].endsWith('face down') === false &&
        (await openCount()) === 2
      )
        break;
      await page.keyboard.up('Enter');
      if (second + 2 >= 30) test.skip(true, 'no miss on this board');
      first = second + 1;
      second = first + 1;
      await page.waitForTimeout(320);
    }
    // Held: auto-repeat keydowns for ~0.5 s (Playwright sends repeat: true on a held key).
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(40);
      await page.keyboard.down('Enter');
    }
    await page.keyboard.up('Enter');
    expect(await openCount()).toBe(2);
    await expect(cards.nth(second)).toBeFocused();
    // The miss still closes by itself after 1.5 s.
    await expect.poll(openCount, { timeout: 2500 }).toBe(0);
    // Fast repeated Enter: the first press opens card 1 of a new turn, a press right after it
    // on card 2 is ignored (within 300 ms of the accepted press).
    await page.waitForTimeout(320);
    await cards.nth(first).focus();
    await page.keyboard.press('Enter');
    await cards.nth(second).focus();
    await page.keyboard.press('Enter');
    expect(await openCount()).toBe(1);
    // A deliberate Enter still turns card 2: the same miss again, both open.
    await page.waitForTimeout(320);
    await page.keyboard.press('Enter');
    expect(await openCount()).toBe(2);
    await expect(page.locator('.pexeso-message')).toHaveText('Not a pair');
  });
});

test.describe('a whole game (AC 6, 8, 9)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('signed in: perfect memory gives full points, saved once with size = pairs; summary and Play again', async ({
    page,
  }) => {
    const server = await signedIn(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Medvedik1234/ })).toBeVisible();
    await startPexeso(page, 6);
    await expect(page.locator('.pexeso-chip')).toContainText('6');
    await expect(page.locator('.pexeso-heart')).toHaveCount(1);
    const turns = await playPerfect(page);
    await expect(page.locator('.summary')).toContainText('Pairs found: 6');
    await expect(page.locator('.summary')).toContainText(`Turns: ${turns}`);
    await expect(page.locator('.summary .points-added')).toContainText('6 points');
    await expect(page.locator('.pexeso-heart[data-used]')).toHaveCount(0);
    expect(server.started).toEqual([{ size: 6 }]);
    await expect
      .poll(() => server.finished)
      .toEqual([expect.objectContaining({ size: 6, points: 6 })]);
    // Summary fits the phone.
    const scroll = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    expect(scroll).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.locator('.pexeso-card')).toHaveCount(12);
    expect((await cardNames(page)).every((n) => n.endsWith('face down'))).toBe(true);
    await expect(page.getByRole('heading', { level: 2, name: 'Find the pairs' })).toBeFocused();
  });

  test('leaving mid-game asks first and saves nothing; signed out the game is fully playable', async ({
    page,
  }) => {
    const server = await signedIn(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Medvedik1234/ })).toBeVisible();
    await startPexeso(page, 6);
    await tapCard(page, 0);
    await page.locator('.back-button').click();
    await expect(page.getByRole('dialog')).toContainText('Leave this trail?');
    await page.locator('.leave-dialog .secondary').click();
    await expect(page.locator('.logic-home')).toBeVisible();
    await page.waitForTimeout(300);
    expect(server.finished).toEqual([]);
  });

  test('signed out: the whole game, no chip or hearts, the sign-in invitation in the summary', async ({
    page,
  }) => {
    await signedOut(page);
    await page.goto('/?lang=sk');
    await startPexeso(page, 7, true);
    await expect(page.locator('.pexeso-chip')).toHaveCount(0);
    await expect(page.locator('.pexeso-hearts')).toHaveCount(0);
    await playPerfect(page);
    await expect(page.locator('.summary')).toContainText('Nájdené dvojice: 10');
    await expect(page.locator('.summary .points-hint')).toBeVisible();
  });
});
