import { expect, type Page } from '@playwright/test';

/** The app opens on the course choice; maths tests start by opening Maths (levels 1-7). */
export async function openMathematics(page: Page) {
  await page.getByRole('button', { name: /^(Maths|Matematika)$/ }).click();
  await expect(page.locator('input[name="level"]').first()).toBeAttached();
}

/** Small maths (SCRUM-141): the picture counting level, shown as Level 1 (engine level 0). */
export async function openSmallMaths(page: Page) {
  await page.getByRole('button', { name: /^(Small maths|Malá matematika)$/ }).click();
  await expect(page.locator('input[name="level"]').first()).toBeAttached();
}
