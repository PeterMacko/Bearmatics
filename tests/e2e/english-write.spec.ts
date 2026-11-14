import { expect, test, type Page } from '@playwright/test';

// SCRUM-80: English listen-and-write. On-screen keyboard simulated two ways at the defined
// devices: Android shrinks the page; iPhone/iPad keep the page and cover its lower part (only the
// visual viewport shrinks). Real devices: Peter's Android checks (accepted limit).
const DEVICES: [string, number, number, number][] = [
  // name, width, height, share of the height left visible with the keyboard open
  ['phone', 390, 844, 0.5],
  ['small phone', 320, 568, 0.48],
  ['phone 360', 360, 640, 0.5],
  ['phone landscape', 844, 390, 0.42],
  ['small phone landscape', 568, 320, 0.42],
  ['tablet', 820, 1180, 0.62],
  ['tablet landscape', 1180, 820, 0.52],
  ['foldable unfolded', 884, 1004, 0.56],
];

async function fakeVisualViewport(page: Page) {
  await page.addInitScript(() => {
    const vv = new EventTarget();
    let height = innerHeight;
    Object.defineProperties(vv, {
      width: { get: () => innerWidth },
      height: { get: () => height },
      offsetTop: { get: () => 0 },
      offsetLeft: { get: () => 0 },
      scale: { get: () => 1 },
    });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    (window as unknown as { keyboard: (h: number) => void }).keyboard = (h: number) => {
      height = h;
      vv.dispatchEvent(new Event('resize'));
    };
  });
}

async function startWriting(page: Page, slovak = false) {
  await page.goto('/');
  if (slovak) {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Slovenčina' }).click();
    await page.getByRole('button', { name: 'Zavrieť nastavenia' }).click();
  }
  await page.getByRole('button', { name: slovak ? 'Angličtina' : 'English', exact: true }).click();
  await page.getByRole('radio', { name: slovak ? /^Úroveň 3 / : /^Level 3 / }).click();
  await page.getByRole('button', { name: slovak ? /Poďme počúvať/ : /Let’s listen/ }).click();
}

async function visibleParts(page: Page, visible: number) {
  return page.evaluate((visible) => {
    const parts = ['.speaker-button', '.write-shown strong', '.write-input', '.answer-button']
      .map((s) => document.querySelector(s))
      .filter((e): e is Element => e !== null)
      .map((e) => e.getBoundingClientRect());
    const inside = parts.every(
      (r) => r.top >= 0 && r.bottom <= visible + 1 && r.left >= 0 && r.right <= innerWidth + 1,
    );
    const overlap = parts.some((a, i) =>
      parts.some(
        (c, j) =>
          j > i &&
          !(a.right <= c.left || c.right <= a.left || a.bottom <= c.top || c.bottom <= a.top),
      ),
    );
    const input = document.querySelector('.write-input')!;
    return {
      count: parts.length,
      inside,
      overlap,
      inputFont: parseFloat(getComputedStyle(input).fontSize),
      checkHeight: document.querySelector('.answer-button')!.getBoundingClientRect().height,
      focused: document.activeElement === input,
    };
  }, visible);
}

for (const mode of ['Android (page shrinks)', 'iPhone/iPad (keyboard covers)'] as const) {
  for (const [name, width, height, keep] of DEVICES) {
    for (const slovak of [false, true]) {
      test(`write: keyboard ${mode} at ${name} ${width}x${height} ${slovak ? 'SK' : 'EN'}: speaker, word, input, Check visible`, async ({
        browser,
        browserName,
      }) => {
        const context = await browser.newContext({
          viewport: { width, height },
          hasTouch: true,
          ...(browserName === 'chromium' ? { isMobile: width < 900 } : {}),
        });
        const page = await context.newPage();
        const ios = mode.startsWith('iPhone');
        if (ios) await fakeVisualViewport(page);
        await startWriting(page, slovak);
        const input = page.getByRole('textbox');
        await input.click();
        await input.fill('qqq');
        await input.press('Enter'); // wrong try: the word is shown
        const visible = Math.round(height * keep);
        if (ios)
          await page.evaluate(
            (h) => (window as unknown as { keyboard: (h: number) => void }).keyboard(h),
            visible,
          );
        else await page.setViewportSize({ width, height: visible });
        await expect(page.locator('.write-practice')).toHaveAttribute(
          'data-keyboard',
          /open|short/,
        );
        const parts = await visibleParts(page, visible);
        expect(parts.count).toBe(4);
        expect(parts.inside).toBe(true);
        expect(parts.overlap).toBe(false);
        expect(parts.inputFont).toBeGreaterThanOrEqual(24); // text does not shrink
        expect(parts.checkHeight).toBeGreaterThanOrEqual(44);
        expect(parts.focused).toBe(true);
        await context.close();
      });
    }
  }
}

test('write on desktop with a physical keyboard: normal layout, Enter checks and goes on', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(() => {
    const played: string[] = [];
    (window as unknown as { played: string[] }).played = played;
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      played.push(decodeURIComponent(this.src.split('/').pop()!.replace('.mp3', '')));
      return original.call(this).catch(() => undefined);
    };
  });
  await startWriting(page);
  const input = page.getByRole('textbox', { name: 'Write the word you hear' });
  await expect(input).toBeFocused();
  await expect(page.locator('.write-practice')).not.toHaveAttribute('data-keyboard');
  for (const [attr, value] of [
    ['autocapitalize', 'none'],
    ['autocorrect', 'off'],
    ['autocomplete', 'off'],
    ['spellcheck', 'false'],
  ])
    await expect(input).toHaveAttribute(attr, value);
  const word = await page.evaluate(() =>
    (window as unknown as { played: string[] }).played.at(-1)!,
  );
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Write the word.');
  await input.fill(` ${word.toUpperCase()} `);
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('That’s it! Nicely done.');
  await input.press('Enter');
  await expect(page.getByText('Word 2 of 10')).toBeVisible();
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(
    true,
  );
});
