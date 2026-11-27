import { expect, test, type Page } from '@playwright/test';
import { ALL_DEVICES, COURSE_CHOICE_DEVICES } from './support/devices';
import { setLanguage } from './support/language';

// SCRUM-71: course choice and English home across devices, languages and input methods.
const SIZES = COURSE_CHOICE_DEVICES;
const COPY = {
  en: {
    courses: 'What shall we learn today?',
    math: 'Maths',
    english: 'English',
    mathHeading: 'Where shall we explore?',
    englishHeading: 'Which level shall we try?',
    search: 'Word search',
    searchHeading: 'Which word search shall we try?',
    back: 'Back to courses',
    level3: /^Level 3 /,
  },
  sk: {
    courses: 'Čo sa dnes naučíme?',
    math: 'Matematika',
    english: 'Angličtina',
    mathHeading: 'Kam sa vyberieme?',
    englishHeading: 'Ktorú úroveň skúsime?',
    search: 'Osemsmerovka',
    searchHeading: 'Ktorú osemsmerovku skúsime?',
    back: 'Späť na kurzy',
    level3: /^Úroveň 3 /,
  },
};

/** SCRUM-333: the course intro (signed out: the sign-in note) stays fully visible, and every
 * course card can be scrolled fully into view inside the card list (the page itself never
 * scrolls). Returns how much of the list is hidden. */
async function cardsReachable(page: Page) {
  await expect(page.locator('.course-choice .menu-heading .intro')).toBeInViewport({ ratio: 1 });
  const cards = page.locator('.course-option');
  await expect(cards).toHaveCount(5);
  const hidden = await page
    .locator('.course-options')
    .evaluate((list) => list.scrollHeight - list.clientHeight);
  for (const card of await cards.all()) {
    await card.evaluate((c) => c.scrollIntoView({ block: 'nearest' }));
    await expect(card).toBeInViewport({ ratio: 1 });
    expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
  ).toBeLessThanOrEqual(1);
  await page.locator('.course-options').evaluate((list) => (list.scrollTop = 0));
  return hidden;
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
      ...main.querySelectorAll('h2, .eyebrow, .intro, .level-title, .level-detail'),
      ...main.querySelectorAll('.course-title'),
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
      if (lang === 'sk') await setLanguage(page, 'Slovenčina', { gear: 'name', close: 'button' });
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
      await checkLayout(page);
      // All three English levels are playable: with level 3 selected the menu still fits.
      await page.getByRole('radio', { name: c.level3 }).click();
      await checkLayout(page);
      // SCRUM-241: the Word search menu (three levels) fits the same way.
      await page.getByRole('button', { name: c.back }).click();
      await page.getByRole('button', { name: c.search, exact: true }).click();
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(c.searchHeading);
      await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
      await checkLayout(page);
      await page.getByRole('radio', { name: c.level3 }).click();
      await checkLayout(page);
      await context.close();
    });

test('keyboard opens each course, Back returns, and focus is visible on cards', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await page.keyboard.press('Tab'); // Sign in (SCRUM-97), left of the gear
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
  await page.keyboard.press('Tab'); // settings gear
  await page.keyboard.press('Tab');
  // SCRUM-309: "Bear picks a game" above the cards comes first.
  await expect(page.getByRole('button', { name: 'Bear picks a game' })).toBeFocused();
  await page.keyboard.press('Tab');
  // SCRUM-141: Small maths comes first, then (SCRUM-262) Logic, then Maths.
  await expect(page.getByRole('button', { name: 'Small maths', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Logic', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  const math = page.getByRole('button', { name: 'Maths', exact: true });
  await expect(math).toBeFocused();
  expect(await math.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Where shall we explore?' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: /^Level 1 / })).toBeFocused();
  // SCRUM-133: the app bar comes before the screen, in visual order: Back, Sign in, Settings.
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Back to courses' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'What shall we learn today?' })).toBeFocused();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'English', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Which level shall we try?' })).toBeFocused();
  const start = page.getByRole('button', { name: /Let’s listen/ });
  await start.focus();
  await page.keyboard.press('Enter');
  // English levels 1-2 start from the keyboard; focus moves to the speaker.
  await expect(page.getByRole('button', { name: 'Play the word again' })).toBeFocused();
});

