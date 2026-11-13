import { expect, type Page } from '@playwright/test';

/** The app opens on the course choice; maths tests start by opening Mathematics. */
export async function openMathematics(page: Page) {
  await page.getByRole('button', { name: /^(Mathematics|Matematika)$/ }).click();
  await expect(page.locator('input[name="level"]').first()).toBeAttached();
}
