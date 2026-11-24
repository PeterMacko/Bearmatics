import { expect, test, type Page } from '@playwright/test';
import { ALL_DEVICES, DEVICE } from './support/devices';
import { setLanguage } from './support/language';
import { horizontalOverflow, nextFrames } from './support/layout';

// SCRUM-281: the tidier profile (bear beside the greeting, rows with pencils, small windows,
// grown-up question) on the defined devices, with mocked server answers. Measured signed in with
// a 20-character nickname and a long email (AC 1, 2, 3, 5, 7, 10).

const NICK = 'Medvedíkzuzankamaxi1'; // 20 characters, one word: the hardest to wrap
const EMAIL = 'verylongparentname.surname@example-family-domain.com';
const DEVICES = ALL_DEVICES.filter((d) => d !== DEVICE.phone369 && d !== DEVICE.foldableNarrow);
const SK = {
  nickname: 'Zmeniť prezývku',
  email: 'Zmeniť e-mail',
  leaderboard: 'Zmeniť rebríček',
};

type Calls = { method: string; path: string }[];

async function mock(page: Page, kind: 'password' | 'google' = 'password') {
  const calls: Calls = [];
  let account = {
    kind,
    username: kind === 'password' ? 'kidusername12345678' : null,
    nickname: NICK,
    look: { fur: 1, background: 1, head: 2, neck: 2, eyes: 1 },
    email: kind === 'password' ? EMAIL : null,
    leaderboard: true,
  };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() !== 'GET') calls.push({ method: request.method(), path });
    if (path === '/api/me' && request.method() === 'PATCH') {
      account = { ...account, ...JSON.parse(request.postData() ?? '{}') };
      return json({ account });
    }
    if (path === '/api/me' && request.method() === 'DELETE') return json({ account: null });
    if (path === '/api/auth/signout') return json({ account: null });
    if (path === '/api/me') return json({ account });
    if (path === '/api/progress')
      return json({ points: 1234, streak: 365, frozen: false, today: true });
    return json({ available: false });
  });
  return calls;
}

async function openProfile(page: Page, language: 'en' | 'sk' = 'en') {
  await page.goto('/');
  if (language === 'sk') await setLanguage(page, 'Slovenčina');
  await page.locator('.account-button').click();
  await expect(page.locator('.profile-screen')).toBeVisible();
  await nextFrames(page);
}

/** Profile layout numbers: page/sideways scroll, greeting vs bear, rows, pencils, targets. */
const profileLayout = (page: Page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const textRects = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return [...range.getClientRects()].filter((r) => r.width > 0);
    };
    const bear = document.querySelector('.profile-bear')!.getBoundingClientRect();
    const headingText = [...document.querySelectorAll('.profile-top .menu-heading > *')].flatMap(
      textRects,
    );
    const textRight = Math.max(...headingText.map((r) => r.right));
    const textBottom = Math.max(...headingText.map((r) => r.bottom));
    const overlap = headingText.some(
      (r) =>
        r.right > bear.left + 0.5 &&
        r.left < bear.right - 0.5 &&
        r.bottom > bear.top + 0.5 &&
        r.top < bear.bottom - 0.5,
    );
    const rows = [...document.querySelectorAll<HTMLElement>('.profile-row')];
    const rowOverflow = Math.max(...rows.map((row) => row.scrollWidth - row.clientWidth));
    const pencils = [...document.querySelectorAll<HTMLElement>('.profile-edit')].map((b) => {
      const style = getComputedStyle(b);
      return {
        w: b.offsetWidth,
        h: b.offsetHeight,
        border: style.borderTopWidth,
        background: style.backgroundColor,
      };
    });
    const targets = [...document.querySelectorAll<HTMLElement>('.profile-screen button')].map((b) =>
      Math.min(b.offsetWidth, b.offsetHeight),
    );
    return {
      pageScroll: doc.scrollHeight - doc.clientHeight,
      side: doc.scrollWidth - doc.clientWidth,
      besideGreeting: bear.left >= textRight - 0.5 && bear.top < textBottom,
      overlap,
      rowOverflow,
      pencils,
      smallest: Math.min(...targets),
    };
  });

