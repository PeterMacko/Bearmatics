import { expect, test, type Locator, type Page } from '@playwright/test';
import { ALL_DEVICES, DEVICE, type Device } from './support/devices';
import { answerFor } from './support/maths';
import { nextFrames } from './support/layout';

// SCRUM-172 on every defined device, in English and Slovak: the former text buttons are bordered
// secondary buttons with a decorative icon before an unchanged name, the screens that fitted
// before still fit (no page scroll), and tapping the bear shows its bubble without moving focus
// or changing the lesson.

/** The summary already scrolled here before SCRUM-172 (c26d448: 55 px signed out, 96 px in). */
const SUMMARY_SCROLLED_BEFORE: Device[] = [DEVICE.smallPhoneLandscape];

const COPY = {
  en: {
    maths: 'Maths',
    english: 'English',
    again: 'Play again',
    back: 'Choose level',
    stay: 'Keep practising',
    leave: 'Choose a new trail',
    tryAgain: 'Try again',
    wordFailed: 'The word could not play.',
    unlock: 'Unlock',
    noThanks: 'No thanks',
    yes: 'Yes',
    offerBack: 'Back',
    offer: 'Frozen streak',
    board: /^Leaderboard, /,
    bubble: 'Grrr!',
  },
  sk: {
    maths: 'Matematika',
    english: 'Angličtina',
    again: 'Hrať znova',
    back: 'Vybrať úroveň',
    stay: 'Pokračovať v počítaní',
    leave: 'Vybrať novú cestu',
    tryAgain: 'Skúsiť znova',
    wordFailed: 'Slovo sa nepodarilo prehrať.',
    unlock: 'Odomknúť',
    noThanks: 'Nie, ďakujem',
    yes: 'Áno',
    offerBack: 'Späť',
    offer: 'Zamrznutá séria',
    board: /^Rebríček, /,
    bubble: 'Brum brum!',
  },
} as const;
type Lang = keyof typeof COPY;

async function open(page: Page, device: Device, lang: Lang) {
  await page.setViewportSize({ width: device.width, height: device.height });
  await page.goto('/');
  if (lang === 'sk') {
    await page.locator('.settings-button').click();
    await page.getByRole('button', { name: 'Slovenčina' }).click();
    await page.keyboard.press('Escape');
  }
}

/** Types into the answer, through the keyboard when the app number pad made it read-only. */
async function type(page: Page, value: string) {
  const input = page.getByRole('textbox');
  if ((await input.getAttribute('readonly')) !== null) {
    await input.focus();
    await input.press('Delete');
    await input.pressSequentially(value);
  } else await input.fill(value);
}

/** 5 exercises, tapped on its visible pill (Firefox reports the 1 px radio as covered by it). */
async function pickFive(page: Page) {
  await page.locator('.session-options label').first().click();
  await expect(page.locator('.session-options input').first()).toBeChecked();
}

async function startMaths(page: Page, lang: Lang) {
  await page.getByRole('button', { name: COPY[lang].maths, exact: true }).click();
  await pickFive(page);
  await page.locator('.start-button').click();
  await expect(page.locator('.equation')).toBeVisible();
}

async function finishLesson(page: Page) {
  for (let i = 0; i < 5; i++) {
    await type(page, String(await answerFor(page)));
    await page.locator('.answer-button').first().click();
    await page.locator('.answer-button').first().click();
  }
  await expect(page.locator('.summary')).toBeVisible();
}

/**
 * Icon first (decorative), name unchanged; secondary: 2 px solid border, transparent, >= 48 px,
 * border >= 3:1 and text >= 4.5:1 against the colour behind the button.
 */
