import { expect, test, type Locator, type Page } from '@playwright/test';
import { AGES, MENUS } from './support/levelAges';

// SCRUM-308 round 2 (Peter: "small popup when user click on years that say recommended for
// age"): a tap on a level's age badge opens a small popup "Recommended for ages 5–7" /
// "Odporúčané pre vek 5–7 rokov" and still chooses that level. The popup floats over the menu
// (rendered into <body>, position: fixed) fully inside the window and is never clipped by the
// level list's scroll box; one at a time; it closes on a tap elsewhere, Escape, Back/Start, by
// itself after ~3 s, and when its badge is scrolled out of the list; it follows list scrolling.
// Negative control: AGE_POPUP_NEGATIVE=1 moves the open popup into the level list with
// overflow clipping (what a popup rendered inside the list would look like): the spec fails.

const popupText = (lang: string, ages: string) =>
  lang === 'en' ? `Recommended for ages ${ages}` : `Odporúčané pre vek ${ages} rokov`;

/** The open popups and, for exactly one, its text, placement and hit-testing. */
async function popupState(page: Page) {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>('.level-age-popup')];
    if (all.length !== 1) return { count: all.length };
    const p = all[0];
    const r = p.getBoundingClientRect();
    const de = document.documentElement;
    const vw = de.clientWidth;
    const vh = de.clientHeight;
    // 5 px in from each corner (inside the 10 px rounding) and the centre: the popup is on top
    // there, so nothing clips or covers it.
    const points = [
      [r.left + 5, r.top + 5],
      [r.right - 5, r.top + 5],
      [r.left + 5, r.bottom - 5],
      [r.right - 5, r.bottom - 5],
      [(r.left + r.right) / 2, (r.top + r.bottom) / 2],
    ];
    const corners = points.map(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return !!hit && p.contains(hit);
    });
    return {
      count: 1,
      text: p.textContent,
      hidden: p.getAttribute('aria-hidden'),
      inList: !!p.closest('.level-options'),
      inside: r.left >= 0 && r.top >= 0 && r.right <= vw + 0.5 && r.bottom <= vh + 0.5,
      corners,
      textFits: p.scrollWidth <= p.clientWidth + 0.5,
      sideways: de.scrollWidth - de.clientWidth,
      side: p.dataset.side,
      vw,
      box: [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v * 10) / 10),
    };
  });
}

const pageScroll = (page: Page) =>
  page.evaluate(() => ({
    y: Math.round(window.scrollY),
    x: Math.round(window.scrollX),
    max: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    side: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));

async function openMenu(page: Page, menu: string) {
  await page.locator(`.course-option.course-${menu}`).click();
  await page.locator('section.selection .level-option').first().waitFor();
  await page.waitForTimeout(250);
}
async function backToCourses(page: Page) {
  await page.locator('.back-button').click();
  await page.locator('.course-option').first().waitFor();
}

/** Taps (touch) or clicks (mouse) a row's age badge; the negative control then clips the popup. */
async function tapBadge(page: Page, row: Locator, touch: boolean) {
  const badge = row.locator('.level-age');
  if (touch) await badge.tap({ timeout: 5000 });
  else await badge.click({ timeout: 5000 });
  await page.locator('.level-age-popup').waitFor({ timeout: 5000 });
  if (process.env.AGE_POPUP_NEGATIVE)
    await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>('.level-age-popup')!;
      const list = document.querySelector<HTMLElement>('section.selection .level-options')!;
      const r = p.getBoundingClientRect();
      const l = list.getBoundingClientRect();
      list.style.setProperty('overflow', 'hidden', 'important');
      list.style.setProperty('position', 'relative', 'important');
      p.style.setProperty('position', 'absolute', 'important');
      p.style.left = `${r.left - l.left + list.scrollLeft}px`;
      p.style.top = `${r.top - l.top + list.scrollTop}px`;
      list.append(p);
    });
  await page.waitForTimeout(200);
}