for (const language of ['en', 'sk'] as const) {
  test(`AC1/2/7/10 ${language}: greeting left, bear right; rows wrap; 48 px borderless pencils on every defined device`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await mock(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openProfile(page, language);
    for (const device of DEVICES) {
      await page.setViewportSize({ width: device.width, height: device.height });
      await nextFrames(page);
      const m = await profileLayout(page);
      const where = `${device.name} ${device.width}x${device.height} ${language}`;
      test.info().annotations.push({
        type: 'fit',
        description: JSON.stringify({ where, ...m, pencils: undefined }),
      });
      expect(m.side, `${where} sideways scroll`).toBeLessThanOrEqual(0);
      expect(m.overlap, `${where} greeting overlaps the bear`).toBe(false);
      expect(m.besideGreeting, `${where} bear beside the greeting`).toBe(true);
      expect(m.rowOverflow, `${where} a row is wider than the page`).toBeLessThanOrEqual(0);
      expect(m.pencils, where).toHaveLength(3);
      for (const pencil of m.pencils) {
        expect(pencil, where).toEqual({
          w: 48,
          h: 48,
          border: '0px',
          background: 'rgba(0, 0, 0, 0)',
        });
      }
      expect(m.smallest, `${where} smallest target`).toBeGreaterThanOrEqual(44);
    }
  });

  for (const device of [DEVICE.phone, DEVICE.smallPhone]) {
    test(`AC1 200% text ${device.width}x${device.height} ${language}: no sideways scroll, no overlap`, async ({
      page,
    }) => {
      await mock(page);
      await page.setViewportSize({ width: device.width, height: device.height });
      await openProfile(page, language);
      await page.addStyleTag({ content: 'html{font-size:200% !important}' });
      await nextFrames(page);
      const m = await profileLayout(page);
      test.info().annotations.push({
        type: 'fit',
        description: JSON.stringify({
          where: `${device.width}x${device.height} 200% ${language}`,
          ...m,
          pencils: undefined,
        }),
      });
      expect(m.side).toBeLessThanOrEqual(0);
      expect(m.overlap).toBe(false);
      expect(m.rowOverflow).toBeLessThanOrEqual(0);
    });
  }
}

test('AC2: Google account: no Email row, no Change password', async ({ page }) => {
  await mock(page, 'google');
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfile(page);
  await expect(page.locator('.profile-row dt')).toHaveText(['Nickname', 'Leaderboard']);
  await expect(page.getByRole('button', { name: 'Change password' })).toHaveCount(0);
  await expect(page.getByText('Signed in with Google')).toBeVisible();
});

const WINDOWS = [
  ['Change nickname', 'Change nickname', 'Save'],
  ['Change email', 'Change email', 'Remove email'],
  ['Change leaderboard', 'Leaderboard', 'Save'],
  ['Change password', 'Change password', 'Save'],
  ['Sign out', 'Sign out', 'Sign out'],
  ['Delete account', 'Delete account', 'Yes, delete forever'],
] as const;

const windowLayout = (page: Page) =>
  page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('.hint-dialog')!;
    const box = dialog.getBoundingClientRect();
    const content = dialog.querySelector<HTMLElement>('.hint-dialog-content')!;
    const style = (selector: string) => {
      const el = dialog.querySelector<HTMLElement>(selector);
      if (!el) return null;
      const s = getComputedStyle(el);
      return `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor} | ${s.backgroundColor} | ${s.color}`;
    };
    return {
      inside:
        box.top >= -0.5 &&
        box.left >= -0.5 &&
        box.bottom <= innerHeight + 0.5 &&
        box.right <= innerWidth + 0.5,
      scrollsInside: content.scrollHeight > content.clientHeight + 1,
      contentSide: content.scrollWidth - content.clientWidth,
      side: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      smallest: Math.min(
        // A checkbox counts by its row's label (44 px, the shared .parent-check look).
        ...[
          ...dialog.querySelectorAll<HTMLElement>(
            'button, input:not([type="checkbox"]), .parent-check label',
          ),
        ].map((b) => Math.min(b.offsetWidth, b.offsetHeight)),
      ),
      primary: style('.profile-window-actions .primary'),
      secondary: style('.profile-window-actions .secondary'),
      danger: style('.profile-window-actions .danger-button'),
    };
  });

const BLUE = 'rgb(53, 109, 166)';
const BLUE_INK = 'rgb(49, 87, 131)';
const ACCENT = 'rgb(182, 62, 69)';
const PAPER = 'rgb(255, 253, 248)';