async function expectButton(button: Locator, icon: string, secondary: boolean) {
  await expect(button).toBeVisible();
  // Not hovered (the pointer may rest where the previous screen's button was).
  await button.page().mouse.move(0, 0);
  const m = await button.evaluate((b) => {
    const style = getComputedStyle(b);
    const first = b.firstElementChild;
    const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    // The colour behind the button: its ancestors' backgrounds blended from the page down.
    const layers: number[][] = [];
    for (let e: Element | null = b.parentElement; e; e = e.parentElement) {
      const [r, g, bl, a = 1] = rgba(getComputedStyle(e).backgroundColor);
      if (a > 0) layers.unshift([r, g, bl, a]);
      if (a >= 1) break;
    }
    const behind = layers.reduce(
      (acc, [r, g, bl, a]) => [
        r * a + acc[0] * (1 - a),
        g * a + acc[1] * (1 - a),
        bl * a + acc[2] * (1 - a),
      ],
      [255, 255, 255],
    );
    const lum = ([r, g, bl]: number[]) => {
      const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
    };
    const ratio = (c: number[]) => {
      const [hi, lo] = [lum(c), lum(behind)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    return {
      contrastText: ratio(rgba(style.color)) >= 4.5,
      contrastBorder: ratio(rgba(style.borderTopColor)) >= 3,
      icon: first?.tagName.toLowerCase() === 'svg' ? first.getAttribute('data-icon') : null,
      hidden: first?.getAttribute('aria-hidden'),
      iconFirst: b.firstChild === first,
      border: `${style.borderTopWidth} ${style.borderTopStyle}`,
      background: style.backgroundColor,
      color: style.color,
      borderColor: style.borderTopColor,
      tall: (b as HTMLElement).offsetHeight >= 48,
    };
  });
  expect(m.icon).toBe(icon);
  expect(m.hidden).toBe('true');
  expect(m.iconFirst).toBe(true);
  if (secondary)
    expect({ ...m, icon: undefined, hidden: undefined, iconFirst: undefined }).toEqual({
      contrastText: true,
      contrastBorder: true,
      border: '2px solid',
      background: 'rgba(0, 0, 0, 0)',
      color: 'rgb(49, 87, 131)',
      borderColor: 'rgb(49, 87, 131)',
      tall: true,
    });
}

/** A summary button (the app bar's Back has the same name as Choose level). */
const summaryButton = (page: Page, name: string) =>
  page.locator('.summary').getByRole('button', { name, exact: true });

const pageScroll = (page: Page) =>
  page.evaluate(() => ({
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));

/** Signed in with a frozen streak: finishing a lesson offers the unlock; the leaderboard fails. */
async function signedIn(page: Page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const view = { points: 135, streak: 12, frozen: true, today: false };
    if (path === '/api/me')
      return json({
        account: {
          kind: 'password',
          username: 'kid',
          nickname: 'Brave Cub',
          look: { fur: 1, background: 1, head: 2, neck: 0, eyes: 0 },
          email: null,
          leaderboard: true,
        },
      });
    if (path === '/api/progress') return json(view);
    if (path === '/api/progress/lessons') return json({ lessonId: 'a'.repeat(32) }, 201);
    if (path === '/api/progress/lessons/finish')
      return json({ ...view, points: 140, added: 5, offer: { streak: 12, missed: 2, cost: 14 } });
    if (path === '/api/leaderboard') return json({ error: 'offline' }, 500);
    return json({ available: false });
  });
}

for (const device of ALL_DEVICES) {
  const size = `${device.width}x${device.height}`;
  for (const lang of ['en', 'sk'] as const) {
    const c = COPY[lang];

    test(`${device.name} ${size} ${lang}: bear tap, leave dialog and summary`, async ({ page }) => {
      test.setTimeout(90_000);
      await open(page, device, lang);
      await page.getByRole('button', { name: c.maths, exact: true }).click();
      // Menu: the bubble appears beside the bear without side scroll.
      await page.locator('svg.bear').click();
      await expect(page.locator('.bear-bubble')).toHaveText(c.bubble);
      expect((await pageScroll(page)).x).toBe(0);
      await expect(page.locator('.bear-bubble')).toHaveCount(0, { timeout: 3000 });
      await pickFive(page);
      await page.locator('.start-button').click();
      // Lesson: the tap keeps focus and the typed answer.
      await type(page, '7');
      const input = page.getByRole('textbox');
      await input.focus();
      const before = await page.locator('.practice').textContent();
      await page.locator('svg.bear').click();
      await expect(page.locator('.bear-bubble')).toHaveText(c.bubble);
      await expect(page.locator('.bear-bubble')).toHaveAttribute('aria-hidden', 'true');
      await expect(input).toBeFocused();
      await expect(input).toHaveValue('7');
      expect(await page.locator('.practice').textContent()).toBe(before);
      expect((await pageScroll(page)).x).toBe(0);
      // Leave dialog.
      await page.locator('.app-bar button').first().click();
      const dialog = page.getByRole('dialog');
      await expectButton(dialog.getByRole('button', { name: c.stay, exact: true }), 'play', false);
      await expectButton(dialog.getByRole('button', { name: c.leave, exact: true }), 'door', true);
      await expect(dialog.getByRole('button', { name: c.leave, exact: true })).toBeInViewport({
        ratio: 1,
      });
      await dialog.getByRole('button', { name: c.stay, exact: true }).click();
      // Summary (signed out): both buttons, and the page does not scroll.
      await finishLesson(page);
      await expectButton(summaryButton(page, c.again), 'replay', false);
      await expectButton(summaryButton(page, c.back), 'list', true);
      await nextFrames(page);
      if (!SUMMARY_SCROLLED_BEFORE.includes(device))
        expect(await pageScroll(page)).toEqual({ x: 0, y: 0 });
      // The bear on the summary answers too (after its cheer).
      await page.waitForTimeout(800);
      await page.locator('svg.bear').click();
      await expect(page.locator('.bear-bubble')).toHaveText(c.bubble);
    });

    test(`${device.name} ${size} ${lang}: streak offer, signed-in summary, leaderboard Try again`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await signedIn(page);
      await open(page, device, lang);
      await expect(page.locator('.badge-button')).toBeVisible();
      await startMaths(page, lang);
      await finishLesson(page);
      const offer = page.getByRole('dialog', { name: c.offer });
      await expect(offer).toBeVisible({ timeout: 8000 });
      await expectButton(
        offer.getByRole('button', { name: c.unlock, exact: true }),
        'unlock',
        false,
      );
      await expectButton(
        offer.getByRole('button', { name: c.noThanks, exact: true }),
        'cross',
        true,
      );
      for (const name of [c.unlock, c.noThanks])
        await expect(offer.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
      await page.waitForTimeout(700);
      await offer.getByRole('button', { name: c.unlock, exact: true }).click();
      await expectButton(offer.getByRole('button', { name: c.yes, exact: true }), 'tick', false);
      await expectButton(
        offer.getByRole('button', { name: c.offerBack, exact: true }),
        'back',
        true,
      );
      for (const name of [c.yes, c.offerBack])
        await expect(offer.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
      await page.keyboard.press('Escape');
      await expect(offer).toHaveCount(0);
      // Signed-in summary: still no page scroll.
      await expectButton(summaryButton(page, c.back), 'list', true);
      await nextFrames(page);
      if (!SUMMARY_SCROLLED_BEFORE.includes(device))
        expect(await pageScroll(page)).toEqual({ x: 0, y: 0 });
      // Leaderboard that cannot load: Try again.
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: c.board }).click();
      const board = page.getByRole('dialog');
      await expectButton(
        board.getByRole('button', { name: c.tryAgain, exact: true }),
        'replay',
        true,
      );
    });

    test(`${device.name} ${size} ${lang}: English word failure Try again`, async ({ page }) => {
      await page.route('**/audio/words/*.mp3', (route) => route.abort());
      await open(page, device, lang);
      await page.getByRole('button', { name: c.english, exact: true }).click();
      await page.locator('.start-button').click();
      await expect(page.getByRole('alert')).toBeVisible();
      await expectButton(
        page.getByRole('alert').getByRole('button', { name: c.tryAgain, exact: true }),
        'replay',
        true,
      );
      // 100% text: the message stays visible beside or above the button (QA178-02).
      await expect(page.getByRole('alert')).toContainText(c.wordFailed);
      expect(await messageShown(page)).toBe(true);
      await nextFrames(page);
      expect(await pageScroll(page)).toEqual({ x: 0, y: 0 });
    });
  }
}

