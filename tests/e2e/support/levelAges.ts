import { expect, type Page } from '@playwright/test';

// SCRUM-308 age badges: layout and overlap checks shared by the signed-out and signed-in specs.

/** Ages per course and level as shown (the approved table in src/levelAges.ts). */
export const AGES: Record<string, string[]> = {
  small: ['5–6', '5–7', '5–7'],
  math: ['6–7', '6–8', '7–8', '7–9', '8–9', '8–9', '8–9'],
  logic: ['5–7', '5–9', '5–6', '5–7', '5–8', '5–9', '5–9', '5–9'], // SCRUM-324: + Pexeso 6-8
  english: ['5–9', '5–9', '8–9'],
  wordsearch: ['5–9', '7–9', '8–9'],
};
export const MENUS = Object.keys(AGES);

/**
 * The open level menu's layout (per row: title/detail lines and height) and every badge's
 * problems (text, aria-hidden, outside its row, overlap with the row's text Range boxes,
 * number tile, sign or dot).
 */
export async function menuLayout(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const ws = document.querySelector<HTMLElement>('main.workspace')!;
    const list = document.querySelector<HTMLElement>('section.selection .level-options')!;
    const lines = (el: Element | null) =>
      el
        ? Math.round(
            el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight),
          )
        : 0;
    const textRects = (el: Element | null) => {
      if (!el) return [];
      const range = document.createRange();
      range.selectNodeContents(el);
      return [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    };
    const hit = (a: DOMRect, b: DOMRect) =>
      a.left < b.right - 0.5 &&
      b.left < a.right - 0.5 &&
      a.top < b.bottom - 0.5 &&
      b.top < a.bottom - 0.5;
    const rows = [...list.querySelectorAll('.level-option')].map((row) => ({
      title: lines(row.querySelector('.level-title')),
      detail: lines(row.querySelector('.level-detail')),
      height: Math.round(row.getBoundingClientRect().height * 10) / 10,
    }));
    const badges = [...list.querySelectorAll('.level-option')].map((row) => {
      const badge = row.querySelector('.level-age');
      if (!badge) return { text: null, problems: ['missing'] };
      const b = badge.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      const problems: string[] = [];
      if (badge.getAttribute('aria-hidden') !== 'true') problems.push('not aria-hidden');
      if (b.left < r.left || b.right > r.right || b.top < r.top || b.bottom > r.bottom)
        problems.push('outside row');
      const others: [string, DOMRect[]][] = [
        ['title', textRects(row.querySelector('.level-title'))],
        ['detail', textRects(row.querySelector('.level-detail'))],
        ['number', [row.querySelector('.level-number')!.getBoundingClientRect()]],
        ['dot', [row.querySelector('.selection-dot')!.getBoundingClientRect()]],
        ...[...row.querySelectorAll('.next-play')].map(
          (s) => ['sign', [s.getBoundingClientRect()]] as [string, DOMRect[]],
        ),
      ];
      for (const [name, rects] of others)
        if (rects.some((x) => hit(b, x))) problems.push(`overlaps ${name}`);
      return { text: badge.textContent, problems };
    });
    return {
      rows,
      badges,
      page: {
        mode: ws.dataset.menuMode ?? null,
        compact: 'menuCompact' in ws.dataset,
        tight: 'menuTight' in ws.dataset,
        scroll: de.scrollHeight - de.clientHeight,
        sideways: de.scrollWidth - de.clientWidth,
      },
    };
  });
}

/** Takes every badge out of the DOM (not display:none) and lets the menu hook re-measure. */
export async function withoutBadges(page: Page) {
  await page.evaluate(() => document.querySelectorAll('.level-age').forEach((b) => b.remove()));
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(250);
  const layout = await menuLayout(page);
  return { rows: layout.rows, page: layout.page };
}

/** Opens each menu of the course choice, checks it against itself without badges, goes back. */
export async function checkMenus(page: Page, where: string) {
  for (const menu of MENUS) {
    await page.locator(`.course-option.course-${menu}`).click();
    await page.locator('section.selection .level-option').first().waitFor();
    await page.waitForTimeout(250);
    const at = `${where} ${menu}`;
    const withBadges = await menuLayout(page);
    expect(
      withBadges.badges.map((b) => b.text),
      at,
    ).toEqual(AGES[menu]);
    expect(
      withBadges.badges.flatMap((b) => b.problems),
      at,
    ).toEqual([]);
    expect(withBadges.page.sideways, `${at} sideways scroll`).toBeLessThanOrEqual(0);
    const without = await withoutBadges(page);
    expect(
      { rows: withBadges.rows, page: withBadges.page },
      `${at}: same as without badges`,
    ).toEqual(without);
    await page.locator('.back-button').click();
    await page.locator('.course-option').first().waitFor();
  }
}
