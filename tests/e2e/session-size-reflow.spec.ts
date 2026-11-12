import { expect, test, type Page } from '@playwright/test';

type Bounds = { left: number; right: number; top: number; bottom: number };
const nonoverlapping = (a: Bounds, b: Bounds) =>
  a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;

async function geometry(page: Page) {
  return page.locator('.session-options').evaluate(fieldset => {
    const rect = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height });
    const labels = [...fieldset.querySelectorAll('label')].map(label => {
      const span = label.querySelector('span')!;
      const box = span.getBoundingClientRect();
      const style = getComputedStyle(span);
      // Walk real text nodes: element ranges also include nested inline boxes.
      const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      const text = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent?.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(walker.currentNode);
        text.push(...[...range.getClientRects()].map(rect));
      }
      return { label: label.textContent, box: rect(box), text, content: {
        left: box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
        right: box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
        top: box.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop),
        bottom: box.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom),
      } };
    });
    return { width: innerWidth, height: innerHeight, scrollX, scrollY,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      rootOverflow: getComputedStyle(document.documentElement).overflow,
      bodyOverflow: getComputedStyle(document.body).overflow,
      rootFont: getComputedStyle(document.documentElement).fontSize,
      capability: { maxTouchPoints: navigator.maxTouchPoints, coarse: matchMedia('(any-pointer: coarse)').matches }, labels };
  });
}

for (const hasTouch of [false, true]) {
  test.describe(hasTouch ? 'touch context' : 'mouse context', () => {
    // Firefox may expose coarse pointer but zero maxTouchPoints; reflow needs
    // neither capability. Record actual values without faking native support.
    test.use({ hasTouch });
    for (const language of ['en', 'sk']) for (const enlarged of [true, false]) {
      test(`session size labels reflow readably ${language} ${enlarged ? '200% root text' : 'normal windows'}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto('/');
        if (language === 'sk') {
          await page.locator('.settings-button').click();
          await page.getByRole('button', { name: 'Slovenčina' }).click();
          await page.keyboard.press('Escape');
        }
        if (enlarged) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        const measurements = [];
        const viewports = enlarged ? [{ width: 320, height: 568 }, { width: 568, height: 320 }]
          : [{ width: 320, height: 568 }, { width: 1024, height: 600 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }];
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          // Only vertical scrolling: sideways auto-scroll must not hide a defect.
          const flow = await page.locator('.workspace').getAttribute('data-menu-mode') === 'flow';
          if (flow) await page.locator('.session-options').evaluate(el => { window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 40); });
          const measured = await geometry(page);
          measurements.push({ viewport, ...measured });
          await testInfo.attach(`geometry-${viewport.width}`, { body: JSON.stringify(measured, null, 2), contentType: 'application/json' });
          await page.screenshot({ path: testInfo.outputPath(`selection-${viewport.width}.png`) });
          expect.soft(measured.scrollWidth).toBeLessThanOrEqual(viewport.width);
          expect(measured.scrollX).toBe(0);
          expect(measured.labels).toHaveLength(3);
          expect(measured.rootOverflow).not.toMatch(/hidden|clip/);
          expect(measured.bodyOverflow).not.toMatch(/hidden|clip/);
          if (enlarged) expect(measured.rootFont).toBe('32px');
          if (flow) expect(measured.scrollHeight).toBeGreaterThan(viewport.height);
          else {
            expect(measured.scrollHeight).toBeLessThanOrEqual(viewport.height);
            expect(measured.scrollY).toBe(0);
            await expect(page.locator('.start-button')).toBeInViewport();
          }
          if (!enlarged) {
            expect(measured.labels.map(label => label.box.top)).toEqual(Array(3).fill(measured.labels[0].box.top));
            if (viewport.width >= 1024) expect(measured.scrollHeight).toBeLessThanOrEqual(viewport.height);
          }
          for (const label of measured.labels) {
            expect.soft(label.box.width, label.label!).toBeGreaterThanOrEqual(44);
            expect.soft(label.box.height, label.label!).toBeGreaterThanOrEqual(44);
            expect.soft(label.box.left, label.label!).toBeGreaterThanOrEqual(0);
            expect.soft(label.box.right, label.label!).toBeLessThanOrEqual(viewport.width);
            expect(label.text.length).toBeGreaterThan(0);
            for (const text of label.text) {
              expect.soft(text.left, label.label!).toBeGreaterThanOrEqual(label.content.left - 1);
              expect.soft(text.right, label.label!).toBeLessThanOrEqual(label.content.right + 1);
              expect.soft(text.top, label.label!).toBeGreaterThanOrEqual(label.content.top - 1);
              expect.soft(text.bottom, label.label!).toBeLessThanOrEqual(label.content.bottom + 1);
            }
          }
          for (let i = 0; i < measured.labels.length; i++) for (const b of measured.labels.slice(i + 1)) {
            const a = measured.labels[i];
            expect.soft(nonoverlapping(a.box, b.box)).toBe(true);
            for (const x of a.text) for (const y of b.text)
              expect.soft(nonoverlapping(x, y)).toBe(true);
          }
          for (const size of [5, 10, 20]) {
            const label = page.locator('.session-options label').filter({ has: page.getByRole('radio', { name: `${size} ${language === 'sk' ? 'príkladov' : 'exercises'}`, exact: true }) });
            if (flow) await label.evaluate(el => { window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 40); });
            const box = (await label.boundingBox())!;
            expect.soft(box.x + box.width).toBeLessThanOrEqual(viewport.width);
            expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
            // Ordinary pointer activation, never scrollIntoView's horizontal correction.
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            await expect(label.getByRole('radio')).toBeChecked();
            expect(await page.evaluate(() => scrollX)).toBe(0);
          }
          await expect(page.locator('.level-option')).toHaveCount(8);
        }
        await testInfo.attach('all-geometry', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
        await page.locator('.start-button').click();
        await expect(page.locator('.exercise-position')).toHaveText(language === 'sk' ? 'Príklad 1 z 20' : 'Exercise 1 of 20');
        expect(errors).toEqual([]);
      });
    }
  });
}