/** 200% text, set after the document exists (an init script is a no-op in Chromium). */
const bigText = (page: Page) =>
  page.addStyleTag({ content: 'html { font-size: 200% !important; }' });

/** The failure message is drawn (not only kept for screen readers). */
const messageShown = (page: Page) =>
  page.locator('.play-error > span').evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.width > 2 && box.height > 2;
  });

async function startEnglish(page: Page, lang: Lang, write: boolean) {
  await page.getByRole('button', { name: COPY[lang].english, exact: true }).click();
  if (write) await page.getByRole('radio', { name: /^(Level|Úroveň) 3 / }).click();
  await page.locator('.start-button').click();
  await expect(page.locator(write ? '.write-input' : '.word-option').first()).toBeVisible();
}

/**
 * QA178-01: every point of the bear's visible box (12x12 grid, clipped to the window) is the
 * bear itself, so a tap anywhere on it reaches it (the English lesson header covered it).
 */
async function bearCovered(page: Page) {
  return page.evaluate(() => {
    const bear = document.querySelector('svg.bear')!.getBoundingClientRect();
    const covered: string[] = [];
    let points = 0;
    for (let i = 1; i < 12; i++)
      for (let j = 1; j < 12; j++) {
        const x = bear.left + (bear.width * i) / 12;
        const y = bear.top + (bear.height * j) / 12;
        if (x < 0 || y < 0 || x > innerWidth - 1 || y > innerHeight - 1) continue;
        points++;
        const hit = document.elementFromPoint(x, y);
        if (!hit?.closest('svg.bear'))
          covered.push(hit ? `${hit.tagName}.${hit.className}` : 'none');
      }
    return { points, covered: [...new Set(covered)], coveredCount: covered.length };
  });
}

