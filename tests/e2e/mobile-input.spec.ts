import { expect, test, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

async function switchLanguage(page: Page, language: string, gear: string, close: string) {
  await page.getByRole('button', { name: gear, exact: true }).click();
  await page.getByRole('button', { name: language, exact: true }).click();
  await page.getByRole('button', { name: close, exact: true }).click();
}

async function answerFor(page: Page) {
  return page.locator('.equation').evaluate((el) => {
    const parts = [...el.querySelectorAll('[data-term]')];
    const blank = parts.findIndex((p) => p.querySelector('input'));
    const [a, b, c] = parts.map((p) => Number(p.textContent));
    const op = el.querySelector('.operator')!.textContent;
    if (blank === 2) return op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
    if (blank === 0) return op === '+' ? c - b : op === '−' ? c + b : op === '×' ? c / b : c * b;
    return op === '+' ? c - a : op === '−' ? a - c : op === '×' ? c / a : a / c;
  });
}
async function enter(page: Page, value: number) {
  const input = page.getByRole('textbox');
  await input.focus();
  if ((await input.getAttribute('readonly')) !== null) await page.keyboard.press('Delete');
  else await input.fill('');
  await page.keyboard.type(String(value));
}
async function visibleInViewport(locator: Locator, page: Page) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = await page.evaluate(() => ({
    width: visualViewport!.width,
    height: visualViewport!.height,
  }));
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}
test('native fallback and orientation changes preserve practice with localized input guidance', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('radio', { name: /Level 4 ·/ }).check();
  await page.getByRole('button', { name: 'Let’s count' }).click();
  const input = page.getByRole('textbox');
  await expect(input).toBeEditable();
  await input.fill('100');
  await page.locator('.hint-button').click();
  await page.getByRole('button', { name: 'Close hint' }).click();
  const equation = await page.locator('.equation').getAttribute('aria-label');
  await input.focus();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(input).toBeEditable();
  await page.getByRole('button', { name: 'Use number pad' }).click();
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
  await page.locator('.hint-button').click();
  await expect(page.locator('.hint-step')).toHaveText('Hint 1 / 3');
  await page.getByRole('button', { name: 'Close hint' }).click();
  await switchLanguage(page, 'Slovenčina', 'Settings', 'Zavrieť nastavenia');
  await page.getByRole('button', { name: 'Použiť číselnú klávesnicu' }).click();
  await expect(input).toHaveAttribute('readonly', '');
  await expect(input).toHaveAccessibleDescription(/Použi číselnú klávesnicu/);
  await expect(input).toHaveValue('007');
  await page.locator('.hint-button').click();
  await expect(page.locator('.hint-step')).toHaveText('Pomôcka 1 / 3');
  await page.getByRole('button', { name: 'Zavrieť pomôcku' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toHaveValue('007');
});

test('enlarged text reflows metadata and keeps help and primary controls reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await switchLanguage(page, 'Slovenčina', 'Settings', 'Zavrieť nastavenia');
  await page.getByRole('button', { name: 'Začať počítať' }).click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const position = (await page.locator('.exercise-position').boundingBox())!;
  const progress = (await page.locator('progress').boundingBox())!;
  expect(progress.y).toBe(0);
  expect(progress.y + progress.height).toBeLessThan(position.y);
  await page.locator('.answer-button').scrollIntoViewIfNeeded();
  await expect(page.locator('.answer-button')).toBeInViewport();
  await page.locator('.hint-button').click();
  const help = page.locator('.hint-dialog-content');
  await help.focus();
  await expect(help).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
});

