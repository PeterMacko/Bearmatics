import { expect, test } from '@playwright/test';
import { setLanguage } from './support/language';

// SCRUM-298: a mouse click on the leave confirmation's padding used to move focus to the page
// body, so Escape did nothing. Now the dialog keeps focus (shared useModalFocus).

for (const lang of ['en', 'sk'] as const)
  test(`leave confirmation (${lang}): a click on the window padding, then Escape closes it and focus is back on Back`, async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('bearmatics-logic-demo-seen', '1'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    if (lang === 'sk') await setLanguage(page, 'Slovenčina');
    await page.locator('.course-logic').click();
    await page.locator('.logic-home .start-button').click();
    await expect(page.locator('.logic-board')).toBeVisible();
    await page.locator('.arrow-right').click(); // unsent work: Back asks first
    const back = page.locator('.back-button');
    await back.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('button').first()).toBeFocused();
    // The window's padding: 15 px in from its left edge, half way down (30 px padding there).
    const box = (await dialog.boundingBox())!;
    await page.mouse.click(box.x + 15, box.y + box.height / 2);
    const focus = await page.evaluate(() => ({
      inDialog: !!document.activeElement?.closest('[role="dialog"]'),
      tag: document.activeElement?.tagName,
    }));
    expect(focus.inDialog, `focus on ${focus.tag}`).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(back).toBeFocused();
    // Still in the lesson, the plan kept.
    await expect(page.locator('.arrow-slot[data-filled]')).toHaveCount(1);
  });

test('leave confirmation: after a padding click Tab stays in the window', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bearmatics-logic-demo-seen', '1'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.course-logic').click();
  await page.locator('.logic-home .start-button').click();
  await page.locator('.arrow-right').click();
  await page.locator('.back-button').click();
  const dialog = page.getByRole('dialog');
  const box = (await dialog.boundingBox())!;
  await page.mouse.click(box.x + 15, box.y + box.height / 2);
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"] button')),
  ).toBe(true);
});