/** What the tap bubble covers (eyes, mouth, speaker) or where it leaves the window. */
const bubbleCovers = (page: Page) =>
  page.evaluate(() => {
    const bubble = document.querySelector('.bear-bubble')!.getBoundingClientRect();
    const found: string[] = [];
    if (bubble.left < 0 || bubble.right > document.documentElement.clientWidth)
      found.push(`outside the window ${Math.round(bubble.left)}-${Math.round(bubble.right)}`);
    for (const selector of ['.bear-tap-eyes', '.bear-tap-mouth', '.speaker-button']) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const w = Math.min(r.right, bubble.right) - Math.max(r.left, bubble.left);
      const h = Math.min(r.bottom, bubble.bottom) - Math.max(r.top, bubble.top);
      if (w > 0 && h > 0) found.push(`${selector} ${Math.round(w)}x${Math.round(h)}`);
    }
    return found;
  });

/** The bear's visible centre (inside the window). */
async function bearCentre(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector('svg.bear')!.getBoundingClientRect();
    const top = Math.max(r.top, 0);
    const bottom = Math.min(r.bottom, innerHeight);
    return { x: r.left + r.width / 2, y: (top + bottom) / 2 };
  });
}

const LESSON_TEXT: [string, boolean][] = [
  ['100%', false],
  ['200%', true],
];
for (const device of ALL_DEVICES) {
  for (const [textSize, big] of LESSON_TEXT) {
    // 200% text on the phones only (the sizes the Tester measured).
    if (big && ![DEVICE.phone, DEVICE.smallPhone, DEVICE.phone369].includes(device)) continue;
    test(`${device.name} ${device.width}x${device.height} ${textSize}: the bear can be tapped in maths, listen and write lessons`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      for (const lesson of ['maths', 'listen', 'write'] as const) {
        await open(page, device, 'en');
        if (big) await bigText(page);
        if (lesson === 'maths') await startMaths(page, 'en');
        else await startEnglish(page, 'en', lesson === 'write');
        await nextFrames(page);
        await expect(page.locator('svg.bear')).toBeVisible();
        const grid = await bearCovered(page);
        expect(grid.points, `${lesson}: bear inside the window`).toBeGreaterThan(20);
        expect(grid.covered, `${lesson}: points over the bear taken by another element`).toEqual(
          [],
        );
        // A tap shows the bubble beside the head: inside the window, never over the eyes, the
        // mouth or the English speaker button.
        const at0 = await bearCentre(page);
        await page.mouse.click(at0.x, at0.y);
        await expect(page.locator('.bear-bubble')).toHaveText(COPY.en.bubble);
        expect(await bubbleCovers(page), `${lesson}: bubble covers`).toEqual([]);
        await expect(page.locator('.bear-bubble')).toHaveCount(0, { timeout: 3000 });
        if (lesson !== 'write') continue;
        // English write: the tap shows the bubble and keeps the typing focus and the text.
        const input = page.getByRole('textbox');
        await input.fill('ab');
        await input.focus();
        const at = await bearCentre(page);
        await page.mouse.click(at.x, at.y);
        await expect(page.locator('.bear-bubble')).toHaveText(COPY.en.bubble);
        await expect(input).toBeFocused();
        await expect(input).toHaveValue('ab');
      }
    });
  }
}