for (const [width, height] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [568, 320],
]) {
  for (const language of ['en', 'sk']) {
    test(`compact ${width}x${height} ${language}: core, hints, review and stable action`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript(() =>
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 }),
      );
      await page.goto('/');
      if (language === 'sk')
        await switchLanguage(page, 'Slovenčina', 'Settings', 'Zavrieť nastavenia');
      await page
        .getByRole('radio', {
          name: language === 'sk' ? '5 príkladov' : '5 exercises',
          exact: true,
        })
        .check();
      await page
        .getByRole('button', { name: language === 'sk' ? 'Začať počítať' : 'Let’s count' })
        .click();
      await expect(page.getByRole('textbox')).toHaveAttribute('readonly', '');
      await expect(page.locator('.input-mode-button')).toHaveCount(0);
      const core = [
        '.bear',
        'progress',
        '.equation',
        '.feedback',
        '.number-pad',
        '.answer-button',
        '.hint-button',
        '.back-button',
        '.settings-button',
      ];
      for (const selector of core) await visibleInViewport(page.locator(selector), page);
      const action = (await page.locator('.answer-button').boundingBox())!;
      const info = (await page.locator('.hint-button').boundingBox())!;
      expect(info.y).toBeCloseTo(action.y, 0);
      expect(info.x).toBeGreaterThanOrEqual(action.x + action.width);
      expect(info.width).toBeGreaterThanOrEqual(44);
      expect(info.height).toBeGreaterThanOrEqual(44);
      const bear = (await page.locator('.bear').boundingBox())!;
      const position = (await page.locator('.exercise-position').boundingBox())!;
      const equation = (await page.locator('.equation').boundingBox())!;
      expect(bear.width).toBeGreaterThanOrEqual(64);
      const character = (await page.locator('.bear-character').boundingBox())!;
      expect(character.width).toBeGreaterThanOrEqual(64);
      expect(character.height).toBeGreaterThanOrEqual(64);
      const progress = (await page.locator('progress').boundingBox())!;
      await expect(page.getByRole('progressbar')).toHaveCount(1);
      expect(progress.x).toBe(0);
      expect(progress.y).toBe(0);
      expect(progress.width).toBe(width);
      expect(progress.height).toBeLessThanOrEqual(4);
      expect(
        await page.locator('progress').evaluate((el) => el.parentElement!.firstElementChild === el),
      ).toBe(true);
      await expect(page.locator('progress')).toHaveCSS('border-bottom-width', '0px');
      await expect(page.locator('header')).toHaveCSS('border-bottom-width', '0px');
      const gap = bear.y - (progress.y + progress.height);
      for (const selector of ['.settings-button', '.back-button']) {
        const corner = (await page.locator(selector).boundingBox())!;
        expect(corner.width).toBeGreaterThanOrEqual(44);
        expect(corner.height).toBeGreaterThanOrEqual(44);
        for (const target of ['.bear', '.equation', '.number-pad']) {
          const b = (await page.locator(target).boundingBox())!;
          expect(
            corner.x + corner.width <= b.x ||
              b.x + b.width <= corner.x ||
              corner.y + corner.height <= b.y ||
              b.y + b.height <= corner.y,
          ).toBe(true);
        }
      }
      expect(gap).toBeGreaterThanOrEqual(12);
      const positionGap = Math.max(
        position.x - (bear.x + bear.width),
        position.y - (bear.y + bear.height),
      );
      const equationGap = Math.max(
        equation.x - (bear.x + bear.width),
        equation.y - (bear.y + bear.height),
      );
      expect(positionGap).toBeGreaterThanOrEqual(0);
      expect(equationGap).toBeGreaterThanOrEqual(0);
      if (height > width) {
        expect(position.width).toBeGreaterThanOrEqual(100);
        expect(bear.width).toBeGreaterThanOrEqual(height >= 800 ? 170 : height >= 640 ? 150 : 130);
      }
      for (const key of await page.locator('.number-pad button').all()) {
        const box = (await key.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(48);
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
      await page.screenshot({
        path: testInfo.outputPath(`core-${width}x${height}-${language}.png`),
      });
      await writeFile(
        testInfo.outputPath('bear-progress.json'),
        JSON.stringify({ bear, character, progress, gap, positionGap, equationGap }, null, 2),
      );
      const actionBefore = await page.locator('.answer-button').boundingBox();
      const first = await answerFor(page);
      await enter(page, first + 1);
      await page.locator('.answer-button').click();
      await page.locator('.hint-button').click();
      const advance = page.getByRole('button', {
        name: language === 'sk' ? 'Ďalšia pomôcka' : 'Show next hint',
      });
      await advance.click();
      await advance.click();
      await expect(page.getByTestId('worked-solution')).toBeVisible();
      // Long hints scroll inside the modal, with actions outside the scroller.
      const help = page.locator('.hint-dialog-content');
      await expect(help).toHaveAttribute('tabindex', '0');
      await help.focus();
      const needsScroll = await help.evaluate((el) => el.scrollHeight > el.clientHeight);
      await help.press('End');
      if (needsScroll)
        await expect.poll(() => help.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      const evidence = testInfo.outputPath('mobile-layout');
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: `${evidence}/hints-${width}x${height}-${language}.png` });
      await page
        .getByRole('button', { name: language === 'sk' ? 'Zavrieť pomôcku' : 'Close hint' })
        .click();
      for (const selector of core) await visibleInViewport(page.locator(selector), page);
      await enter(page, first);
      await page.getByRole('textbox').press('Enter');
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
      await expect(page.locator('.exercise-position')).toContainText(
        language === 'sk' ? 'Opakovanie' : 'Review',
      );
      for (const selector of core) await visibleInViewport(page.locator(selector), page);
      await page.locator('.hint-button').click();
      await expect(help).toContainText(language === 'sk' ? 'Tieto príklady' : 'These are the ones');
      await page
        .getByRole('button', { name: language === 'sk' ? 'Zavrieť pomôcku' : 'Close hint' })
        .click();
      await mkdir(evidence, { recursive: true });
      const boxes = Object.fromEntries(
        await Promise.all(core.map(async (s) => [s, await page.locator(s).boundingBox()])),
      );
      await writeFile(
        `${evidence}/layout-${width}x${height}-${language}.json`,
        JSON.stringify(boxes, null, 2),
      );
      await page.screenshot({ path: `${evidence}/review-${width}x${height}-${language}.png` });
      await enter(page, first);
      await page.getByRole('textbox').press('Enter');
      await page.locator('.answer-button').click();
      // Inspecting review hints still requires a fresh unassisted presentation.
      await expect(page.locator('.exercise-position')).toContainText(
        language === 'sk' ? 'Opakovanie' : 'Review',
      );
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('.hint-panel')).toHaveCount(0);
      await enter(page, first);
      await page.getByRole('textbox').press('Enter');
      await page.locator('.answer-button').click();
      await expect(page.locator('.first-try')).toContainText('4 / 5');
    });
  }
}

