import { expect, test, type Page } from '@playwright/test';


async function switchLanguage(page: Page, language: string, gear: string, close: string) {
  await page.getByRole('button', { name: gear, exact: true }).click();
  await page.getByRole('button', { name: language, exact: true }).click();
  await page.getByRole('button', { name: close, exact: true }).click();
}

async function fillAnswer(page: Page, value: string) {
  const input = page.getByRole('textbox');
  if (await input.getAttribute('readonly') !== null) {
    await input.focus();
    await input.press('Delete');
    await input.pressSequentially(value);
  } else await input.fill(value);
}

async function answerFor(page: Page): Promise<number> {
  return page.locator('.equation').evaluate(element => {
    const parts = [...element.querySelectorAll<HTMLElement>('[data-term]')];
    const blank = parts.findIndex(p => p.querySelector('input'));
    const values = parts.map(p => Number(p.textContent));
    const operation = element.querySelector('.operator')!.textContent;
    const [a, b, c] = values;
    if (blank === 2) return operation === '+' ? a + b : operation === '−' ? a - b : operation === '×' ? a * b : a / b;
    if (blank === 0) return operation === '+' ? c - b : operation === '−' ? c + b : operation === '×' ? c / b : c * b;
    return operation === '+' ? c - a : operation === '−' ? a - c : operation === '×' ? c / a : a / c;
  });
}