test('touch taps open Maths and practice still starts from its menu', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Maths', exact: true }).tap();
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
    for (const course of ['Small maths', 'Maths', 'English', 'Word search', null]) {
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
    for (const course of ['Maths', 'English']) {
      await page.getByRole('button', { name: course, exact: true }).click();
      await expect(workspace).toHaveAttribute('data-menu-compact', '');
      await expect(workspace).toHaveAttribute('data-menu-mode', 'contained');
      await expect(page.locator('.menu-heading .intro')).toBeHidden();
      const h2 = await page
        .locator('.menu-heading h2')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(h2).toBeLessThanOrEqual(24);
      // The level list either scrolls inside itself or shows every level in full.
      const list = page.locator('.level-options');
      expect(
        await list.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const cards = [...el.querySelectorAll('label')].map((c) => c.getBoundingClientRect());
          return (
            el.scrollHeight > el.clientHeight + 1 ||
            cards.every((c) => c.top >= box.top - 1 && c.bottom <= box.bottom + 1)
          );
        }),
      ).toBe(true);
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
  for (const course of ['Maths', 'English']) {
    await page.getByRole('button', { name: course, exact: true }).click();
    await expect(page.locator('.workspace')).not.toHaveAttribute('data-menu-compact');
    await expect(page.locator('.menu-heading .intro')).toBeVisible();
    await page.getByRole('button', { name: 'Back to courses' }).click();
  }
});

// SCRUM-77 QA D1/D2: while the menu is "contained", the page itself never scrolls
// (course choice, Small maths, Logic, Maths, English and Word search), including the sizes that
// used to break.
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
    for (const course of [null, 'Small maths', 'Logic', 'Maths', 'English', 'Word search']) {
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

// SCRUM-77 QA D3: very short wide windows keep list-only scrolling wherever a level fits
// (the tall decorative bear must not force page flow). Narrower columns at 320 px high
// legitimately need page flow for the maths/English lists, so only the QA cases are listed.
for (const [width, height, screens] of [
  [1280, 320, ['courses', 'Maths', 'English']],
  [1366, 300, ['courses', 'Maths', 'English']],
  [1100, 320, ['courses', 'Maths']],
  [1000, 320, ['courses']],
  [820, 320, ['courses']],
] as const)
  test(`very short wide ${width}x${height} keeps the level list scrolling (${screens.join(', ')})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    for (const screen of screens) {
      if (screen !== 'courses')
        await page.getByRole('button', { name: screen, exact: true }).click();
      await expect(page.locator('.workspace'), screen).toHaveAttribute(
        'data-menu-mode',
        'contained',
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
      ).toBeLessThanOrEqual(1);
      if (screen !== 'courses') {
        await expect(page.locator('.start-button')).toBeInViewport({ ratio: 1 });
        await page.getByRole('button', { name: 'Back to courses' }).click();
      }
    }
  });

// SCRUM-141 QA146-01: on short landscape phones all course cards (five since SCRUM-241) were
// fully visible without scrolling the card list. SCRUM-333 (Peter): the intro line (signed out:
// the sign-in note) now stays visible there too, and the cards may scroll inside their list:
// every card is reachable in full, the page never scrolls.
for (const [width, height] of [
  [844, 390],
  [568, 320],
  [733, 500],
] as const)
  for (const lang of ['en', 'sk'])
    test(`intro visible and all five course cards reachable at ${width}x${height} ${lang}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      if (lang === 'sk') await setLanguage(page, 'Slovenčina', { gear: 'name', close: 'button' });
      await cardsReachable(page);
    });

// QA271-03: at 200% text on the phone the course detail runs under the icon (full card width),
// so the cards are shorter: with four cards the list hid at most 200 px (277-351 px before the
// fix). SCRUM-241 adds a fifth card (about 150 px at 200%): the list may hide that card more,
// at most 200 px plus the fifth card's height and gap. SCRUM-309 puts the "Bear picks a game"
// button above the list: it may hide that button's height and gap more. At normal text the
// cards keep the detail beside the icon.
for (const lang of ['en', 'sk'])
  test(`200% text ${lang} at 390x844: course cards use the full width for the detail`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    if (lang === 'sk') await setLanguage(page, 'Slovenčina', { gear: 'name', close: 'button' });
    const layout = () =>
      page.evaluate(() => {
        const list = document.querySelector<HTMLElement>('.course-options')!;
        const cards = [...list.querySelectorAll<HTMLElement>('.course-option')].map((card) => {
          const box = (s: string) => card.querySelector(s)!.getBoundingClientRect();
          return {
            detailUnderIcon: box('.level-detail').left < box('.course-icon').right,
            detailBelowTitle: box('.level-detail').top >= box('.course-title').bottom - 1,
            height: card.offsetHeight,
          };
        });
        const d = document.documentElement;
        return {
          hidden: list.scrollHeight - list.clientHeight,
          pageScroll: d.scrollHeight - d.clientHeight,
          sideScroll: d.scrollWidth - d.clientWidth,
          cards,
        };
      });
    const normal = await layout();
    expect(normal.cards.every((c) => !c.detailUnderIcon)).toBe(true);
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await expect(page.locator('.workspace')).toHaveAttribute('data-menu-mode', 'contained');
    const fifth = await page
      .locator('.course-option')
      .nth(4)
      .evaluate((card) => (card as HTMLElement).offsetHeight + 8);
    const pick = await page
      .locator('.bear-picks-button')
      .evaluate((button) => (button as HTMLElement).offsetHeight + 8);
    // SCRUM-333: the intro stays visible: the list may hide its height and margins more.
    const intro = await page
      .locator('.course-choice .menu-heading .intro')
      .evaluate((p) => (p as HTMLElement).offsetHeight + 16);
    await expect
      .poll(async () => (await layout()).hidden)
      .toBeLessThanOrEqual(200 + fifth + pick + intro);
    const large = await layout();
    expect(large.cards.every((c) => c.detailUnderIcon && c.detailBelowTitle)).toBe(true);
    expect(large.pageScroll).toBeLessThanOrEqual(1);
    expect(large.sideScroll).toBeLessThanOrEqual(0);
    expect(Math.min(...large.cards.map((c) => c.height))).toBeGreaterThanOrEqual(48);
  });

