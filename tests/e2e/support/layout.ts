import { expect, type Locator, type Page } from '@playwright/test';

/** True when the document is no wider than the window (`scrollWidth <= innerWidth`). */
export const fitsWindowWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

/** Asserts `scrollWidth <= innerWidth`: no horizontal page scroll. */
export async function expectNoHorizontalScroll(page: Page) {
  expect(await fitsWindowWidth(page)).toBe(true);
}

/** Horizontal page overflow in px: `scrollWidth - clientWidth` (0 when nothing scrolls). */
export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** The document's `scrollWidth`. */
export const pageScrollWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth);

/** Waits two animation frames so layout hooks have measured and re-rendered. */
export const nextFrames = (page: Page) =>
  page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );

/** Asserts the element lies fully inside the visual viewport (1 px tolerance). */
export async function visibleInViewport(locator: Locator, page: Page) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = await page.evaluate(() => ({
    width: visualViewport!.width,
    height: visualViewport!.height,
  }));
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}
