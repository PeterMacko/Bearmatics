import { expect, test } from '@playwright/test';

// SCRUM-308 round 2, deviation: at 200% text the menu flows with the page, and choosing a level
// low on the page made the menu hook's re-measure clamp the page's scroll position (the page
// jumped up, away from the tapped row and its popup). Choosing a level keeps the page in place.
test.describe('200% text', () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 568 } });
  test('choosing a level low on a flowing page keeps the page where it is', async ({ page }) => {
    await page.goto('/?lang=en');
    await page.locator('.course-option').first().waitFor();
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await page.locator('.course-option.course-math').click();
    await page.locator('section.selection .level-option').first().waitFor();
    await page.waitForTimeout(250);
    await expect(page.locator('main.workspace')).toHaveAttribute('data-menu-mode', 'flow');
    const row = page.locator('section.selection .level-option.level-7');
    await row.evaluate((r) => r.scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(150);
    const pageScroll = () => page.evaluate(() => [window.scrollX, window.scrollY]);
    const before = await pageScroll();
    expect(before[1]).toBeGreaterThan(500);
    await row.locator('.level-number').tap();
    await expect(row.locator('input')).toBeChecked();
    await page.waitForTimeout(300);
    expect(await pageScroll()).toEqual(before);
  });
});
