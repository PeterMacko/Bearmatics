import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

for (const language of ['en', 'sk']) {
  test(`touch tablet orientation and locale preserve practice ${language}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 800, height: 1100 }, hasTouch: true });
    const page = await context.newPage();
    try {
      await page.goto('/');
      expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
      await page.getByRole('button', { name: 'Let’s count' }).click();
      const input = page.getByRole('textbox');
      await expect(input).toHaveAttribute('readonly', '');
      await input.pressSequentially('007');
      const equation = await page.locator('.equation').textContent();
      const progress = await page.getByRole('progressbar').getAttribute('value');
      await page.locator('.hint-button').click();
      await page.getByRole('button', { name: 'Show next hint' }).click();
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 1100, height: 800 });
      await page.locator('.settings-button').click();
      if (language === 'sk') await page.getByRole('button', { name: 'Slovenčina' }).click();
      const close = page.getByRole('button', { name: language === 'sk' ? 'Zavrieť nastavenia' : 'Close settings' });
      await expect(close).toHaveText('×');
      await expect(close).toHaveAttribute('title', language === 'sk' ? 'Zavrieť nastavenia' : 'Close settings');
      const box = (await close.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      await page.keyboard.press('Escape');
      await expect(input).toHaveValue('007');
      await expect(input).toHaveAttribute('readonly', '');
      await expect(page.locator('.input-mode-button')).toHaveCount(0);
      expect(await page.locator('.equation').textContent()).toBe(equation);
      expect(await page.getByRole('progressbar').getAttribute('value')).toBe(progress);
      await page.locator('.hint-button').click();
      await expect(page.locator('.hint-step')).toContainText('2 / 3');
      await page.keyboard.press('Escape');
      await page.screenshot({ path: testInfo.outputPath('tablet-landscape.png') });
    } finally { await context.close(); }
  });

  test(`enlarged text scrolls without shrinking targets ${language}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    await page.addInitScript(() => Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 10 }));
    await page.goto('/');
    if (language === 'sk') {
      await page.locator('.settings-button').click(); await page.getByRole('button', { name: 'Slovenčina' }).click(); await page.keyboard.press('Escape');
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect.poll(() => page.locator('.workspace').getAttribute('data-menu-mode')).toMatch(/flow|contained/);
    const flow = await page.locator('.workspace').getAttribute('data-menu-mode') === 'flow';
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(flow);
    for (const option of await page.locator('.level-option').all()) {
      await option.scrollIntoViewIfNeeded(); await expect(option).toBeInViewport();
      expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    await page.locator('.start-button').scrollIntoViewIfNeeded();
    await expect(page.locator('.start-button')).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('selection-enlarged.png') });
    await page.locator('.start-button').click();
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
    for (const button of await page.locator('.number-pad button, .answer-actions button').all()) {
      await button.scrollIntoViewIfNeeded(); await expect(button).toBeInViewport();
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(48); expect(box.height).toBeGreaterThanOrEqual(48);
    }
    await page.locator('.hint-button').click();
    const close = page.getByRole('button', { name: language === 'sk' ? 'Zavrieť pomôcku' : 'Close hint' });
    await expect(close).toBeInViewport(); await expect(close).toHaveText('×');
    await page.keyboard.press('Escape'); await expect(page.locator('.hint-button')).toBeFocused();
    const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, bodyOverflow: getComputedStyle(document.body).overflow, rootOverflow: getComputedStyle(document.documentElement).overflow }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
    expect(layout.bodyOverflow).not.toBe('hidden'); expect(layout.rootOverflow).not.toBe('hidden');
    await writeFile(testInfo.outputPath('enlarged-layout.json'), JSON.stringify(layout, null, 2));
    await page.screenshot({ path: testInfo.outputPath('practice-enlarged.png') });
  });
}
