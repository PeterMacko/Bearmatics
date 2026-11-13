import { expect, test } from '@playwright/test';

test('renumbered content retains its level badge palette', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.level-5 .level-number')).toHaveCSS(
    'background-color',
    'rgb(255, 231, 168)',
  );
  await expect(page.locator('.level-6 .level-number')).toHaveCSS(
    'background-color',
    'rgb(238, 226, 255)',
  );
  await expect(page.locator('.level-7 .level-number')).toHaveCSS(
    'background-color',
    'rgb(255, 220, 235)',
  );
});
