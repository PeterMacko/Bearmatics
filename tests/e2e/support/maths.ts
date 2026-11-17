import { type Page } from '@playwright/test';

/**
 * The value of the hidden term of the shown equation (+, −/-, ×, ÷; blank in any position).
 * Reads the numbers from the `[data-term]` spans and the `.operator`.
 */
export async function answerFor(page: Page): Promise<number> {
  return page.locator('.equation').evaluate((el) => {
    const terms = [...el.querySelectorAll('[data-term]')];
    const blank = terms.findIndex((term) => term.querySelector('input'));
    const [a, b, c] = terms.map((term) => Number(term.textContent));
    const op = el.querySelector('.operator')?.textContent?.trim();
    if (op === '+' || op === '−' || op === '-') {
      const add = op === '+';
      if (blank === 2) return add ? a + b : a - b;
      if (blank === 0) return add ? c - b : c + b;
      return add ? c - a : a - c;
    }
    const times = op === '×';
    if (blank === 2) return times ? a * b : a / b;
    if (blank === 0) return times ? c / b : c * b;
    return times ? c / a : a / c;
  });
}

/** Types into the answer: through the keyboard when the app number pad made it read-only. */
export async function fillAnswer(page: Page, value: string) {
  const input = page.getByRole('textbox');
  if ((await input.getAttribute('readonly')) !== null) {
    await input.focus();
    await input.press('Delete');
    await input.pressSequentially(value);
  } else await input.fill(value);
}

/** Fills the right answer (or the right answer + 1 when `wrong`) and presses Check answer. */
export async function solve(page: Page, wrong = false) {
  const value = await answerFor(page);
  await page.getByRole('textbox').fill(String(value + Number(wrong)));
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
}