// QA178-02: at 200% text on small phones the 'could not play' line shows only Try again (the
// message stays in the alert for screen readers), Try again is on screen without the child
// scrolling, and the write lesson does not scroll (it did not before SCRUM-172).
for (const device of [DEVICE.smallPhone, DEVICE.phone360, DEVICE.phone369]) {
  for (const lang of ['en', 'sk'] as const) {
    test(`${device.name} ${device.width}x${device.height} 200% ${lang}: word failure shows Try again on screen`, async ({
      page,
    }) => {
      const c = COPY[lang];
      for (const write of [false, true]) {
        await page.route('**/audio/words/*.mp3', (route) => route.abort());
        await open(page, device, lang);
        await bigText(page);
        await startEnglish(page, lang, write);
        const alert = page.getByRole('alert');
        await expect(alert).toBeVisible();
        await expect(alert).toContainText(c.wordFailed);
        const retry = alert.getByRole('button', { name: c.tryAgain, exact: true });
        await nextFrames(page);
        await expect(retry).toBeInViewport({ ratio: 1 });
        expect(await messageShown(page)).toBe(false);
        if (write) expect((await pageScroll(page)).y).toBe(0);
      }
    });
  }
}

// QA178-04: tapping the bear never moves the page (a bubble wider than the room left of the
// window edge made Chromium's mobile viewport zoom out, which reset the scroll), and the bubble
// never covers the bear's eyes or mouth.
test.describe('bear bubble on a mobile viewport', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'isMobile is Chromium only');
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 320, height: 568 } });
  for (const lang of ['en', 'sk'] as const) {
    test(`320x568 200% ${lang}: tapping the bear in a lesson keeps the scroll; bubble beside the face`, async ({
      page,
    }) => {
      await page.goto('/');
      await bigText(page);
      if (lang === 'sk') {
        await page.locator('.settings-button').tap();
        await page.getByRole('button', { name: 'Slovenčina' }).tap();
        await page.keyboard.press('Escape');
      }
      await startMaths(page, lang);
      await page.evaluate(() => window.scrollTo(0, 24));
      await nextFrames(page);
      const before = await page.evaluate(() => scrollY);
      expect(before).toBeGreaterThan(0);
      const at = await bearCentre(page);
      await page.touchscreen.tap(at.x, at.y);
      await expect(page.locator('.bear-bubble')).toHaveText(COPY[lang].bubble);
      const seen = await page.evaluate(
        () =>
          new Promise<number[]>((done) => {
            const start = performance.now();
            const ys = new Set<number>();
            const tick = () => {
              ys.add(Math.round(scrollY));
              if (performance.now() - start > 1600) done([...ys]);
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
      );
      expect(seen).toEqual([before]);
      await page.touchscreen.tap(at.x, at.y);
      await expect(page.locator('.bear-bubble')).toBeVisible();
      expect(await bubbleCovers(page)).toEqual([]);
    });
  }
});

/**
 * QA178-05: every button icon sits before the text on its first line (it wrapped onto a line of
 * its own at 200% text in Slovak).
 */
async function expectIconsInline(page: Page) {
  const misplaced = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter((b) => b.querySelector(':scope > .button-icon') && b.getClientRects().length)
      .map((b) => {
        const icon = b.querySelector(':scope > .button-icon')!.getBoundingClientRect();
        const texts = Array.from(b.childNodes).filter(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim(),
        );
        const range = document.createRange();
        range.setStart(texts[0], 0);
        range.setEnd(texts[texts.length - 1], texts[texts.length - 1].textContent!.length);
        const line = Array.from(range.getClientRects()).find((r) => r.width > 0)!;
        const middle = icon.top + icon.height / 2;
        const inline = middle >= line.top && middle <= line.bottom && icon.right <= line.left + 1;
        return inline
          ? null
          : `${b.textContent}: icon ${Math.round(icon.left)},${Math.round(icon.top)} first line ${Math.round(line.left)},${Math.round(line.top)}-${Math.round(line.bottom)}`;
      })
      .filter(Boolean),
  );
  expect(misplaced).toEqual([]);
}

