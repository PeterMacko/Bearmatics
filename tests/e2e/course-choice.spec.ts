import { expect, test, type Page } from '@playwright/test';

// SCRUM-71: course choice and English home across devices, languages and input methods.
const SIZES = [
  { name: 'phone portrait', width: 390, height: 844, touch: true },
  { name: 'small phone', width: 320, height: 568, touch: true },
  { name: 'phone landscape', width: 844, height: 390, touch: true },
  { name: 'tablet portrait', width: 820, height: 1180, touch: true },
  { name: 'tablet landscape', width: 1180, height: 820, touch: true },
  { name: 'foldable unfolded', width: 884, height: 1004, touch: true },
  { name: 'wide short', width: 1280, height: 520, touch: false },
  { name: 'desktop', width: 1366, height: 900, touch: false },
];
const COPY = {
  en: {
    courses: 'What shall we learn today?',
    math: 'Mathematics',
    english: 'English',
    mathHeading: 'Where shall we explore?',
    englishHeading: 'Which level shall we try?',
    back: 'Back to courses',
    soon: 'English exercises are coming soon.',
  },
  sk: {
    courses: 'Čo sa dnes naučíme?',
    math: 'Matematika',
    english: 'Angličtina',
    mathHeading: 'Kam sa vyberieme?',
    englishHeading: 'Ktorú úroveň skúsime?',
    back: 'Späť na kurzy',
    soon: 'Anglické cvičenia už čoskoro pribudnú.',
  },
};

async function toSlovak(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Slovenčina' }).click();
  await page.getByRole('button', { name: 'Zavrieť nastavenia' }).click();
}

/** Layout invariants for the current menu screen. */
async function checkLayout(page: Page) {
  const r = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const visible = (e: Element) => {
      const b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    };
    const texts = [
      ...main.querySelectorAll('h2, .eyebrow, .intro, .level-title, .level-detail, .soon-tag'),
      ...main.querySelectorAll('.coming-soon-note, .course-title'),
    ].filter(visible);
    return {
      horizontalScroll: Math.max(
        document.documentElement.scrollWidth - innerWidth,
        // No inner region may scroll sideways either (e.g. an over-wide course list).
        ...[...main.querySelectorAll('*')]
          .filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowX))
          .map((e) => e.scrollWidth - e.clientWidth),
      ),
      clipped: texts
        .filter((e) => {
          // Real clipping only: text hidden by an overflow:hidden/clip ancestor or off-screen.
          const range = document.createRange();
          range.selectNodeContents(e);
          const t = range.getBoundingClientRect();
          if (t.left < -1 || t.right > innerWidth + 1) return true;
          for (let a = e as Element | null; a && a !== document.body; a = a.parentElement) {
            const style = getComputedStyle(a);
            if (!/hidden|clip/.test(style.overflowX + style.overflowY)) continue;
            const b = a.getBoundingClientRect();
            if (t.left < b.left - 1 || t.right > b.right + 1) return true;
            if (
              /hidden|clip/.test(style.overflowY) &&
              (t.top < b.top - 6 || t.bottom > b.bottom + 6)
            )
              return true;
          }
          return false;
        })
        .map((e) => e.textContent),
      offscreen: [...main.querySelectorAll('button, label, .level-option, .menu-heading')]
        .filter(visible)
        .map((e) => [e.getBoundingClientRect(), e.textContent] as const)
        .filter(([b]) => b.left < -1 || b.right > innerWidth + 1)
        .map(([, text]) => text),
      smallTargets: [
        ...main.querySelectorAll('button, label.level-option, .session-options label > span'),
      ]
        .filter(visible)
        .map((e) => e.getBoundingClientRect())
        .filter((b) => b.width < 48 || b.height < 47)
        .map((b) => [b.width, b.height]),
      mode: main.dataset.menuMode,
      headings: document.querySelectorAll('main h2').length,
      listScrolls: (() => {
        const list = main.querySelector<HTMLElement>('.level-options')!;
        return getComputedStyle(list).overflowY;
      })(),
    };
  });
  expect(r.horizontalScroll).toBeLessThanOrEqual(0);
  expect(r.clipped).toEqual([]);
  expect(r.offscreen).toEqual([]);
  expect(r.smallTargets).toEqual([]);
  expect(r.headings).toBe(1);
  if (r.mode === 'contained') expect(r.listScrolls).toBe('auto');
  else expect(r.mode).toBe('flow');
  // Every interactive control in the menu can be reached (by scrolling if needed).
  for (const control of await page.locator('main button, main input').all())
    await control.scrollIntoViewIfNeeded();
}

