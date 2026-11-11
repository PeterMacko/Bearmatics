import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

for (const language of ['en', 'sk']) {
  test(`QA21 touch accessible instructions match available controls ${language}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 }));
    await page.goto('/');
    if (language === 'sk') {
      await page.locator('.settings-button').click();
      await page.getByRole('button', { name: 'Slovenčina' }).click();
      await page.locator('.dialog-close').click();
    }
    await page.getByRole('button', { name: language === 'sk' ? 'Začať počítať' : 'Let’s count' }).click();
    const input = page.getByRole('textbox');
    await expect(input).toHaveAttribute('readonly', '');
    await expect(input).toHaveAttribute('aria-describedby', /(?:^| )answer-instructions(?: |$)/);
    await expect(page.locator('.number-pad')).toBeVisible();
    await expect(page.locator('.input-mode-button')).toHaveCount(0);
    await expect(input).toHaveAccessibleDescription(language === 'sk'
      ? 'Použi číselnú klávesnicu alebo číslice na klávesnici. Backspace vymaže číslicu, Delete celú odpoveď a Enter ju skontroluje.'
      : 'Use the number pad or hardware digits, Backspace to erase, Delete to clear, and Enter to check.');
    await input.focus(); await page.keyboard.type('123'); await expect(input).toHaveValue('123');
    await page.keyboard.press('Backspace'); await expect(input).toHaveValue('12');
    await page.keyboard.press('Delete'); await expect(input).toHaveValue('');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toHaveText(language === 'sk' ? 'Skontroluj číslo.' : 'Check the number.');
  });

  test(`QA21 language text fits its button content at 200% root text ${language}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Let’s count' }).click();
    const gear = page.locator('.settings-button');
    await gear.click();
    if (language === 'sk') await page.getByRole('button', { name: 'Slovenčina' }).click();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(viewport);
      const buttons = page.locator('.language-switch button');
      await buttons.first().scrollIntoViewIfNeeded();
      const geometry = await buttons.evaluateAll(elements => elements.map(el => {
        const button = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const range = document.createRange(); range.selectNodeContents(el);
        const text = [...range.getClientRects()].map(r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }));
        return { label: el.textContent, width: button.width, height: button.height, text, content: {
          left: button.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
          right: button.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
          top: button.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop),
          bottom: button.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom),
        } };
      }));
      await writeFile(testInfo.outputPath(`text-geometry-${viewport.width}.json`), JSON.stringify(geometry, null, 2));
      await testInfo.attach(`text-geometry-${viewport.width}`, { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
      await page.screenshot({ path: testInfo.outputPath(`settings-root-text-200-${viewport.width}-${language}.png`) });
      for (const button of geometry) {
        expect(button.width).toBeGreaterThanOrEqual(48); expect(button.height).toBeGreaterThanOrEqual(48);
        expect(button.text.length).toBeGreaterThan(0);
        for (const text of button.text) {
          expect(text.left, button.label!).toBeGreaterThanOrEqual(button.content.left - 1);
          expect(text.right, button.label!).toBeLessThanOrEqual(button.content.right + 1);
          expect(text.top).toBeGreaterThanOrEqual(button.content.top - 1);
          expect(text.bottom).toBeLessThanOrEqual(button.content.bottom + 1);
        }
      }
      for (const a of geometry[0].text) for (const b of geometry[1].text) {
        expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
      }
      for (const button of await page.locator('.hint-dialog-content button').all()) {
        await button.scrollIntoViewIfNeeded(); await expect(button).toBeInViewport();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const close = page.locator('.dialog-close');
      await close.focus(); await close.press('Shift+Tab'); await expect(buttons.last()).toBeFocused();
      await page.keyboard.press('Tab'); await expect(close).toBeFocused();
    }
    await page.keyboard.press('Escape'); await expect(gear).toBeFocused();
    // Preserve the normal larger-window row and document fit, without overflow hiding.
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.setViewportSize({ width: 1280, height: 800 });
    await gear.click();
    const normal = await page.locator('.language-switch button').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
    expect(normal[0]).toBe(normal[1]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });
}
