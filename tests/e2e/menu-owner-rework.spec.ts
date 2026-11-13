import { expect, test } from '@playwright/test';
import { openMathematics } from './course';
for (const language of ['en', 'sk'])
  for (const [width, height] of [
    [754, 655],
    [1193, 1201],
    [1366, 768],
    [1920, 1080],
    [621, 640],
    [950, 640],
    [951, 640],
  ]) {
    test(`owner wide ${language} ${width}x${height}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await openMathematics(page);
      if (language === 'sk') {
        await page.locator('.settings-button').click();
        await page.getByRole('button', { name: 'Slovenčina' }).click();
        await page.keyboard.press('Escape');
      }
      await expect(page.locator('.workspace')).toHaveAttribute('data-menu-mode', 'contained');
      const data = await page.evaluate(() => {
        const box = (s: string) => {
          const r = document.querySelector(s)!.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
            cx: r.x + r.width / 2,
            cy: r.y + r.height / 2,
          };
        };
        return {
          panel: box('.workspace'),
          bear: box('.bear-scene'),
          heading: box('.menu-heading'),
          footer: box('.menu-controls'),
          gear: box('.settings-button'),
          cards: [...document.querySelectorAll('.level-option')].map((e) => {
            const r = e.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          }),
        };
      });
      expect(new Set(data.cards.map((r) => Math.round(r.x))).size).toBe(1);
      expect(data.bear.width).toBeGreaterThanOrEqual(Math.min(240, width * 0.35));
      expect(Math.abs(data.bear.cy - (data.heading.y + data.footer.bottom) / 2)).toBeLessThan(20);
      expect(data.gear.right).toBeGreaterThanOrEqual(width - 24);
      expect(data.gear.y).toBeLessThanOrEqual(16);
      expect(data.gear.bottom <= data.panel.y || data.gear.x >= data.panel.right).toBe(true);
      if (height >= 1000) {
        expect(data.panel.height).toBeLessThan(height - 180);
        expect(Math.abs(data.panel.cy - height / 2)).toBeLessThan(32);
      }
      expect(data.footer.bottom).toBeLessThanOrEqual(height);
      await info.attach('geometry', {
        body: JSON.stringify(data),
        contentType: 'application/json',
      });
      await page.screenshot({ path: info.outputPath('wide.png') });
    });
  }
