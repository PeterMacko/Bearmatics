import { expect, test, type Page } from '@playwright/test';
import { openSmallMaths } from './support/course';

// SCRUM-164: Small maths level 3 "Up to 12" at the defined devices: four dice and the
// number pad fit; the result dice appear only after the correct answer.
const DEVICES: [number, number, boolean][] = [
  [390, 844, true],
  [360, 640, true],
  [320, 568, true],
  [369, 700, true],
  [844, 390, true],
  [568, 320, true],
  [820, 1180, true],
  [1180, 820, true],
  [884, 1004, true],
  [884, 838, true],
  [884, 600, true],
  [742, 702, true],
  [1280, 520, false],
  [733, 500, false],
  [1366, 900, false],
];

async function type(page: Page, value: number) {
  const box = page.getByRole('textbox');
  if ((await box.getAttribute('readonly')) !== null)
    for (const digit of String(value))
      await page.getByRole('button', { name: digit, exact: true }).click();
  else await box.fill(String(value));
  await page.getByRole('button', { name: 'Check answer' }).click();
}

for (const [width, height, touch] of DEVICES)
  test(`up to 12 fits ${width}x${height}: four dice, number pad and Next on screen`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch && width < 900,
    });
    const page = await context.newPage();
    await page.goto('/');
    await openSmallMaths(page);
    await page.getByRole('radio', { name: /^Level 3 · Up to 12/ }).check();
    await page.getByRole('button', { name: 'Let’s count' }).click();
    const [a, b] = await page
      .locator('.equation [data-term]')
      .evaluateAll((els) => els.slice(0, 2).map((e) => Number(e.textContent)));
    expect(a + b).toBeGreaterThanOrEqual(7);
    // Hidden until correct.
    await expect(page.locator('.dice-pair')).toHaveCount(0);
    await type(page, a + b - 1);
    await expect(page.locator('.dice-pair')).toHaveCount(0);
    if ((await page.getByRole('textbox').getAttribute('readonly')) !== null)
      await page.getByRole('button', { name: 'Clear answer' }).click();
    else await page.getByRole('textbox').fill('');
    const checkBefore = (await page.locator('.answer-button').boundingBox())!;
    await type(page, a + b);
    const pair = page.getByRole('img', { name: `Result: 6 and ${a + b - 6}, ${a + b}` });
    await expect(pair).toBeVisible();
    await expect(pair.locator('.picture-group').nth(0).locator('[data-picture-pip]')).toHaveCount(
      6,
    );
    await expect(pair.locator('.picture-group').nth(1).locator('[data-picture-pip]')).toHaveCount(
      a + b - 6,
    );
    const m = await page.evaluate(() => {
      const groups = [...document.querySelectorAll('.equation .picture-group')].map((e) =>
        e.getBoundingClientRect(),
      );
      const overlap = groups.some((g, i) =>
        groups.some(
          (h, j) =>
            j > i &&
            g.left < h.right - 1 &&
            h.left < g.right - 1 &&
            g.top < h.bottom - 1 &&
            h.top < g.bottom - 1,
        ),
      );
      const next = document.querySelector('.answer-button')!.getBoundingClientRect();
      return {
        // QA170-01: all four dice the same size.
        spread: Math.max(...groups.map((g) => g.width)) - Math.min(...groups.map((g) => g.width)),
        // Peter: equal gaps die | die | result group (like level 1).
        gaps: (() => {
          const parts = [...document.querySelectorAll('.equation .equation-part')].map((e) => {
            const r = [...e.querySelectorAll('.picture-group')].map((x) =>
              x.getBoundingClientRect(),
            );
            return [Math.min(...r.map((x) => x.left)), Math.max(...r.map((x) => x.right))];
          });
          return [parts[1][0] - parts[0][1], parts[2][0] - parts[1][1]];
        })(),
        count: groups.length,
        smallest: Math.min(...groups.map((g) => Math.min(g.width, g.height))),
        overlap,
        outside: groups.filter((g) => g.left < 0 || g.right > innerWidth).length,
        hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        nextBottom: next.bottom,
        viewport: document.documentElement.clientHeight,
      };
    });
    const where = `${width}x${height}`;
    expect(m.count, where).toBe(4);
    expect(m.spread, where).toBeLessThanOrEqual(1);
    expect(Math.abs(m.gaps[0] - m.gaps[1]), where).toBeLessThanOrEqual(4);
    // QA170-02: Next appears where Check was (no jump on reveal), except sideways phones
    // where the feedback line sits beside the dice.
    if (height > 500)
      expect(
        Math.abs(m.nextBottom - (checkBefore.y + checkBefore.height)),
        where,
      ).toBeLessThanOrEqual(2);
    expect(m.overlap, where).toBe(false);
    expect(m.outside, where).toBe(0);
    // Smaller on phones (approved), but each die stays clearly countable.
    expect(m.smallest, where).toBeGreaterThanOrEqual(48);
    expect(m.hScroll, where).toBeLessThanOrEqual(0);
    // 320x568: the same few pixels as Small maths level 1 (pre-existing).
    expect(m.scroll, where).toBeLessThanOrEqual(width === 320 ? 8 : 0);
    expect(m.nextBottom, where).toBeLessThanOrEqual(m.viewport + (width === 320 ? 8 : 0));
    await context.close();
  });
