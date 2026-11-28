import { type Page } from '@playwright/test';
import { answerFor } from './maths';

/** Answers a maths lesson to its summary, all first try. */
export async function solveAll(page: Page) {
  while (!(await page.locator('.summary').isVisible())) {
    await page.getByRole('textbox').fill(String(await answerFor(page)));
    await page.locator('.answer-button').click();
    await page.locator('.answer-button').click();
  }
}