async function expectShown(page: Page, row: Locator, text: string, at: string) {
  const state = await popupState(page);
  expect(state, at).toMatchObject({
    count: 1,
    text,
    hidden: 'true',
    inList: false,
    inside: true,
    corners: [true, true, true, true, true],
    textFits: true,
    sideways: 0,
  });
  // Anchored to its badge: 7 px under it (or above it), right edges aligned unless shifted to
  // stay 8 px inside the window.
  const b = (await row.locator('.level-age').boundingBox())!;
  const [left, top, right, bottom] = state.box!;
  const vertical =
    state.side === 'below' ? top - (b.y + b.height) : state.side === 'above' ? b.y - bottom : 7;
  expect(Math.abs(vertical - 7), `${at}: ${state.side} its badge`).toBeLessThan(1);
  const aligned =
    Math.abs(right - (b.x + b.width)) < 1 ||
    Math.abs(left - 8) < 1 ||
    Math.abs(right - (state.vw! - 8)) < 1;
  expect(aligned, `${at}: aligned with its badge ${JSON.stringify([b, state.box])}`).toBe(true);
  await expect(row.locator('input'), `${at}: level chosen`).toBeChecked();
}

async function closeWithEscape(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('.level-age-popup')).toHaveCount(0);
}

for (const [width, height, touch] of [
  [390, 844, true],
  [1366, 900, false],
] as const)
  test.describe(`${touch ? 'touch' : 'mouse'} ${width}x${height}`, () => {
    test.use({ hasTouch: touch, viewport: { width, height } });
    test(`the age badge of every level opens its popup and chooses the level (EN/SK, ${touch ? 'tap' : 'click'})`, async ({
      page,
    }) => {
      test.setTimeout(150_000);
      for (const lang of ['en', 'sk']) {
        await page.goto(`/?lang=${lang}`);
        await page.locator('.course-option').first().waitFor();
        for (const menu of MENUS) {
          await openMenu(page, menu);
          const rows = page.locator('section.selection .level-option');
          for (let i = 0; i < AGES[menu].length; i++) {
            const row = rows.nth(i);
            await row.scrollIntoViewIfNeeded();
            const before = await pageScroll(page);
            await tapBadge(page, row, touch);
            const at = `${lang} ${menu} ${i + 1}`;
            await expectShown(page, row, popupText(lang, AGES[menu][i]), at);
            // The tap does not scroll the page; a touch tap does not toggle it closed again.
            expect(await pageScroll(page), `${at} page scroll`).toEqual(before);
            if (i === 0) {
              await page.waitForTimeout(400);
              await expect(page.locator('.level-age-popup'), at).toHaveCount(1);
            }
            await closeWithEscape(page);
            await expect(row.locator('input'), `${at}: still chosen`).toBeChecked();
          }
          await backToCourses(page);
        }
      }
    });
  });

test.describe('closing', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('closes on a tap elsewhere, on the popup, another badge, Escape, by itself, Back and Start; the level stays', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/?lang=en');
    await openMenu(page, 'math');
    const row = (n: number) => page.locator(`section.selection .level-option.level-${n}`);
    const popup = page.locator('.level-age-popup');
    // A tap elsewhere (the heading).
    await tapBadge(page, row(2), true);
    await page.locator('section.selection h2').tap();
    await expect(popup).toHaveCount(0);
    await expect(row(2).locator('input')).toBeChecked();
    // A tap on the popup closes it and does not choose the row under it.
    await tapBadge(page, row(1), true);
    await popup.tap();
    await expect(popup).toHaveCount(0);
    await expect(row(1).locator('input')).toBeChecked();
    // Another badge: its own popup, only one.
    await tapBadge(page, row(3), true);
    await tapBadge(page, row(5), true);
    await expect(popup).toHaveText(['Recommended for ages 8–9']);
    await expect(row(5).locator('input')).toBeChecked();
    // Escape.
    await closeWithEscape(page);
    await expect(row(5).locator('input')).toBeChecked();
    // By itself after about 3 s.
    await tapBadge(page, row(4), true);
    const opened = Date.now();
    await expect(popup).toHaveCount(1);
    await page.waitForTimeout(2300);
    await expect(popup).toHaveCount(1);
    await expect(popup).toHaveCount(0, { timeout: 3000 });
    expect(Date.now() - opened).toBeLessThan(4500);
    await expect(row(4).locator('input')).toBeChecked();
    // Back to the courses.
    await tapBadge(page, row(6), true);
    await page.locator('.back-button').tap();
    await page.locator('.course-option').first().waitFor();
    await expect(popup).toHaveCount(0);
    // Start (keyboard Enter on Start, so no tap closes it first).
    await openMenu(page, 'math');
    await tapBadge(page, row(3), true);
    await page.locator('section.selection .start-button').focus();
    await expect(popup).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(page.locator('section.selection')).toHaveCount(0);
    await expect(popup).toHaveCount(0);
  });

  test('follows the list when it scrolls and closes when its badge leaves the list (320x568)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/?lang=sk');
    await openMenu(page, 'math');
    const list = page.locator('section.selection .level-options');
    expect(await list.evaluate((l) => l.scrollHeight - l.clientHeight)).toBeGreaterThan(100);
    await tapBadge(page, page.locator('.level-option.level-2'), true);
    const top = async () => (await page.locator('.level-age-popup').boundingBox())!.y;
    const before = await top();
    await list.evaluate((l) => (l.scrollTop += 20));
    await page.waitForTimeout(150);
    expect(Math.abs(before - 20 - (await top()))).toBeLessThan(1.5);
    await list.evaluate((l) => (l.scrollTop = l.scrollHeight));
    await expect(page.locator('.level-age-popup')).toHaveCount(0);
    await expect(page.locator('.level-option.level-2 input')).toBeChecked();
  });
});