for (const [level, size] of [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [1, 10], [1, 20]]) {
  test(`completes ${size} exercises on level ${level} without runtime errors`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await expect(page).toHaveTitle('Bearmatics');
    await page.getByRole('radio', { name: new RegExp(`Level ${level} ·`) }).check();
    await page.getByRole('radio', { name: `${size} exercises`, exact: true }).check();
    await page.getByRole('button', { name: 'Let’s count' }).click();
    for (let i = 0; i < size; i++) {
      await expect(page.getByText(`Exercise ${i + 1} of ${size}`, { exact: true })).toBeVisible();
      if (level === 1) await expect(page.locator('.operator').first()).toHaveText('+');
      const answer = await answerFor(page);
      expect(Number.isInteger(answer)).toBeTruthy();
      await fillAnswer(page, String(answer));
      await page.getByRole('textbox').press('Enter');
      await expect(page.getByRole('status')).toHaveText('That’s it! Nicely done.');
      await expect(page.getByRole('textbox')).toBeDisabled();
      await page.getByRole('button', { name: i === size - 1 ? 'See how you did' : 'Next exercise' }).click();
    }
    await expect(page.getByRole('heading', { name: 'Look how far you’ve come!' })).toBeFocused();
    await expect(page.getByText(`${size} exercises completed`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${size} / ${size}`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.getByText(`Exercise 1 of ${size}`, { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('missed equations return at the end and cycle until a first-attempt success', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: '5 exercises', exact: true }).check();
  await page.getByRole('button', { name: 'Let’s count' }).click();
  const missed: string[] = [];
  for (let i = 0; i < 5; i++) {
    const answer = await answerFor(page);
    if (i === 0 || i === 4) {
      missed.push((await page.locator('.equation').getAttribute('aria-label'))!);
      await fillAnswer(page, String(answer + 1));
      await page.getByRole('button', { name: 'Check answer' }).click();
      await expect(page.getByRole('status')).toContainText('Not quite');
    }
    await fillAnswer(page, String(answer));
    await page.getByRole('button', { name: 'Check answer' }).click();
    await page.getByRole('button', { name: i === 4 ? 'Review tricky ones' : 'Next exercise' }).click();
  }
  await expect(page.getByText('Review · 2 to practise', { exact: true })).toBeVisible();
  await expect(page.locator('.equation')).toHaveAttribute('aria-label', missed[0]);
  let answer = await answerFor(page);
  await fillAnswer(page, String(answer + 1));
  await page.getByRole('button', { name: 'Check answer' }).click();
  await fillAnswer(page, String(answer));
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next exercise' }).click();
  // Failed review is placed behind the other pending exercise, not duplicated.
  await expect(page.getByText('Review · 2 to practise', { exact: true })).toBeVisible();
  await expect(page.locator('.equation')).toHaveAttribute('aria-label', missed[1]);
  await fillAnswer(page, String(await answerFor(page)));
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next exercise' }).click();
  await expect(page.getByText('Review · 1 to practise', { exact: true })).toBeVisible();
  await expect(page.locator('.equation')).toHaveAttribute('aria-label', missed[0]);
  answer = await answerFor(page);
  await fillAnswer(page, '1e0');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('status')).toContainText('Check the number.');
  await switchLanguage(page, 'Slovenčina', 'Settings', 'Zavrieť nastavenia');
  await expect(page.getByText('Opakovanie · 1 na precvičenie', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('1e0');
  await switchLanguage(page, 'English', 'Nastavenia', 'Close settings');
  await page.getByRole('button', { name: 'Show a hint' }).click();
  await page.getByRole('button', { name: 'Close hint' }).click();
  await fillAnswer(page, String(answer));
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next exercise' }).click();
  // A hint-assisted review answer needs one more fresh, independent attempt.
  await expect(page.getByText('Review · 1 to practise', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Hint' })).toHaveCount(0);
  await fillAnswer(page, String(answer));
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'See how you did' }).click();
  await expect(page.getByText('3 / 5', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Look how far you’ve come!' })).toBeVisible();
});

for (const level of [1, 2, 3, 4, 5, 6]) {
  test(`three hint stages explain level ${level} without automatic answering`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/');
    await page.getByRole('radio', { name: new RegExp(`Level ${level} ·`) }).check();
    await page.getByRole('radio', { name: '5 exercises', exact: true }).check();
    await page.getByRole('button', { name: 'Let’s count' }).click();
    const expected = await answerFor(page);
    await fillAnswer(page, '007');
    await page.getByRole('button', { name: 'Show a hint' }).click();
    await expect(page.getByRole('region', { name: 'Hint' })).toContainText('Hint 1 / 3');
    await expect(page.getByTestId('worked-solution')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show next hint' }).click();
    await expect(page.locator('.quantity')).toHaveCount(3);
    expect(await page.locator('.quantity-tokens > span').count()).toBeLessThanOrEqual(38);
    await expect(page.getByTestId('worked-solution')).toHaveCount(0);
    await page.getByRole('button', { name: 'Close hint' }).click();
    await switchLanguage(page, 'Slovenčina', 'Settings', 'Zavrieť nastavenia');
    await page.getByRole('button', { name: 'Ukázať pomôcku' }).click();
    await expect(page.getByRole('region', { name: 'Pomôcka' })).toContainText('Pomôcka 2 / 3');
    await expect(page.getByRole('textbox')).toHaveValue('007');
    await page.getByRole('button', { name: 'Ďalšia pomôcka' }).click();
    await expect(page.getByTestId('worked-solution').locator('p').first()).toHaveText(new RegExp(`=\\s*${expected}$`));
    await expect(page.getByRole('button', { name: 'Všetky pomôcky zobrazené' })).toBeDisabled();
    await expect(page.getByRole('textbox')).toHaveValue('007');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.getByRole('button', { name: 'Zavrieť pomôcku' }).click();
    await fillAnswer(page, String(expected));
    await page.getByRole('button', { name: 'Skontrolovať' }).click();
    await page.getByRole('button', { name: 'Ďalší príklad' }).click();
    await expect(page.getByRole('region', { name: 'Pomôcka' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ukázať pomôcku' })).toBeEnabled();
  });
}

test('button colours, bear reactions and opt-in native audio follow submitted answers', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as { audioNotes: number };
    state.audioNotes = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () { state.audioNotes++; return original.call(this); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('button', { name: 'Let’s count' }).click();
  const expected = await answerFor(page);
  const answerButton = page.locator('.answer-button');
  await page.mouse.move(0, 0);
  await expect(answerButton).toHaveCSS('background-color', 'rgb(53, 109, 166)');
  await answerButton.click();
  await expect(page.getByRole('status')).toHaveText('Check the number.');
  await expect(page.locator('.bear')).toHaveAttribute('data-mood', 'neutral');
  await fillAnswer(page, String(expected + 1)); await answerButton.click();
  await page.mouse.move(0, 0);
  await expect(answerButton).toHaveCSS('background-color', 'rgb(182, 62, 69)');
  await expect(page.locator('.bear')).toHaveAttribute('data-mood', 'sad');
  await expect(page.locator('.bear-character')).toHaveCSS('animation-name', 'bear-think');
  expect(await page.evaluate(() => (window as unknown as { audioNotes: number }).audioNotes)).toBe(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sound off' }).click();
  await expect(page.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Close settings' }).click();
  expect(await page.evaluate(() => (window as unknown as { audioNotes: number }).audioNotes)).toBe(0); // no replay on enable
  await fillAnswer(page, String(expected + 2)); await answerButton.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { audioNotes: number }).audioNotes)).toBe(2);
  await fillAnswer(page, String(expected));
  await expect(answerButton).toHaveAttribute('data-state', 'neutral');
  await answerButton.click(); await page.mouse.move(0, 0);
  await expect(answerButton).toHaveCSS('background-color', 'rgb(35, 116, 68)');
  await expect(page.locator('.bear')).toHaveAttribute('data-mood', 'happy');
  await expect(page.locator('.bear-arm-right')).toHaveCSS('animation-name', 'bear-wave');
  await expect.poll(() => page.evaluate(() => (window as unknown as { audioNotes: number }).audioNotes)).toBe(5);
  await page.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
  await switchLanguage(page, 'Slovenčina', 'Settings', 'Zavrieť nastavenia');
  expect(await page.evaluate(() => (window as unknown as { audioNotes: number }).audioNotes)).toBe(5);
  await page.getByRole('button', { name: 'Nastavenia', exact: true }).click();
  await page.getByRole('button', { name: 'Zvuk zapnutý' }).click();
  await expect(page.getByRole('button', { name: 'Zvuk vypnutý' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Zavrieť nastavenia' }).click();
  await page.getByRole('button', { name: 'Ďalší príklad' }).click();
  await expect(page.locator('.answer-button')).toHaveAttribute('data-state', 'neutral');
  await fillAnswer(page, String((await answerFor(page)) + 1));
  await page.getByRole('button', { name: 'Skontrolovať' }).click();
  expect(await page.evaluate(() => (window as unknown as { audioNotes: number }).audioNotes)).toBe(5);
});

test('blocked audio does not prevent answering and reports its unavailable state', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'AudioContext', { configurable: true, value: class { constructor() { throw new Error('Blocked audio'); } } }));
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sound off' }).click();
  await expect(page.getByText('Sound isn’t available in this browser.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('button', { name: 'Let’s count' }).click();
  await fillAnswer(page, String(await answerFor(page)));
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('.answer-button')).toHaveAttribute('data-state', 'correct');
  expect(errors).toEqual([]);
});

test('reduced motion keeps the bear expressions but disables reaction animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/'); await page.getByRole('button', { name: 'Let’s count' }).click();
  const answer = await answerFor(page);
  await fillAnswer(page, String(answer + 1)); await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('.bear')).toHaveAttribute('data-mood', 'sad');
  await expect(page.locator('.bear-character')).toHaveCSS('animation-name', 'none');
  await fillAnswer(page, String(answer)); await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('.bear')).toHaveAttribute('data-mood', 'happy');
  await expect(page.locator('.bear-arm-right')).toHaveCSS('animation-name', 'none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('Slovak switching preserves equation, answer and progress; leave dialog traps focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Let’s count' }).click();
  const equation = await page.locator('.equation').textContent();
  await fillAnswer(page, '12');
  await switchLanguage(page, 'Slovenčina', 'Settings', 'Zavrieť nastavenia');
  await expect(page.locator('html')).toHaveAttribute('lang', 'sk');
  await expect(page.getByRole('textbox')).toHaveValue('12');
  expect(await page.locator('.equation').textContent()).toBe(equation);
  await expect(page.getByText('Príklad 1 z 10')).toBeVisible();
  await page.getByRole('button', { name: 'Vybrať úroveň' }).click();
  const keep = page.getByRole('button', { name: 'Pokračovať v počítaní' });
  await expect(keep).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Vybrať novú cestu' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(keep).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('12');
});

test('narrow Slovak screens have no horizontal overflow in selection or practice', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await switchLanguage(page, 'Slovenčina', 'Settings', 'Zavrieť nastavenia');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole('radio', { name: /Úroveň 4/ }).check();
  await page.getByRole('button', { name: 'Začať počítať' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await expect(page.getByRole('textbox')).toBeFocused();
  await fillAnswer(page, String(await answerFor(page)));
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('button', { name: 'Ďalší príklad' })).toBeFocused();
});