for (const [width, height, big] of [
  [390, 844, false],
  [320, 568, false],
  [568, 320, false],
  [390, 844, true],
  [320, 568, true],
] as const) {
  test(`AC3/10 windows ${width}x${height}${big ? ' 200%' : ''}: inside the screen, scroll inside, page-look buttons`, async ({
    page,
  }) => {
    await mock(page);
    await page.setViewportSize({ width, height });
    await openProfile(page);
    if (big) await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    for (const [opener, title, last] of WINDOWS) {
      await page.getByRole('button', { name: opener, exact: true }).click();
      const window = page.getByRole('dialog', { name: title });
      await expect(window).toBeVisible();
      await page.mouse.move(1, 1); // no hover colour in the measurement
      await nextFrames(page);
      const m = await windowLayout(page);
      const where = `${opener} ${width}x${height}${big ? ' 200%' : ''}`;
      test
        .info()
        .annotations.push({ type: 'window', description: JSON.stringify({ where, ...m }) });
      expect(m.inside, `${where} inside the screen`).toBe(true);
      expect(m.side, where).toBeLessThanOrEqual(0);
      expect(m.contentSide, where).toBeLessThanOrEqual(0);
      expect(m.smallest, `${where} smallest control`).toBeGreaterThanOrEqual(44);
      // The dialog's own default button look must not win over the page look.
      if (m.primary) expect(m.primary, where).toContain(`| ${BLUE} | ${PAPER}`);
      if (m.secondary) expect(m.secondary, where).toContain(`2px solid ${BLUE_INK} |`);
      if (m.danger) expect(m.danger, where).toContain(`2px solid ${ACCENT} |`);
      // The last button can be scrolled to inside the window.
      const button = window.getByRole('button', { name: last, exact: true });
      await button.scrollIntoViewIfNeeded();
      // (sub-pixel rounding at 200% text: 0.998)
      await expect(button).toBeInViewport({ ratio: 0.99 });
      await page.keyboard.press('Escape');
      await expect(window).toHaveCount(0);
      await expect(page.getByRole('button', { name: opener, exact: true })).toBeFocused();
    }
  });
}

// Peter's review (reverses the approved "background tap does not close"): a tap on the dark
// background outside closes every window like Cancel; a press that starts inside and ends
// outside does not; the second tap of a double tap on the opener does not close it.
const TYPED: Record<string, string> = {
  'Change nickname': 'Typed',
  'Change email': 'typed@example.com',
  'Change password': 'typed-secret',
  'Sign out': '38',
  'Delete account': '38',
};

test('AC3 review: a tap on the dark background closes each window like Cancel; nothing saved', async ({
  page,
}) => {
  await stubRandom(page);
  const calls = await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfile(page);
  for (const [opener, title] of WINDOWS) {
    const button = page.getByRole('button', { name: opener, exact: true });
    await button.click();
    const window = page.getByRole('dialog', { name: title });
    await expect(window).toBeVisible();
    const field = window.locator('input:not([type="checkbox"])').first();
    if (TYPED[opener]) await field.fill(TYPED[opener]);
    else await window.getByRole('checkbox').uncheck();
    await page.waitForTimeout(650); // a deliberate tap, not the second tap of a double tap
    for (const [x, y] of [
      [4, 4],
      [386, 840],
    ] as const) {
      // Both corners lie on the shade, outside the window.
      const box = (await window.boundingBox())!;
      expect(x < box.x || y < box.y || y > box.y + box.height, `${opener} corner`).toBe(true);
    }
    await page.mouse.click(4, 840);
    await expect(window, opener).toHaveCount(0);
    await expect(button, opener).toBeFocused();
    expect(calls, opener).toEqual([]);
    await expect(page.locator('.profile-note'), opener).toBeEmpty();
    // Typed text is discarded: the window opens again with the saved value.
    await page.waitForTimeout(650);
    await button.click();
    if (TYPED[opener]) await expect(field, opener).not.toHaveValue(TYPED[opener]);
    else await expect(window.getByRole('checkbox')).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(window).toHaveCount(0);
  }
  await expect(page.getByRole('heading', { name: `Hi, ${NICK}!` })).toBeVisible();
  await expect(page.locator('.profile-row', { hasText: 'Leaderboard' })).toContainText('Yes');
});

