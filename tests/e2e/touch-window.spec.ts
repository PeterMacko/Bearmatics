import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

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

for (const [width, height] of [[1024, 600], [1366, 768], [1920, 1080]]) {
  for (const touch of [false, true]) for (const language of ['en', 'sk']) {
    test(`normal window ${width}x${height} ${touch ? 'hybrid' : 'desktop'} ${language}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      // Keep the desktop fine primary pointer, report a second touch capability.
      await page.addInitScript(points => {
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => points });
        (window as unknown as { answerFocusStates: boolean[] }).answerFocusStates = [];
        document.addEventListener('focusin', event => {
          if (event.target instanceof HTMLInputElement && event.target.type === 'text')
            (window as unknown as { answerFocusStates: boolean[] }).answerFocusStates.push(event.target.readOnly);
        });
      }, touch ? 10 : 0);
      await page.goto('/');
      expect(await page.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(true);
      if (language === 'sk') {
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('button', { name: 'Slovenčina' }).click();
        await expect(page.getByRole('button', { name: 'Zavrieť nastavenia' })).toHaveText('×');
        await page.keyboard.press('Escape');
      }
      const layouts: Record<string, unknown> = {};
      const inspect = async (stage: string) => {
        await expect(page.locator('footer')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Bearmatics', level: 1 })).toHaveClass('sr-only');
        await expect(page.getByText(/Little steps\. Big discoveries\.|Malé kroky\. Veľké objavy\./)).toHaveCount(0);
        const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, bodyOverflow: getComputedStyle(document.body).overflow, rootOverflow: getComputedStyle(document.documentElement).overflow }));
        layouts[stage] = { ...dimensions, elements: await page.locator('.site-header, .bear, .selection, .level-option, .practice, .number-pad button, .answer-button, .hint-button, .summary').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { className: el.getAttribute('class'), x: r.x, y: r.y, width: r.width, height: r.height }; })), capability: await page.evaluate(() => ({ maxTouchPoints: navigator.maxTouchPoints, finePrimary: matchMedia('(pointer: fine)').matches, coarseAny: matchMedia('(any-pointer: coarse)').matches, readOnly: document.querySelector<HTMLInputElement>('input[type=text]')?.readOnly })) };
        await page.screenshot({ path: testInfo.outputPath(`${stage}.png`) });
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(width);
        expect(dimensions.scrollHeight).toBeLessThanOrEqual(height);
        expect(dimensions.bodyOverflow).not.toBe('hidden');
        expect(dimensions.rootOverflow).not.toBe('hidden');
      };
      await inspect('selection');
      await page.getByRole('radio', { name: language === 'sk' ? '5 príkladov' : '5 exercises', exact: true }).check();
      await page.locator('.start-button').click();
      const input = page.getByRole('textbox');
      if (touch) {
        await expect(input).toHaveAttribute('readonly', '');
        await expect(input).toHaveAttribute('inputmode', 'none');
        await expect(page.locator('.input-mode-button')).toHaveCount(0);
        await expect(page.locator('.number-pad')).toBeVisible();
      } else {
        await expect(input).toBeEditable();
        await expect(page.locator('.number-pad')).toHaveCount(0);
      }
      await expect(input).toBeFocused();
      expect(await page.evaluate(() => (window as unknown as { answerFocusStates: boolean[] }).answerFocusStates)).toEqual([touch]);
      const primary = (await page.locator('.answer-button').boundingBox())!;
      const info = (await page.locator('.hint-button').boundingBox())!;
      expect(info.y).toBeCloseTo(primary.y, 0);
      expect(info.x).toBeGreaterThanOrEqual(primary.x + primary.width);
      expect(info.width).toBeGreaterThanOrEqual(44); expect(info.height).toBeGreaterThanOrEqual(44);
      await inspect('practice');
      await page.locator('.hint-button').click();
      await expect(page.getByRole('dialog')).toHaveAttribute('id', 'hint-dialog');
      await expect(page.locator('.dialog-close')).toHaveText('×');
      await expect(page.locator('.dialog-close')).toHaveAccessibleName(language === 'sk' ? 'Zavrieť pomôcku' : 'Close hint');
      await page.keyboard.press('Escape');
      for (let i = 0; i < 5; i++) {
        await input.focus(); await page.keyboard.press('Delete'); await page.keyboard.type(String(await answerFor(page))); await input.press('Enter');
        await page.locator('.answer-button').click();
      }
      await expect(page.locator('.summary')).toBeVisible();
      await inspect('summary');
      if (width === 1024) {
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
        for (const button of await page.locator('.summary button, .site-header button').all()) {
          await button.scrollIntoViewIfNeeded(); await expect(button).toBeInViewport();
          const box = (await button.boundingBox())!;
          expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
        }
        layouts.summaryEnlarged = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.screenshot({ path: testInfo.outputPath('summary-enlarged.png') });
      }
      await writeFile(testInfo.outputPath('layout.json'), JSON.stringify(layouts, null, 2));
    });
  }
}
