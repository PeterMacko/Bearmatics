import { expect, test, type Page } from '@playwright/test';
import { openSmallMaths } from './support/course';

// SCRUM-156: Small maths level 2 "Take away" at the defined devices.
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

async function openTakeAway(page: Page) {
  await page.goto('/');
  await openSmallMaths(page);
  await page.getByRole('radio', { name: /^Level 2 · Take away/ }).check();
  await page.getByRole('button', { name: 'Let’s count' }).click();
  await expect(page.locator('.take-away')).toBeVisible();
}

/** Answers until an example with 6 pictures is shown (the largest basket). */
async function untilSix(page: Page) {
  for (let i = 0; i < 9; i++) {
    const [a, b] = await page
      .locator('.equation [data-term]')
      .evaluateAll((els) => els.slice(0, 2).map((e) => Number(e.textContent)));
    if (a === 6) return;
    const box = page.getByRole('textbox');
    if ((await box.getAttribute('readonly')) !== null)
      for (const digit of String(a - b))
        await page.getByRole('button', { name: digit, exact: true }).click();
    else await box.fill(String(a - b));
    await page.getByRole('button', { name: 'Check answer' }).click();
    await page.getByRole('button', { name: /^(Next exercise|See how you did)$/ }).click();
    await expect(page.locator('.take-away')).toBeVisible();
  }
  throw new Error('no example with 6 pictures in this lesson');
}

for (const [width, height, touch] of DEVICES)
  test(`take away fits ${width}x${height}: 6 pictures, 48 px, Check on screen`, async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch && width < 900,
    });
    const page = await context.newPage();
    // Lessons are random: retry with fresh lessons until one has a 6 (each lesson has
    // 10 different examples out of 27, at most one with a zero).
    for (let attempt = 0; ; attempt++) {
      await openTakeAway(page);
      try {
        await untilSix(page);
        break;
      } catch (error) {
        if (attempt > 4) throw error;
      }
    }
    const pictures = page.locator('.basket-picture');
    await expect(pictures).toHaveCount(6);
    // Take two out: both areas hold pictures.
    // Two deliberate taps (a quick second tap is ignored, QA162-01).
    for (let i = 0; i < 2; i++) {
      const picture = page.locator('.in-basket .basket-picture').first();
      if (touch) await picture.tap();
      else await picture.click();
      await page.waitForTimeout(400);
    }
    await expect(page.locator('.taken-out .basket-picture')).toHaveCount(2);
    // Let the short pop-in animation end before measuring.
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('.basket-picture')].map((e) =>
        e.getBoundingClientRect(),
      );
      const check = document.querySelector('.answer-button')!.getBoundingClientRect();
      return {
        smallest: Math.min(
          ...[...document.querySelectorAll<HTMLElement>('.basket-picture')].map((e) =>
            Math.min(e.offsetWidth, e.offsetHeight),
          ),
        ),
        outside: boxes.filter((b) => b.left < 0 || b.right > innerWidth).length,
        hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        checkBottom: check.bottom,
        viewport: document.documentElement.clientHeight,
      };
    });
    const where = `${width}x${height}`;
    expect(m.smallest, where).toBeGreaterThanOrEqual(48);
    expect(m.outside, where).toBe(0);
    expect(m.hScroll, where).toBeLessThanOrEqual(0);
    // 320x568: the same few pixels as Small maths level 1 (pre-existing); elsewhere no scroll.
    expect(m.scroll, where).toBeLessThanOrEqual(width === 320 ? 8 : 0);
    expect(m.checkBottom, where).toBeLessThanOrEqual(m.viewport + (width === 320 ? 8 : 0));
    await context.close();
  });

test('take away: keyboard moves pictures and focus follows; screen-reader counts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openTakeAway(page);
  const first = page.locator('.in-basket .basket-picture').first();
  const total = await page.locator('.basket-picture').count();
  await first.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.taken-out .basket-picture')).toHaveCount(1);
  await expect(page.locator('.taken-out .basket-picture')).toBeFocused();
  await expect(page.getByText(`In the basket: ${total - 1}. Taken out: 1.`)).toBeAttached();
  await page.keyboard.press('Enter');
  await expect(page.locator('.taken-out .basket-picture')).toHaveCount(0);
  await expect(page.locator('.in-basket .basket-picture').first()).toBeFocused();
  // No hint button on this level.
  await expect(page.getByRole('button', { name: 'Show hint' })).toHaveCount(0);
});