test('AC3 review: a press inside the window released outside (or the other way) does not close', async ({
  page,
}) => {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfile(page);
  await page.getByRole('button', { name: 'Change nickname' }).click();
  const window = page.getByRole('dialog', { name: 'Change nickname' });
  const field = window.getByLabel('Nickname');
  await field.fill('Typed');
  await page.waitForTimeout(650);
  const box = (await field.boundingBox())!;
  // Selecting text in the field and letting go on the shade (QA265-01).
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(4, 840, { steps: 4 });
  await page.mouse.up();
  await expect(window).toBeVisible();
  // A press that starts on the shade and is released inside.
  await page.mouse.move(4, 840);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(window).toBeVisible();
  await expect(field).toHaveValue('Typed');
});

for (const [width, height] of [
  [390, 844],
  [320, 568],
] as const) {
  test(`AC3 review ${width}x${height}: the second tap of a double tap on a pencil or button presses nothing`, async ({
    page,
  }) => {
    await stubRandom(page);
    const calls = await mock(page);
    await page.setViewportSize({ width, height });
    await openProfile(page);
    for (const [opener, title] of WINDOWS) {
      const button = page.getByRole('button', { name: opener, exact: true });
      // A real double tap on the opener: the second tap lands on the shade or on the window's
      // X / Cancel / Keep my account / a field, whatever lies there.
      await button.scrollIntoViewIfNeeded();
      const box = (await button.boundingBox())!;
      await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
      const window = page.getByRole('dialog', { name: title });
      await page.waitForTimeout(150);
      await expect(window, opener).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(window).toHaveCount(0);
      // The second tap surely on the shade, within the first 600 ms (done inside the page).
      const quick = await page.evaluate(
        async ([name, y]) => {
          const frame = () => new Promise((done) => requestAnimationFrame(done));
          const opener = [
            ...document.querySelectorAll<HTMLButtonElement>('.profile-screen button'),
          ].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name)!;
          const opened = performance.now();
          opener.click();
          await frame();
          const shade = document.querySelector<HTMLElement>('.modal-backdrop')!;
          const at = { bubbles: true, cancelable: true, clientX: 4, clientY: y };
          shade.dispatchEvent(new PointerEvent('pointerdown', at));
          shade.dispatchEvent(new MouseEvent('mousedown', { ...at, detail: 2 }));
          shade.dispatchEvent(new PointerEvent('pointerup', at));
          shade.dispatchEvent(new MouseEvent('mouseup', { ...at, detail: 2 }));
          shade.dispatchEvent(new MouseEvent('click', { ...at, detail: 2 }));
          return performance.now() - opened;
        },
        [opener, height - 4] as const,
      );
      expect(quick, opener).toBeLessThan(600);
      await page.waitForTimeout(100);
      await expect(window, opener).toBeVisible();
      // Later, a deliberate tap there closes.
      await page.waitForTimeout(650);
      await page.mouse.click(4, height - 4);
      await expect(window, opener).toHaveCount(0);
      await expect(button, opener).toBeFocused();
      await page.waitForTimeout(650);
    }
    expect(calls).toEqual([]);
  });
}

// Peter's review: a tap on the profile bear shows it full screen.
const BEAR_BIG = { en: 'Show my bear big', sk: 'Ukáž môjho medveďa naveľko' } as const;
const LOOK = 'Dark brown bear with a hat, a tie and glasses';

/** Full-screen bear numbers: bear box, page scroll, the X and its overlap with the bear. */
const bigBearLayout = (page: Page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const layer = document.querySelector<HTMLElement>('.bear-full')!;
    const bear = layer.querySelector('svg.bear-icon')!.getBoundingClientRect();
    const x = layer.querySelector('.bear-full-close')!.getBoundingClientRect();
    const box = layer.getBoundingClientRect();
    const w = doc.clientWidth,
      h = doc.clientHeight;
    const overlapW = Math.max(0, Math.min(bear.right, x.right) - Math.max(bear.left, x.left));
    const overlapH = Math.max(0, Math.min(bear.bottom, x.bottom) - Math.max(bear.top, x.top));
    // The face: the middle of the picture (head circle, viewBox 12..52 of 64).
    const face = {
      left: bear.left + (bear.width * 12) / 64,
      right: bear.left + (bear.width * 52) / 64,
      top: bear.top + (bear.height * 12) / 64,
      bottom: bear.top + (bear.height * 56) / 64,
    };
    const onFace =
      x.right > face.left && x.left < face.right && x.bottom > face.top && x.top < face.bottom;
    return {
      bear: Math.round(bear.width * 10) / 10,
      square: Math.abs(bear.width - bear.height) < 0.5,
      inside:
        bear.left >= -0.5 && bear.top >= -0.5 && bear.right <= w + 0.5 && bear.bottom <= h + 0.5,
      margin: Math.round(Math.min(bear.left, bear.top, w - bear.right, h - bear.bottom)),
      covers: box.left <= 0.5 && box.top <= 0.5 && box.right >= w - 0.5 && box.bottom >= h - 0.5,
      layerScroll: layer.scrollHeight - layer.clientHeight,
      pageScroll: doc.scrollHeight - doc.clientHeight,
      side: doc.scrollWidth - doc.clientWidth,
      x: { left: Math.round(x.left), top: Math.round(x.top), w: x.width, h: x.height },
      xInside: x.left >= 0 && x.top >= 0 && x.right <= w + 0.5 && x.bottom <= h + 0.5,
      xOverBear: Math.round(overlapW * overlapH),
      xOnFace: onFace,
      fill: Math.round((bear.width / Math.min(w, h)) * 100),
    };
  });

