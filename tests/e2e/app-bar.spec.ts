import { expect, test, type Page } from '@playwright/test';
import { openMathematics } from './course';

// SCRUM-133: one app bar on every screen. Back | (badge, streak: SCRUM-117/118) | profile | settings.

async function solve(page: Page) {
  const value = await page.locator('.equation').evaluate((el) => {
    const terms = [...el.querySelectorAll('[data-term]')];
    const blank = terms.findIndex((term) => term.querySelector('input'));
    const [a, b, c] = terms.map((term) => Number(term.textContent));
    return blank === 2 ? a + b : blank === 0 ? c - b : c - a;
  });
  await page.getByRole('textbox').fill(String(value));
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
}

const bar = (page: Page) => page.getByRole('navigation', { name: 'Main controls' });

test('the bar is on every screen with the approved items, and Back works as before', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  const nav = bar(page);
  // Course choice: nowhere to go back to.
  await expect(nav).toBeVisible();
  expect(
    await nav
      .getByRole('button')
      .evaluateAll((all) => all.map((b) => b.getAttribute('aria-label'))),
  ).toEqual(['Sign in', 'Settings']);
  await expect(nav.getByRole('button', { name: /Back/ })).toHaveCount(0);
  // Menu: Back in the bar, none left inside the heading.
  await openMathematics(page);
  await expect(nav.getByRole('button', { name: 'Back to courses' })).toBeVisible();
  await expect(page.locator('main').getByRole('button', { name: 'Back to courses' })).toHaveCount(
    0,
  );
  // Order in the bar = visual = keyboard order.
  const names = await nav
    .getByRole('button')
    .evaluateAll((all) => all.map((b) => b.getAttribute('aria-label')));
  expect(names).toEqual(['Back to courses', 'Sign in', 'Settings']);
  // Lesson: no profile; Back still asks before leaving work.
  await page.getByRole('radio', { name: '5 exercises', exact: true }).check();
  await page.getByRole('button', { name: 'Let’s count' }).click();
  await expect(nav.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Settings' })).toBeVisible();
  await page.getByRole('textbox').fill('1');
  await nav.getByRole('button', { name: 'Choose level' }).click();
  await expect(page.getByRole('dialog')).toContainText('Leave this trail?');
  await page.getByRole('button', { name: 'Keep practising' }).click();
  await page.getByRole('textbox').fill('');
  for (let i = 0; i < 5; i++) {
    await solve(page);
    await page
      .getByRole('button', { name: i < 4 ? 'Next exercise' : 'See how you did', exact: true })
      .click();
  }
  // Summary: the profile is back; opening it leaves the finished lesson.
  await expect(page.getByRole('heading', { name: 'Look how far you’ve come!' })).toBeVisible();
  await nav.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeFocused();
  // Account screens: Back goes one step back (privacy -> sign in -> the maths menu).
  await page.getByRole('button', { name: 'What we store' }).first().click();
  await expect(page.getByRole('heading', { name: 'What we store' })).toBeFocused();
  await nav.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeFocused();
  await page.getByRole('button', { name: 'Create account' }).click();
  await nav.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeFocused();
  await nav.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Where shall we explore?' })).toBeFocused();
});

test('Slovak names for the bar and its buttons', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Slovenčina' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Matematika' }).click();
  const nav = page.getByRole('navigation', { name: 'Hlavné ovládanie' });
  const names = await nav
    .getByRole('button')
    .evaluateAll((all) => all.map((b) => b.getAttribute('aria-label')));
  expect(names).toEqual(['Späť na kurzy', 'Prihlásiť sa', 'Nastavenia']);
});

// Defined devices. Short landscape phones (max-height 500, max-width 950) get the left bar.
const DEVICES: [number, number, boolean][] = [
  [390, 844, true],
  [360, 640, true],
  [320, 568, true],
  [844, 390, true],
  [568, 320, true],
  [820, 1180, true],
  [1180, 820, true],
  [884, 1004, true],
  [884, 838, true],
  [742, 702, true],
  [1280, 520, false],
  [733, 500, false],
  [1366, 900, false],
];