for (const device of [DEVICE.smallPhone, DEVICE.phone]) {
  for (const lang of ['en', 'sk'] as const) {
    test(`${device.name} ${device.width}x${device.height} 200% ${lang}: icons stay on the first line of their button`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const c = COPY[lang];
      await signedIn(page);
      await open(page, device, lang);
      await bigText(page);
      await expect(page.locator('.badge-button')).toBeVisible();
      await startMaths(page, lang);
      await type(page, '7');
      await page.locator('.app-bar button').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectIconsInline(page);
      await page.getByRole('dialog').getByRole('button', { name: c.stay, exact: true }).click();
      await finishLesson(page);
      const offer = page.getByRole('dialog', { name: c.offer });
      await expect(offer).toBeVisible({ timeout: 8000 });
      await expectIconsInline(page);
      await page.waitForTimeout(700);
      await offer.getByRole('button', { name: c.unlock, exact: true }).click();
      await expect(offer.getByRole('button', { name: c.yes, exact: true })).toBeVisible();
      await expectIconsInline(page);
      await page.keyboard.press('Escape');
      await expect(offer).toHaveCount(0);
      await expectIconsInline(page);
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: c.board }).click();
      await expect(
        page.getByRole('dialog').getByRole('button', { name: c.tryAgain }),
      ).toBeVisible();
      await expectIconsInline(page);
    });
  }
}

// Reduced motion: the bubble and the happy face, no hop.
test('reduced motion: the tapped bear does not hop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('svg.bear').click();
  await expect(page.locator('.bear-bubble')).toBeVisible();
  await expect(page.locator('svg.bear')).toHaveAttribute('data-tapped', 'true');
  await expect(page.locator('svg.bear')).not.toHaveAttribute('data-tap-hop');
  await expect(page.locator('.bear-hop')).toHaveCSS('animation-name', 'none');
});

test('the tapped bear hops about 8 px and comes back within about 1 s', async ({ page }) => {
  await page.goto('/');
  // The hop's own offset in the bear's drawing units (the menu sway moves the whole bear, so
  // screen positions would mix both).
  const lift = () =>
    page.locator('.bear-hop').evaluate((g) => 0 - new DOMMatrix(getComputedStyle(g).transform).m42);
  expect(await lift()).toBe(0);
  await page.locator('svg.bear').click();
  let highest = 0;
  for (let i = 0; i < 20; i++) {
    highest = Math.max(highest, await lift());
    await page.waitForTimeout(25);
  }
  expect(highest).toBeGreaterThan(4);
  expect(highest).toBeLessThanOrEqual(8.01);
  await page.waitForTimeout(1100);
  expect(await lift()).toBe(0);
});
