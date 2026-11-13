import { expect, test, type Page } from '@playwright/test';

async function fits(page: Page, selector: string) {
  const box = (await page.locator(selector).boundingBox())!;
  const { width, height } = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
}

for (const language of ['en', 'sk']) {
  test(`settings lifecycle, modal isolation and zoom reachability ${language}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Let’s count' }).click();
    const input = page.getByRole('textbox');
    await input.pressSequentially('123');
    await page.locator('.answer-button').click();
    const equation = await page.locator('.equation').textContent();
    const progress = await page.getByRole('progressbar').getAttribute('value');
    await page.locator('.hint-button').click();
    await page.getByRole('button', { name: 'Show next hint' }).click();
    await page.keyboard.press('Escape');
    const gear = page.locator('.settings-button');
    await gear.click();
    const dialog = page.getByRole('dialog');
    const close = dialog.locator('.hint-dialog-header button');
    await expect(close).toBeFocused();
    for (const selector of ['header', 'main'])
      await expect(page.locator(selector)).toHaveAttribute('inert', '');
    await expect(page.locator('footer')).toHaveCount(0);
    for (const selector of ['.hint-button', '.back-button']) {
      await page.locator(selector).evaluate((el) => (el as HTMLElement).focus());
      await expect(close).toBeFocused();
    }
    await close.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'English' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await close.press('Tab');
    await expect(page.locator('.hint-dialog-content')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sound on' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Slovenčina' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'English' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.getByRole('button', { name: 'Slovenčina' }).click();
    await expect(dialog).toHaveAccessibleName('Nastavenia');
    await page.getByRole('button', { name: 'English' }).click();
    await expect(dialog).toHaveAccessibleName('Settings');
    if (language === 'sk') await page.getByRole('button', { name: 'Slovenčina' }).click();
    await expect(dialog).toHaveAccessibleName(language === 'sk' ? 'Nastavenia' : 'Settings');
    await expect(dialog).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: language === 'sk' ? 'Zvuk zapnutý' : 'Sound on' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 568, height: 320 },
    ]) {
      await page.setViewportSize(viewport);
      await fits(page, '.hint-dialog-header button');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const content = page.locator('.hint-dialog-content');
      for (const button of await content.locator('button').all()) {
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeInViewport();
      }
      await page.screenshot({
        path: testInfo.outputPath(`settings-zoom-${viewport.width}-${language}.png`),
      });
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe(
        'hidden',
      );
      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).overflow),
      ).not.toBe('hidden');
    }
    await page.keyboard.press('Escape');
    await expect(gear).toBeFocused();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('main')).not.toHaveAttribute('inert');
    await expect(input).toHaveValue('123');
    expect(await page.locator('.equation').textContent()).toBe(equation);
    expect(await page.getByRole('progressbar').getAttribute('value')).toBe(progress);
    await expect(page.getByRole('status')).toContainText(
      language === 'sk' ? 'Ešte nie' : 'Not quite',
    );
    await page.locator('.hint-button').click();
    await expect(page.locator('.hint-step')).toContainText('2 / 3');
    await expect(dialog).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.hint-button')).toBeFocused();
    await page.locator('.back-button').click();
    await expect(dialog).toHaveAccessibleName(
      language === 'sk' ? 'Opustiť túto cestu?' : 'Leave this trail?',
    );
    await expect(page.locator('header')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('.back-button')).toBeFocused();
    await page.locator('.back-button').click();
    await page
      .getByRole('button', {
        name: language === 'sk' ? 'Pokračovať v počítaní' : 'Keep practising',
      })
      .click();
    await expect(page.locator('.back-button')).toBeFocused();
    await expect(input).toHaveValue('123');
    await gear.click();
    await close.click();
    await expect(gear).toBeFocused();
  });
}
