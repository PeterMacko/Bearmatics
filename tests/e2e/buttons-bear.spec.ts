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

async function startMaths(page: Page, lang: Lang) {
  await page.getByRole('button', { name: COPY[lang].maths, exact: true }).click();
  await page.locator('.session-options input').first().check();
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
          bear: 2,
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
      await expectButton(page.getByRole('button', { name: c.again, exact: true }), 'replay', false);
      await expectButton(page.getByRole('button', { name: c.back, exact: true }), 'list', true);
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
      await expectButton(page.getByRole('button', { name: c.back, exact: true }), 'list', true);
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
      await nextFrames(page);
      expect(await pageScroll(page)).toEqual({ x: 0, y: 0 });
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
  const top = () => page.locator('.bear-hop').evaluate((g) => g.getBoundingClientRect().top);
  const rest = await top();
  await page.locator('svg.bear').click();
  let highest = rest;
  for (let i = 0; i < 20; i++) {
    highest = Math.min(highest, await top());
    await page.waitForTimeout(25);
  }
  // 8 px in the bear's own units, scaled with the drawing.
  const scale = await page
    .locator('svg.bear')
    .evaluate((svg) => svg.getBoundingClientRect().width / 260);
  expect(rest - highest).toBeGreaterThan(4 * scale);
  expect(rest - highest).toBeLessThanOrEqual(8 * scale + 1);
  await page.waitForTimeout(1100);
  expect(Math.abs((await top()) - rest)).toBeLessThan(0.5);
});