// SCRUM-241: five course cards, signed in (badge, points, frozen streak and a 12-character
// nickname in the bar): every card is fully visible at every defined device and the menu
// layout settles (it used to switch the compact heading on and off at 884x600, and cut a card
// at 742x702 and 1280x520). SCRUM-309: at 320x568 the "Bear picks a game" button above the
// cards takes the room of the last card: there the list scrolls inside by at most the button's
// height and gap (no page scroll); every other device still shows all five cards. SCRUM-333:
// windows up to 568 px high keep the intro and their cards may scroll inside the list (every
// card reachable in full, no page scroll); taller devices still show all five cards.
for (const device of ALL_DEVICES)
  for (const lang of ['en', 'sk'] as const)
    test(`signed in: five course cards visible and the layout settles at ${device.width}x${device.height} ${lang}`, async ({
      page,
    }) => {
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        const json = (body: unknown) =>
          route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
        if (path === '/api/me')
          return json({
            account: {
              kind: 'password',
              username: 'kid',
              nickname: lang === 'en' ? 'Brave Cub' : 'Honeybear123',
              look: { fur: 1, background: 1, head: 2, neck: 0, eyes: 0 },
              email: null,
              leaderboard: true,
            },
          });
        if (path === '/api/progress')
          return json({ points: 135, streak: 12, frozen: true, today: false });
        return json({ available: false });
      });
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.goto('/');
      await page.locator('.badge-button').waitFor();
      if (lang === 'sk') await setLanguage(page, 'Slovenčina', { gear: 'name', close: 'button' });
      await page.waitForTimeout(300);
      const changes = await page.evaluate(async () => {
        const workspace = document.querySelector('.workspace')!;
        let count = 0;
        const observer = new MutationObserver((list) => (count += list.length));
        observer.observe(workspace, { attributes: true });
        await new Promise((done) => setTimeout(done, 800));
        observer.disconnect();
        return count;
      });
      expect(changes).toBe(0);
      const cards = page.locator('.course-option');
      await expect(cards).toHaveCount(5);
      const hidden = await page
        .locator('.course-options')
        .evaluate((list) => list.scrollHeight - list.clientHeight);
      await expect(page.locator('.bear-picks-button')).toBeInViewport({ ratio: 1 });
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
      ).toBeLessThanOrEqual(0);
      if (device.height <= 568) {
        await cardsReachable(page);
        return;
      }
      for (const card of await cards.all()) await expect(card).toBeInViewport({ ratio: 1 });
      expect(hidden).toBeLessThanOrEqual(1);
    });

// SCRUM-333 (Peter): signed out, the sign-in note under the heading is visible on every defined
// device (it used to be hidden on short windows), and every course card stays reachable.
for (const device of ALL_DEVICES)
  for (const lang of ['en', 'sk'] as const)
    test(`signed out: sign-in note visible at ${device.width}x${device.height} ${lang}`, async ({
      page,
    }) => {
      await page.route('**/api/**', (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(
            new URL(route.request().url()).pathname === '/api/me'
              ? { account: null }
              : { available: false },
          ),
        }),
      );
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.goto('/');
      if (lang === 'sk') await setLanguage(page, 'Slovenčina', { gear: 'name', close: 'button' });
      await expect(page.locator('.course-choice .menu-heading .intro')).toHaveText(
        lang === 'en'
          ? 'Sign in to collect points and compare with other players.'
          : 'Prihlás sa, zbieraj body a porovnaj sa s ostatnými hráčmi.',
      );
      await cardsReachable(page);
      await expect(page.locator('.bear-picks-button')).toBeInViewport({ ratio: 1 });
    });