for (const language of ['en', 'sk']) {
  test(`hint modal keyboard lifecycle ${language} on desktop and short zoomed landscape`, async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    if (language === 'sk')
      await switchLanguage(page, 'Slovenčina', 'Settings', 'Zavrieť nastavenia');
    await page
      .getByRole('radio', { name: new RegExp(language === 'sk' ? 'Úroveň 6 ·' : 'Level 6 ·') })
      .check();
    await page
      .getByRole('button', { name: language === 'sk' ? 'Začať počítať' : 'Let’s count' })
      .click();
    const input = page.getByRole('textbox');
    await enter(page, 7);
    const trigger = page.locator('.hint-button');
    const close = page.getByRole('button', {
      name: language === 'sk' ? 'Zavrieť pomôcku' : 'Close hint',
    });
    const next = page.getByRole('button', {
      name: language === 'sk' ? 'Ďalšia pomôcka' : 'Show next hint',
    });
    await expect(page.locator('.hint-panel')).toHaveCount(0);
    await trigger.click();
    const dialog = page.getByRole('dialog', {
      name: language === 'sk' ? 'Pomôcka' : 'Hint',
      exact: true,
    });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(close).toBeFocused();
    for (const background of ['header', 'main'])
      await expect(page.locator(background)).toHaveAttribute('inert', '');
    await expect(page.locator('footer')).toHaveCount(0);
    await input.evaluate((el) => (el as HTMLElement).focus());
    await expect(close).toBeFocused();
    await close.press('Shift+Tab');
    await expect(next).toBeFocused();
    await next.press('Tab');
    await expect(close).toBeFocused();
    await next.click();
    await expect(page.locator('.hint-step')).toContainText('2 / 3');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(input).toHaveValue('7');
    await expect(page.locator('main')).not.toHaveAttribute('inert');
    await trigger.click();
    await expect(page.locator('.hint-step')).toContainText('2 / 3');
    await page.setViewportSize({ width: 568, height: 320 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const content = page.locator('.hint-dialog-content');
    expect(await content.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await content.focus();
    await content.press('End');
    await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await visibleInViewport(close, page);
    await visibleInViewport(next, page);
    await next.click();
    await expect(page.getByTestId('worked-solution')).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: language === 'sk' ? 'Všetky pomôcky zobrazené' : 'All hints shown',
      }),
    ).toBeDisabled();
    await close.focus();
    await close.press('Shift+Tab');
    await expect(content).toBeFocused();
    await content.press('Tab');
    await expect(close).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`hint-zoom-${language}.png`) });
    await close.click();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(page.locator('.hint-step')).toContainText('3 / 3');
    await close.click();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe(
      'hidden',
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => window.scrollBy(0, 80));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.locator('.answer-button').scrollIntoViewIfNeeded();
    await expect(page.locator('.answer-button')).toBeInViewport();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
    await enter(page, await answerFor(page));
    await input.press('Enter');
    await page.locator('.answer-button').click();
    await expect(dialog).toHaveCount(0);
    await trigger.click();
    await expect(page.locator('.hint-step')).toContainText('1 / 3');
    await close.click();
  });
}

test('calculator pad DOM, visual and keyboard order agree', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Let’s count' }).click();
  await page.getByRole('button', { name: 'Use number pad' }).click();
  const keys = page.locator('.number-pad button');
  const labels = ['7', '8', '9', '0', '4', '5', '6', 'Clear answer', '1', '2', '3', 'Backspace'];
  expect(
    await keys.evaluateAll((elements) => elements.map((el) => el.getAttribute('aria-label'))),
  ).toEqual(labels);
  await keys.first().focus();
  const boxes = await keys.evaluateAll((elements) =>
    elements.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y };
    }),
  );
  for (let i = 0; i < labels.length; i++) {
    await expect(keys.nth(i)).toBeFocused();
    if (i % 4) {
      expect(boxes[i].y).toBe(boxes[i - 1].y);
      expect(boxes[i].x).toBeGreaterThan(boxes[i - 1].x);
    }
    if (i >= 4) {
      expect(boxes[i].x).toBe(boxes[i - 4].x);
      expect(boxes[i].y).toBeGreaterThan(boxes[i - 4].y);
    }
    await page.keyboard.press('Tab');
  }
});
