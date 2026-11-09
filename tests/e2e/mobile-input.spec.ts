import { expect, test, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

async function answerFor(page: Page) {
  return page.locator('.equation').evaluate(el => {
    const parts = [...el.querySelectorAll('[data-term]')];
    const blank = parts.findIndex(p => p.querySelector('input'));
    const [a, b, c] = parts.map(p => Number(p.textContent));
    const op = el.querySelector('.operator')!.textContent;
    if (blank === 2) return op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
    if (blank === 0) return op === '+' ? c - b : op === '−' ? c + b : op === '×' ? c / b : c * b;
    return op === '+' ? c - a : op === '−' ? a - c : op === '×' ? c / a : a / c;
  });
}
async function enter(page: Page, value: number) {
  await page.getByRole('textbox').focus();
  await page.keyboard.press('Delete');
  await page.keyboard.type(String(value));
}
async function visibleInViewport(locator: Locator, page: Page) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = await page.evaluate(() => ({ width: visualViewport!.width, height: visualViewport!.height }));
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}
test('native fallback and orientation changes preserve practice with localized input guidance', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: /Level 4 ·/ }).check();
  await page.getByRole('button', { name: 'Let’s count' }).click();
  const input = page.getByRole('textbox');
  await expect(input).toBeEditable();
  await input.fill('100');
  await page.locator('.hint-button').click();
  const equation = await page.locator('.equation').getAttribute('aria-label');
  await input.focus();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(input).toHaveAttribute('readonly', '');
  await expect(input).toHaveValue('100');
  await expect(input).toHaveAccessibleDescription(/Use the number pad or hardware digits/);
  await page.getByRole('button', { name: 'Use device keyboard' }).click();
  await expect(input).toBeEditable();
  await expect(input).toBeFocused();
  await input.fill('007');
  await page.setViewportSize({ width: 568, height: 320 });
  await expect(input).toBeEditable();
  await expect(input).toHaveValue('007');
  await expect(page.locator('.equation')).toHaveAttribute('aria-label', equation!);
  await expect(page.locator('.hint-step')).toHaveText('Hint 1 / 3');
  await page.getByRole('button', { name: 'Slovenčina' }).click();
  await page.getByRole('button', { name: 'Použiť číselnú klávesnicu' }).click();
  await expect(input).toHaveAttribute('readonly', '');
  await expect(input).toHaveAccessibleDescription(/Použi číselnú klávesnicu/);
  await expect(input).toHaveValue('007');
  await expect(page.locator('.hint-step')).toHaveText('Pomôcka 1 / 3');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toHaveValue('007');
});

test('enlarged text reflows metadata and keeps help and primary controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Slovenčina' }).click();
  await page.getByRole('button', { name: 'Začať počítať' }).click();
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const position = (await page.locator('.exercise-position').boundingBox())!;
  const progress = (await page.locator('progress').boundingBox())!;
  expect(progress.y).toBeGreaterThanOrEqual(position.y + position.height);
  await page.locator('.answer-button').scrollIntoViewIfNeeded();
  await expect(page.locator('.answer-button')).toBeInViewport();
  await page.locator('.hint-button').click();
  const help = page.getByRole('region', { name: 'Pomoc pri počítaní' });
  await help.focus();
  await expect(help).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
});

for (const [width, height] of [[320, 568], [360, 640], [390, 844], [568, 320]]) {
  for (const language of ['en', 'sk']) {
    test(`compact ${width}x${height} ${language}: core, hints, review and stable action`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      if (language === 'sk') await page.getByRole('button', { name: 'Slovenčina' }).click();
      await page.getByRole('radio', { name: language === 'sk' ? '5 príkladov' : '5 exercises', exact: true }).check();
      await page.getByRole('button', { name: language === 'sk' ? 'Začať počítať' : 'Let’s count' }).click();
      await expect(page.getByRole('textbox')).toHaveAttribute('readonly', '');
      const core = ['.bear', '.equation', '.feedback', '.number-pad', '.answer-button'];
      for (const selector of core) await visibleInViewport(page.locator(selector), page);
      const bear = (await page.locator('.bear').boundingBox())!;
      const position = (await page.locator('.exercise-position').boundingBox())!;
      const equation = (await page.locator('.equation').boundingBox())!;
      expect(bear.x + bear.width).toBeLessThanOrEqual(position.x);
      expect(bear.y + bear.height).toBeLessThanOrEqual(equation.y);
      for (const key of await page.locator('.number-pad button').all()) {
        const box = (await key.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(48);
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
      const actionBefore = await page.locator('.answer-button').boundingBox();
      const first = await answerFor(page);
      await enter(page, first + 1); await page.locator('.answer-button').click();
      for (let hint = 0; hint < 3; hint++) await page.locator('.hint-button').click();
      await expect(page.getByTestId('worked-solution')).toBeVisible();
      // Help is a separately scrollable, named keyboard region, not an overlay.
      const help = page.getByRole('region', { name: language === 'sk' ? 'Pomoc pri počítaní' : 'Practice help' });
      await expect(help).toHaveAttribute('tabindex', '0');
      await help.focus();
      const needsScroll = await help.evaluate(el => el.scrollHeight > el.clientHeight);
      await help.press('End');
      if (needsScroll) await expect.poll(() => help.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      const evidence = testInfo.outputPath('mobile-layout');
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: `${evidence}/hints-${width}x${height}-${language}.png` });
      for (const selector of core) await visibleInViewport(page.locator(selector), page);
      await enter(page, first); await page.getByRole('textbox').press('Enter');
      const actionAfter = await page.locator('.answer-button').boundingBox();
      expect(actionAfter!.y).toBeCloseTo(actionBefore!.y, 0);
      await expect(page.locator('.number-pad button:enabled')).toHaveCount(0);
      await page.locator('.answer-button').click();
      await expect(page.getByRole('status')).toHaveText('');
      for (let i = 1; i < 5; i++) {
        await enter(page, await answerFor(page));
        await page.getByRole('textbox').press('Enter');
        await page.locator('.answer-button').click();
      }
      await expect(page.locator('.exercise-position')).toContainText(language === 'sk' ? 'Opakovanie' : 'Review');
      for (const selector of core) await visibleInViewport(page.locator(selector), page);
      await expect(help).toContainText(language === 'sk' ? 'Tieto príklady' : 'These are the ones');
      await mkdir(evidence, { recursive: true });
      const boxes = Object.fromEntries(await Promise.all(core.map(async s => [s, await page.locator(s).boundingBox()])));
      await writeFile(`${evidence}/layout-${width}x${height}-${language}.json`, JSON.stringify(boxes, null, 2));
      await page.screenshot({ path: `${evidence}/review-${width}x${height}-${language}.png` });
      await enter(page, first); await page.getByRole('textbox').press('Enter');
      await page.locator('.answer-button').click();
      await expect(page.locator('.first-try')).toContainText('4 / 5');
    });
  }
}