for (const [device, big] of [
  ...DEVICES.map((d) => [d, false] as const),
  [DEVICE.phone, true] as const,
  [DEVICE.smallPhone, true] as const,
]) {
  test(`review: full-screen bear fits ${device.name} ${device.width}x${device.height}${big ? ' 200%' : ''}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // measure without the zoom-in
    await mock(page);
    await page.setViewportSize({ width: device.width, height: device.height });
    await openProfile(page);
    if (big) await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await nextFrames(page);
    const before = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    await page.getByRole('button', { name: BEAR_BIG.en }).click();
    await expect(page.getByRole('dialog', { name: LOOK })).toBeVisible();
    await nextFrames(page);
    const m = await bigBearLayout(page);
    const where = `${device.name} ${device.width}x${device.height}${big ? ' 200%' : ''}`;
    test
      .info()
      .annotations.push({ type: 'bear', description: JSON.stringify({ where, before, ...m }) });
    expect(m.covers, `${where} covers the screen`).toBe(true);
    expect(m.inside, `${where} bear inside`).toBe(true);
    expect(m.square, where).toBe(true);
    expect(m.margin, `${where} margin`).toBeGreaterThanOrEqual(7);
    // As large as fits: the shorter side minus the margins (the X keeps room on near-square
    // screens).
    expect(m.bear, `${where} bear size`).toBeGreaterThanOrEqual(
      Math.min(device.width, device.height, Math.max(device.width, device.height) - 112) - 16.5,
    );
    expect(m.layerScroll, where).toBeLessThanOrEqual(0);
    expect(m.side, where).toBeLessThanOrEqual(0);
    expect(m.pageScroll, `${where} no added page scroll`).toBeLessThanOrEqual(before);
    expect(m.x.w, where).toBe(48);
    expect(m.x.h, where).toBe(48);
    expect(m.xInside, where).toBe(true);
    expect(m.xOverBear, `${where} X over the bear`).toBe(0);
    expect(m.xOnFace, where).toBe(false);
  });
}

test('review: the bear button: 72 px, focus ring; tap, X, Escape and Enter open/close; focus back; Tab stays', async ({
  page,
}) => {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfile(page);
  const bear = page.getByRole('button', { name: BEAR_BIG.en });
  await expect(bear).toHaveAccessibleDescription(LOOK);
  const size = await bear.evaluate((b) => [
    (b as HTMLElement).offsetWidth,
    (b as HTMLElement).offsetHeight,
  ]);
  expect(Math.min(...size)).toBeGreaterThanOrEqual(48);
  // The Dress your bear link is a separate button below it.
  const dress = page.getByRole('button', { name: 'Dress your bear' });
  expect((await dress.boundingBox())!.y).toBeGreaterThanOrEqual(
    (await bear.boundingBox())!.y + (await bear.boundingBox())!.height - 0.5,
  );
  // Keyboard: Tab from the heading reaches the bear; visible focus ring; Enter opens.
  await page.keyboard.press('Tab');
  await expect(bear).toBeFocused();
  expect(
    await bear.evaluate((b) => {
      const s = getComputedStyle(b);
      return `${s.outlineStyle} ${s.outlineWidth}`;
    }),
  ).toBe('solid 3px');
  await page.keyboard.press('Enter');
  const view = page.getByRole('dialog', { name: LOOK });
  await expect(view).toBeVisible();
  await expect(view.getByRole('img', { name: LOOK })).toHaveAttribute('data-look', '1.1.2.2.1');
  const close = view.getByRole('button', { name: 'Close' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(view).toHaveCount(0);
  await expect(bear).toBeFocused();
  // Enter on the X closes at once (keyboard, no 600 ms wait).
  await page.keyboard.press('Enter');
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(view).toHaveCount(0);
  await expect(bear).toBeFocused();
  // Tap anywhere: the corner, the bear itself, the X.
  for (const where of ['corner', 'bear', 'X'] as const) {
    await page.waitForTimeout(650);
    await bear.click();
    await expect(view).toBeVisible();
    await page.waitForTimeout(650);
    if (where === 'corner') await page.mouse.click(4, 840);
    if (where === 'bear') await view.getByRole('img').click();
    if (where === 'X') await close.click();
    await expect(view, where).toHaveCount(0);
    await expect(bear, where).toBeFocused();
  }
});

test('review: a double tap on the bear keeps it open; a double tap on the X presses nothing below', async ({
  page,
}) => {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfile(page);
  const bear = page.getByRole('button', { name: BEAR_BIG.en });
  await bear.dblclick();
  const view = page.getByRole('dialog', { name: LOOK });
  await expect(view).toBeVisible();
  await page.waitForTimeout(100);
  await expect(view).toBeVisible();
  // The second tap surely on the layer within 600 ms (inside the page).
  await page.keyboard.press('Escape');
  const quick = await page.evaluate(async () => {
    const frame = () => new Promise((done) => requestAnimationFrame(done));
    const opened = performance.now();
    document.querySelector<HTMLButtonElement>('.profile-bear-button')!.click();
    await frame();
    const layer = document.querySelector<HTMLElement>('.bear-full')!;
    const at = { bubbles: true, cancelable: true, clientX: 195, clientY: 422 };
    layer.dispatchEvent(new PointerEvent('pointerdown', at));
    layer.dispatchEvent(new MouseEvent('mousedown', { ...at, detail: 2 }));
    layer.dispatchEvent(new PointerEvent('pointerup', at));
    layer.dispatchEvent(new MouseEvent('click', { ...at, detail: 2 }));
    return performance.now() - opened;
  });
  expect(quick).toBeLessThan(600);
  await page.waitForTimeout(100);
  await expect(view).toBeVisible();
  // A double tap on the X: closes; the second tap does not press what lies under the X.
  await page.waitForTimeout(650);
  const x = (await view.getByRole('button', { name: 'Close' }).boundingBox())!;
  const under = await page.evaluate(
    ([cx, cy]) => {
      const layer = document.querySelector<HTMLElement>('.bear-full')!;
      layer.style.visibility = 'hidden';
      const below = document.elementFromPoint(cx, cy)?.closest('button, a')?.outerHTML ?? null;
      layer.style.visibility = '';
      const w = window as unknown as { pressed: string[] };
      w.pressed = [];
      document.addEventListener('click', (e) => {
        const b = (e.target as Element).closest('button, a');
        if (b) w.pressed.push(b.textContent ?? '');
      });
      return below;
    },
    [x.x + x.width / 2, x.y + x.height / 2],
  );
  expect(under, 'a button under the X').not.toBeNull();
  await page.mouse.dblclick(x.x + x.width / 2, x.y + x.height / 2);
  await expect(view).toHaveCount(0);
  await expect(bear).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.profile-screen')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { pressed: string[] }).pressed)).toEqual(
    [],
  );
});

test('review: full-screen bear in Slovak; short zoom-in, none with reduced motion', async ({
  page,
}) => {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfile(page, 'sk');
  const bear = page.getByRole('button', { name: BEAR_BIG.sk, exact: true });
  await bear.click();
  const view = page.getByRole('dialog');
  await expect(view.getByRole('button', { name: 'Zavrieť' })).toBeFocused();
  expect(await view.evaluate((el) => getComputedStyle(el).animationName)).toBe('bear-full-in');
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await bear.click();
  expect(await view.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('AC3/4/7 keyboard only: pencil, type, Enter saves, focus back on the pencil, "Saved."', async ({
  page,
}) => {
  const calls = await mock(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await openProfile(page);
  await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
  await page.keyboard.press('Tab'); // the bear (full screen, Peter's review)
  await expect(page.getByRole('button', { name: 'Show my bear big' })).toBeFocused();
  await page.keyboard.press('Tab'); // Dress your bear
  await expect(page.getByRole('button', { name: 'Dress your bear' })).toBeFocused();
  await page.keyboard.press('Tab');
  const pencil = page.getByRole('button', { name: 'Change nickname' });
  await expect(pencil).toBeFocused();
  // Visible focus ring on the borderless pencil.
  const ring = await pencil.evaluate((b) => {
    const s = getComputedStyle(b);
    return `${s.outlineStyle} ${s.outlineWidth}`;
  });
  expect(ring).toBe('solid 3px');
  await page.keyboard.press('Enter');
  const field = page.getByRole('dialog').getByLabel('Nickname');
  await expect(field).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Honey Star');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await expect(pencil).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Hi, Honey Star!' })).toBeVisible();
  await expect(page.locator('.account-button')).toHaveAccessibleName('Your profile: Honey Star');
  expect(calls).toEqual([{ method: 'PATCH', path: '/api/me' }]);
  // Tab cycles inside the window: X, the content box, the field, Save, Cancel, back to X.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(pencil).toBeFocused();
});

/** Math.random always 0: every grown-up question is 3³ + 11 = 38. */
const stubRandom = (page: Page) =>
  page.addInitScript(() => {
    Math.random = () => 0;
  });

for (const [language, names] of [
  [
    'en',
    {
      signOut: 'Sign out',
      del: 'Delete account',
      yes: 'Yes, delete forever',
      keep: 'Keep my account',
      said: '3 to the power of 3 plus 11',
      ask: 'Ask a grown-up to answer.',
      wrong: 'That is not right. Here is a new question.',
      empty: 'Type the answer first.',
      done: 'You are signed out.',
      deleted: 'Your account was deleted.',
    },
  ],
  [
    'sk',
    {
      signOut: 'Odhlásiť sa',
      del: 'Zmazať účet',
      yes: 'Áno, zmazať navždy',
      keep: 'Ponechať účet',
      said: '3 na tretiu plus 11',
      ask: 'Popros dospelého o odpoveď.',
      wrong: 'To nie je správne. Tu je nová otázka.',
      empty: 'Najprv napíš odpoveď.',
      done: 'Si odhlásený.',
      deleted: 'Tvoj účet je zmazaný.',
    },
  ],
] as const) {
  test(`AC5/6/7 ${language}: Sign out and Delete only after the right answer (stubbed random)`, async ({
    page,
  }) => {
    await stubRandom(page);
    const calls = await mock(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openProfile(page, language);
    const window = page.getByRole('dialog');
    // Delete: Keep first; Keep returns without change.
    await page.getByRole('button', { name: names.del }).click();
    await expect(window.getByRole('button', { name: names.keep })).toBeFocused();
    await expect(window).toContainText(names.ask);
    await expect(window.locator('.grown-up-question')).toHaveText('3³ + 11 = ?');
    const field = window.getByRole('textbox', { name: names.said });
    await expect(field).toHaveAttribute('inputmode', 'numeric');
    await window.getByRole('button', { name: names.keep }).click();
    await expect(window).toHaveCount(0);
    await expect(page.getByRole('button', { name: names.del })).toBeFocused();
    // Sign out: empty, wrong, then right.
    await page.getByRole('button', { name: names.signOut }).click();
    await expect(field).toBeFocused();
    await page.waitForTimeout(650);
    const go = window.getByRole('button', { name: names.signOut, exact: true });
    await go.click();
    await expect(window.getByRole('alert')).toHaveText(names.empty);
    await field.fill('37');
    await go.click();
    await expect(window.getByRole('alert')).toHaveText(names.wrong);
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();
    expect(calls).toEqual([]);
    await field.fill('38');
    await field.press('Enter');
    await expect(page.getByText(names.done)).toBeVisible();
    expect(calls).toEqual([{ method: 'POST', path: '/api/auth/signout' }]);
  });
}

test('AC5: a double tap on Delete account, or a quick tap after it opens, never deletes', async ({
  page,
}) => {
  await stubRandom(page);
  const calls = await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfile(page);
  // Double tap on Delete account: the window opens; nothing is deleted.
  await page.getByRole('button', { name: 'Delete account' }).dblclick();
  const window = page.getByRole('dialog', { name: 'Delete account' });
  await expect(window).toBeVisible();
  await window.getByRole('textbox').fill('38');
  // The second press of a double tap on "Yes, delete forever" (detail 2) is ignored.
  await page.waitForTimeout(650);
  const yes = window.getByRole('button', { name: 'Yes, delete forever' });
  const box = (await yes.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ clickCount: 2 });
  await page.mouse.up({ clickCount: 2 });
  await page.waitForTimeout(200);
  expect(calls).toEqual([]);
  await expect(window).toBeVisible();
  // Closed and opened again: a tap right after opening (with the right answer typed) is
  // ignored too. Done inside the page so it surely lands within the first 600 ms.
  await page.keyboard.press('Escape');
  await expect(window).toHaveCount(0);
  const quick = await page.evaluate(async () => {
    const frame = () => new Promise((done) => requestAnimationFrame(done));
    const opened = performance.now();
    document.querySelector<HTMLButtonElement>('.profile-buttons .danger-button')!.click();
    await frame();
    const field = document.querySelector<HTMLInputElement>('.grown-up-field input')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setValue.call(field, '38');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await frame();
    const yes = document.querySelector<HTMLButtonElement>('.profile-window .danger-button')!;
    yes.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    return performance.now() - opened;
  });
  expect(quick).toBeLessThan(600);
  await page.waitForTimeout(200);
  expect(calls).toEqual([]);
  await expect(window).toBeVisible();
  await expect(window.locator('.account-error')).toBeEmpty();
  // A deliberate tap later deletes.
  await page.waitForTimeout(650);
  await window.getByRole('button', { name: 'Yes, delete forever' }).click();
  await expect(page.getByText('Your account was deleted.')).toBeVisible();
  expect(calls).toEqual([{ method: 'DELETE', path: '/api/me' }]);
});

test('on-screen keyboard: the window stays in the visible part and its buttons can be reached', async ({
  page,
}) => {
  // iPhone/iPad: the keyboard covers the page; only visualViewport shrinks.
  await page.addInitScript(() => {
    const real = window.visualViewport!;
    const fake = new EventTarget() as EventTarget & Record<string, number>;
    let height: number | null = null;
    for (const key of ['width', 'offsetLeft', 'offsetTop', 'pageLeft', 'pageTop', 'scale'])
      Object.defineProperty(fake, key, {
        get: () => (real as unknown as Record<string, number>)[key],
      });
    Object.defineProperty(fake, 'height', { get: () => height ?? real.height });
    Object.defineProperty(window, 'visualViewport', { get: () => fake });
    (window as unknown as { setKeyboard: (h: number | null) => void }).setKeyboard = (h) => {
      height = h;
      fake.dispatchEvent(new Event('resize'));
    };
  });
  await mock(page);
  for (const [width, height, share] of [
    [390, 844, 0.5],
    [844, 390, 0.42],
    [820, 1180, 0.62],
    [884, 1004, 0.56],
  ] as const) {
    await page.setViewportSize({ width, height });
    await openProfile(page);
    for (const opener of ['Change password', 'Sign out'] as const) {
      await page.getByRole('button', { name: opener }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const visible = Math.round(height * share);
      await page.evaluate(
        (h) => (window as unknown as { setKeyboard: (h: number | null) => void }).setKeyboard(h),
        visible,
      );
      await nextFrames(page);
      const where = `iPhone mode ${width}x${height} ${opener}`;
      const box = (await dialog.boundingBox())!;
      expect(box.y, where).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, where).toBeLessThanOrEqual(visible + 0.5);
      const last = dialog.locator('.profile-window-actions button').last();
      await last.scrollIntoViewIfNeeded();
      const lastBox = (await last.boundingBox())!;
      expect(lastBox.y + lastBox.height, where).toBeLessThanOrEqual(visible + 0.5);
      await page.evaluate(() =>
        (window as unknown as { setKeyboard: (h: number | null) => void }).setKeyboard(null),
      );
      // Android: the page itself shrinks.
      await page.setViewportSize({ width, height: visible });
      await nextFrames(page);
      const android = (await dialog.boundingBox())!;
      expect(android.y + android.height, `Android ${where}`).toBeLessThanOrEqual(visible + 0.5);
      await last.scrollIntoViewIfNeeded();
      await expect(last, `Android ${where}`).toBeInViewport({ ratio: 1 });
      await page.setViewportSize({ width, height });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  }
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test('AC7 Slovak pencil names and Áno/Nie', async ({ page }) => {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfile(page, 'sk');
  for (const name of Object.values(SK))
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(page.locator('.profile-row', { hasText: 'Rebríček' })).toContainText('Áno');
  for (const icon of await page.locator('.profile-screen svg.button-icon').all())
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
});