async function measure(page: Page) {
  return page.evaluate(() => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      const st = getComputedStyle(e);
      return r.width > 1 && r.height > 1 && st.visibility !== 'hidden';
    };
    const items = [...document.querySelectorAll('.app-bar button')].filter(visible);
    const rects = items.map((i) => i.getBoundingClientRect());
    const content = [
      ...document.querySelectorAll(
        'main h2, main p, main label, main legend, main button, main input, main .equation, main .bear-scene svg, main .level-option, main .course-option',
      ),
    ].filter(visible);
    const textual = /^(P|H2|LABEL|LEGEND)$/;
    const overlaps: string[] = [];
    for (const [n, a] of rects.entries())
      for (const c of content) {
        let boxes = [c.getBoundingClientRect()];
        if (textual.test(c.tagName)) {
          const range = document.createRange();
          range.selectNodeContents(c);
          boxes = [...range.getClientRects()];
        }
        if (
          boxes.some(
            (r) =>
              r.width > 0 &&
              a.left < r.right - 0.5 &&
              r.left < a.right - 0.5 &&
              a.top < r.bottom - 0.5 &&
              r.top < a.bottom - 0.5,
          )
        )
          overlaps.push(`${items[n].getAttribute('aria-label')} / ${c.tagName}.${c.className}`);
      }
    const root = document.documentElement;
    const check = [...document.querySelectorAll('main button')].find(
      (b) => b.textContent?.trim() === 'Check answer',
    );
    return {
      lefts: rects.map((r) => Math.round(r.left)),
      tops: rects.map((r) => Math.round(r.top)),
      rights: rects.map((r) => Math.round(r.right)),
      small: rects.filter((r) => r.width < 47.5 || r.height < 47.5).length,
      overlaps,
      pageScroll: root.scrollHeight - root.clientHeight,
      sideScroll: root.scrollWidth - root.clientWidth,
      mode: document.querySelector('.workspace')?.getAttribute('data-menu-mode'),
      checkBottom: check ? check.getBoundingClientRect().bottom - root.clientHeight : null,
    };
  });
}

for (const [width, height, touch] of DEVICES)
  test(`bar placement and no overlap at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    if (touch)
      await page.addInitScript(() =>
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 }),
      );
    const left = height <= 500 && width <= 950 && width > height;
    const screens: [string, () => Promise<void>][] = [
      ['course choice', async () => {}],
      ['maths menu', () => openMathematics(page)],
      ['english menu', () => page.getByRole('button', { name: 'English', exact: true }).click()],
      [
        'practice',
        async () => {
          await openMathematics(page);
          await page.getByRole('button', { name: 'Let’s count' }).click();
        },
      ],
      ['sign in', () => page.getByRole('button', { name: 'Sign in' }).click()],
    ];
    for (const [name, open] of screens) {
      await page.goto('/');
      await open();
      await page.waitForTimeout(150);
      const m = await measure(page);
      await info.attach(`${name}.json`, {
        body: JSON.stringify(m),
        contentType: 'application/json',
      });
      expect(m.overlaps, name).toEqual([]);
      expect(m.small, name).toBe(0);
      expect(m.sideScroll, name).toBeLessThanOrEqual(0);
      if (left) {
        // A narrow bar on the left, items stacked from top to bottom.
        expect(Math.max(...m.rights), name).toBeLessThanOrEqual(56);
        expect(new Set(m.lefts).size, name).toBe(1);
        expect(m.tops, name).toEqual([...m.tops].sort((a, b) => a - b));
      } else {
        // On top, items in one row from left to right.
        expect(Math.max(...m.tops), name).toBeLessThanOrEqual(16);
        expect(new Set(m.tops).size, name).toBe(1);
        expect(m.lefts, name).toEqual([...m.lefts].sort((a, b) => a - b));
      }
      if (m.mode === 'contained') expect(m.pageScroll, name).toBeLessThanOrEqual(0);
      if (m.checkBottom !== null) expect(m.checkBottom, name).toBeLessThanOrEqual(0);
    }
    await page.screenshot({ path: info.outputPath('last.png') });
  });