test('reduced motion: the popup appears without a fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=en');
  await openMenu(page, 'logic');
  await tapBadge(page, page.locator('.level-option.level-1'), false);
  expect(
    await page.locator('.level-age-popup').evaluate((p) => getComputedStyle(p).animationName),
  ).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await closeWithEscape(page);
  await tapBadge(page, page.locator('.level-option.level-2'), false);
  expect(
    await page.locator('.level-age-popup').evaluate((p) => getComputedStyle(p).animationName),
  ).toBe('level-age-popup-in');
});

/**
 * Rows to try per menu: the top-right-most row, the row cut by the bottom of the list's visible
 * part (or the window) whose badge is still visible, and the last row scrolled to the bottom.
 */
async function edgeRows(page: Page) {
  return page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('section.selection .level-options')!;
    const rows = [...list.querySelectorAll<HTMLElement>('.level-option')];
    const vh = document.documentElement.clientHeight;
    const scrolls =
      getComputedStyle(list).overflowY !== 'visible' && list.scrollHeight > list.clientHeight + 1;
    const bottom = Math.min(vh, scrolls ? list.getBoundingClientRect().bottom : vh);
    const badges = rows.map((r) => r.querySelector('.level-age')!.getBoundingClientRect());
    let topRight = 0;
    badges.forEach((b, i) => {
      const t = badges[topRight];
      if (b.top < t.top - 1 || (Math.abs(b.top - t.top) <= 1 && b.right > t.right)) topRight = i;
    });
    const cut = rows.findIndex(
      (r, i) =>
        r.getBoundingClientRect().bottom > bottom + 1 &&
        badges[i].top >= 0 &&
        badges[i].bottom <= bottom - 1,
    );
    return { topRight, cut, last: rows.length - 1 };
  });
}

for (const [width, height, zoom] of [
  [320, 568, 1],
  [568, 320, 1],
  [320, 568, 2],
] as const)
  test.describe(`edges ${width}x${height}${zoom === 2 ? ' 200% text' : ''}`, () => {
    test.use({ hasTouch: true, viewport: { width, height } });
    test(`the popup of the top-right, the cut-off and the last row is fully visible (EN/SK, 5 menus)`, async ({
      page,
    }) => {
      test.setTimeout(150_000);
      let cutRows = 0;
      for (const lang of ['en', 'sk']) {
        await page.goto(`/?lang=${lang}`);
        await page.locator('.course-option').first().waitFor();
        if (zoom === 2) await page.addStyleTag({ content: 'html{font-size:200% !important}' });
        for (const menu of MENUS) {
          await openMenu(page, menu);
          const rows = page.locator('section.selection .level-option');
          const { topRight, cut, last } = await edgeRows(page);
          const tries: [string, number][] = [['top-right', topRight]];
          if (cut >= 0) tries.push(['cut-off', cut]);
          tries.push(['last', last]);
          for (const [kind, i] of tries) {
            const row = rows.nth(i);
            if (kind === 'last') {
              await row.evaluate((r) => r.scrollIntoView({ block: 'end' }));
              await page.waitForTimeout(150);
            } else if (kind === 'cut-off') cutRows++;
            const before = await pageScroll(page);
            await tapBadge(page, row, true);
            const at = `${lang} ${width}x${height}@${zoom} ${menu} ${kind} row ${i + 1}`;
            await expectShown(page, row, popupText(lang, AGES[menu][i]), at);
            expect(await pageScroll(page), `${at} page scroll`).toEqual(before);
            await closeWithEscape(page);
          }
          await backToCourses(page);
        }
      }
      // The list scrolls at 320x568 (Maths, Logic, ...): the cut-off case really ran.
      if (width === 320 && zoom === 1) expect(cutRows).toBeGreaterThan(0);
    });
  });