for (const size of SIZES)
  for (const lang of ['en', 'sk'] as const)
    test(`course screens fit ${size.name} ${size.width}x${size.height} ${lang}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        hasTouch: size.touch,
      });
      const page = await context.newPage();
      const c = COPY[lang];
      await page.goto('/');
      if (lang === 'sk') await toSlovak(page);
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(c.courses);
      await checkLayout(page);
      await page.getByRole('button', { name: c.math, exact: true }).click();
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(c.mathHeading);
      await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
      await checkLayout(page);
      await page.getByRole('button', { name: c.back }).click();
      await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
      await page.getByRole('button', { name: c.english, exact: true }).click();
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(c.englishHeading);
      await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
      await expect(page.getByText(c.soon)).toBeVisible();
      await checkLayout(page);
      await context.close();
    });

test('keyboard opens each course, Back returns, and focus is visible on cards', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await page.keyboard.press('Tab'); // settings gear
  await page.keyboard.press('Tab');
  const math = page.getByRole('button', { name: 'Mathematics', exact: true });
  await expect(math).toBeFocused();
  expect(await math.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Where shall we explore?' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: /^Level 1 / })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Back to courses' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'What shall we learn today?' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'English', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Which level shall we try?' })).toBeFocused();
  const start = page.getByRole('button', { name: /Let’s listen/ });
  await start.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Which level shall we try?' })).toBeVisible();
  await expect(page.locator('.practice')).toHaveCount(0);
});

test('touch taps open Mathematics and practice still starts from its menu', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Mathematics', exact: true }).tap();
  await page.getByRole('radio', { name: /^Level 2 / }).tap();
  await page.getByRole('button', { name: 'Let’s count' }).tap();
  await expect(page.locator('.practice')).toBeVisible();
  await page.getByRole('button', { name: 'Choose level' }).tap();
  await expect(page.getByRole('heading', { name: 'Where shall we explore?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Level 2 / })).toBeChecked();
  await context.close();
});

for (const size of [SIZES[0], SIZES[1], SIZES[2], SIZES[6]])
  test(`200% text stays readable with SCRUM-36 scroll rules on ${size.name}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    for (const course of ['Mathematics', 'English', null]) {
      if (course) {
        await page.getByRole('button', { name: course, exact: true }).click();
      }
      await checkLayout(page);
      // SCRUM-36 rule: fixed heading/controls stay fully visible, otherwise the page scrolls.
      const fit = await page.evaluate(() => {
        const main = document.querySelector('main')!;
        const bottom = (s: string) =>
          document.querySelector(s)?.getBoundingClientRect().bottom ?? 0;
        return {
          mode: main.dataset.menuMode,
          fixedVisible:
            bottom('.menu-heading') <= innerHeight + 1 &&
            bottom('.menu-controls') <= innerHeight + 1,
          pageScrolls: document.scrollingElement!.scrollHeight > innerHeight,
        };
      });
      if (fit.mode === 'contained') expect(fit.fixedVisible).toBe(true);
      else expect(fit).toMatchObject({ mode: 'flow', pageScrolls: true });
      if (course) await page.getByRole('button', { name: 'Back to courses' }).click();
    }
    await context.close();
  });

for (const [width, height] of [
  [733, 500],
  [844, 390],
])
  test(`short ${width}x${height} window: compact heading keeps level list scrolling on both menus`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const workspace = page.locator('.workspace');
    for (const course of ['Mathematics', 'English']) {
      await page.getByRole('button', { name: course, exact: true }).click();
      await expect(workspace).toHaveAttribute('data-menu-compact', '');
      await expect(workspace).toHaveAttribute('data-menu-mode', 'contained');
      await expect(page.locator('.menu-heading .intro')).toBeHidden();
      const h2 = await page
        .locator('.menu-heading h2')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(h2).toBeLessThanOrEqual(24);
      const list = page.locator('.level-options');
      expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight + 1)).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
      ).toBe(true);
      const sizes = await page
        .locator('.session-options label')
        .evaluateAll((labels) =>
          labels.map((label) => Math.round(label.getBoundingClientRect().top)),
        );
      expect(new Set(sizes).size).toBe(1);
      await expect(page.locator('.start-button')).toBeInViewport({ ratio: 1 });
      await page.getByRole('button', { name: 'Back to courses' }).click();
    }
  });

test('tall window keeps the full heading with its intro', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  for (const course of ['Mathematics', 'English']) {
    await page.getByRole('button', { name: course, exact: true }).click();
    await expect(page.locator('.workspace')).not.toHaveAttribute('data-menu-compact');
    await expect(page.locator('.menu-heading .intro')).toBeVisible();
    await page.getByRole('button', { name: 'Back to courses' }).click();
  }
});

// SCRUM-77 QA D1/D2: while the menu is "contained", the page itself never scrolls
// (course choice, Mathematics and English), including the sizes that used to break.
for (const [width, height] of [
  [1280, 520],
  [1280, 400],
  [1000, 440],
  [820, 460],
  [733, 640],
  [640, 720],
  [844, 390],
])
  test(`no page scroll while contained at ${width}x${height} on every menu screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    for (const course of [null, 'Mathematics', 'English']) {
      if (course) await page.getByRole('button', { name: course, exact: true }).click();
      const workspace = page.locator('.workspace');
      await expect(workspace).toHaveAttribute('data-menu-mode', /contained|flow/);
      const state = await page.evaluate(() => ({
        mode: document.querySelector<HTMLElement>('.workspace')!.dataset.menuMode,
        overflow: document.documentElement.scrollHeight - innerHeight,
      }));
      if (state.mode === 'contained')
        expect(state.overflow, `${course ?? 'courses'}`).toBeLessThanOrEqual(1);
      if (course) await page.getByRole('button', { name: 'Back to courses' }).click();
    }
  });

// SCRUM-77 QA D3: very short wide windows keep list-only scrolling (the tall decorative
// bear must not force page flow when a level fits).
for (const [width, height] of [
  [1280, 320],
  [1000, 320],
  [820, 320],
  [1366, 300],
])
  test(`very short wide ${width}x${height} keeps the level list scrolling on every menu screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    for (const course of [null, 'Mathematics', 'English']) {
      if (course) await page.getByRole('button', { name: course, exact: true }).click();
      const workspace = page.locator('.workspace');
      await expect(workspace, `${course ?? 'courses'}`).toHaveAttribute(
        'data-menu-mode',
        'contained',
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
      ).toBeLessThanOrEqual(1);
      if (course) {
        await expect(page.locator('.start-button')).toBeInViewport({ ratio: 1 });
        await page.getByRole('button', { name: 'Back to courses' }).click();
      }
    }
  });
