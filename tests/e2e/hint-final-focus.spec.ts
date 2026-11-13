import { expect, test } from '@playwright/test';
import { openMathematics } from './course';

test('Escape and focus remain usable after the final hint advancement disables itself', async ({
  page,
}) => {
  await page.goto('/');
  await openMathematics(page);
  await page.locator('.start-button').click();
  await page.locator('.hint-button').click();
  await page.getByRole('button', { name: 'Show next hint' }).click();
  await page.getByRole('button', { name: 'Show next hint' }).click();
  await expect(page.getByRole('button', { name: 'All hints shown' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.hint-button')).toBeFocused();
});
