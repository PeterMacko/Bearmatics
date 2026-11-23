import { expect, test, type Page } from '@playwright/test';
import { createAccount, uniqueName } from '../e2e/support/account';
import { ALL_DEVICES, DEVICE, type Device } from '../e2e/support/devices';
import { horizontalOverflow, nextFrames } from '../e2e/support/layout';

// SCRUM-273: the tidier "Dress your bear" screen. Heading, the big bear and Save | Cancel stay in
// view at every defined device while only the choices pane scrolls; very large text falls back
// to one scrolling page. Same layout on the profile and on the sign-up Customize screen.

const NICKNAME = 'Twelve chars';

async function openApp(page: Page, sk = false) {
  // SCRUM-218: the app starts in Slovak from /?lang=sk (it starts in English otherwise).
  await page.goto(sk ? '/?lang=sk' : '/');
  await expect(page.locator('.settings-button')).toBeVisible();
}

async function hideFromLeaderboard(page: Page) {
  await page.evaluate(() =>
    fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leaderboard: false }),
    }),
  );
}

/** Profile > Dress your bear (EN or SK names). */
async function openProfileDress(page: Page, sk = false) {
  await page.locator('.app-bar .account-button').click();
  await page.getByRole('button', { name: sk ? 'Oblč medveďa' : 'Dress your bear' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: sk ? 'Oblč medveďa' : 'Dress your bear' }),
  ).toBeFocused();
  await settled(page);
}

/** Signed out: Sign in > Create account > Customize. */
async function openSignUpDress(page: Page) {
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Customize' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Dress your bear' })).toBeFocused();
  await settled(page);
}

/** The layout hook measures on the next frame after a resize or font change. */
async function settled(page: Page) {
  await nextFrames(page);
  await nextFrames(page);
}

/** Everything AC 3 asks for, measured in one go. */
const fit = (page: Page) =>
  page.evaluate(() => {
    const root = document.documentElement;
    const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const screen = document.querySelector<HTMLElement>('.dress-screen')!;
    const pane = document.querySelector<HTMLElement>('.dress-choices')!;
    const parts = {
      heading: box('.dress-screen h2'),
      eyebrow: box('.dress-screen .eyebrow'),
      bear: box('.dress-preview .bear-icon'),
      surprise: box('.dress-preview button'),
      save: box('.dress-actions button[type=submit]'),
      cancel: box('.dress-actions button[type=button]'),
      pane: pane.getBoundingClientRect(),
    };
    const barItems = [
      ...document.querySelectorAll('.app-bar > :not(.app-bar-end), .app-bar-end > *'),
    ].map((el) => el.getBoundingClientRect());
    const overlaps = (a: DOMRect, b: DOMRect) =>
      a.left < b.right - 0.5 &&
      b.left < a.right - 0.5 &&
      a.top < b.bottom - 0.5 &&
      b.top < a.bottom - 0.5;
    const under = Object.entries(parts)
      .filter(([, rect]) => barItems.some((item) => overlaps(item, rect)))
      .map(([name]) => name);
    const outside = Object.entries(parts)
      .filter(
        ([, r]) =>
          r.top < -0.5 ||
          r.left < -0.5 ||
          r.bottom > root.clientHeight + 0.5 ||
          r.right > root.clientWidth + 0.5,
      )
      .map(([name]) => name);
    const targets = [
      ...document.querySelectorAll<HTMLElement>('.dress-screen button, .look-option'),
    ];
    return {
      mode: screen.dataset.dressMode,
      pageScroll: root.scrollHeight - root.clientHeight,
      paneHeight: Math.round(pane.clientHeight),
      paneScrolls: pane.scrollHeight > pane.clientHeight + 1,
      saveBottom: Math.round(parts.save.bottom),
      viewport: root.clientHeight,
      smallest: Math.min(...targets.map((t) => Math.min(t.offsetWidth, t.offsetHeight))),
      saveCancelOneRow:
        Math.abs(parts.save.top - parts.cancel.top) < 1 && parts.save.right <= parts.cancel.left,
      under,
      outside,
    };
  });

async function expectContained(page: Page, where: string) {
  const result = await fit(page);
  expect(result.mode, where).toBe('contained');
  // AC 3 / AC 10: Save (and everything fixed) visible without page scrolling.
  expect(result.pageScroll, `${where} page scroll`).toBeLessThanOrEqual(0);
  expect(await horizontalOverflow(page), `${where} sideways`).toBe(0);
  expect(result.outside, `${where} outside the window`).toEqual([]);
  expect(result.under, `${where} under the app bar`).toEqual([]);
  expect(result.saveBottom, `${where} Save bottom`).toBeLessThanOrEqual(result.viewport);
  expect(result.saveCancelOneRow, `${where} Save | Cancel one row`).toBe(true);
  expect(result.smallest, `${where} targets`).toBeGreaterThanOrEqual(48);
  // Only the pane scrolls: its own scroll range, never the page's.
  expect(result.paneHeight, `${where} pane`).toBeGreaterThan(100);
  return result;
}

const SMALL = (d: Device) => d.width <= 620 || d.height <= 500;

test('SCRUM-273 profile dress screen (EN and SK): heading, bear and Save | Cancel in view on every defined device; only the choices scroll', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page);
  await createAccount(page, uniqueName('fit273'), { nickname: NICKNAME });
  await hideFromLeaderboard(page);
  for (const [sk, device] of [false, true].flatMap((sk) =>
    ALL_DEVICES.map((d) => [sk, d] as const),
  )) {
    await page.setViewportSize({ width: device.width, height: device.height });
    await openApp(page, sk);
    await openProfileDress(page, sk);
    const where = `${sk ? 'SK' : 'EN'} ${device.name} ${device.width}x${device.height}`;
    const result = await expectContained(page, where);
    // Phones and the smaller windows have more choices than room: the pane really scrolls.
    if (device.height <= 700) expect(result.paneScrolls, where).toBe(true);
    // Scrolling the pane to its end moves no fixed part and never the page.
    const before = await page.locator('.dress-actions').boundingBox();
    await page.locator('.dress-choices').evaluate((pane) => (pane.scrollTop = pane.scrollHeight));
    await page.mouse.wheel(0, 400);
    await settled(page);
    expect(await page.evaluate(() => scrollY), `${where} page scrolled`).toBe(0);
    expect(await page.locator('.dress-actions').boundingBox(), where).toEqual(before);
    await page.getByRole('button', { name: sk ? 'Zrušiť' : 'Cancel', exact: true }).click();
  }
});

test('SCRUM-273 sign-up Customize: same layout, in view on every defined device', async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const device of ALL_DEVICES) {
    await page.setViewportSize({ width: device.width, height: device.height });
    await openApp(page);
    await openSignUpDress(page);
    await expectContained(page, `sign-up ${device.name} ${device.width}x${device.height}`);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Customize' })).toBeFocused();
  }
});

test('SCRUM-273 heading: one line without intro on small devices (EN and SK, 320 px too); larger screens unchanged', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page);
  await createAccount(page, uniqueName('head273'), { nickname: NICKNAME });
  await hideFromLeaderboard(page);
  for (const sk of [false, true]) {
    for (const device of ALL_DEVICES) {
      await page.setViewportSize({ width: device.width, height: device.height });
      await openApp(page, sk);
      await openProfileDress(page, sk);
      const where = `${sk ? 'SK' : 'EN'} ${device.name}`;
      const heading = await page.evaluate(() => {
        const box = (s: string) =>
          document.querySelector(`.dress-screen ${s}`)!.getBoundingClientRect();
        const eyebrow = box('.eyebrow');
        const title = box('h2');
        const intro = document.querySelector<HTMLElement>('.dress-screen .intro')!;
        return {
          eyebrow: document.querySelector('.dress-screen .eyebrow')!.textContent,
          titleSize: parseFloat(
            getComputedStyle(document.querySelector('.dress-screen h2')!).fontSize,
          ),
          rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
          // One line: the eyebrow sits beside the title, its middle inside the title's line.
          oneLine:
            eyebrow.right <= title.left &&
            (eyebrow.top + eyebrow.bottom) / 2 > title.top &&
            (eyebrow.top + eyebrow.bottom) / 2 < title.bottom,
          titleLines: Math.round(
            title.height /
              parseFloat(getComputedStyle(document.querySelector('.dress-screen h2')!).lineHeight),
          ),
          below: eyebrow.bottom <= title.top + 1,
          introShown: intro.offsetHeight > 0,
        };
      });
      expect(heading.eyebrow, where).toBe(sk ? 'Tvoj účet' : 'Your account');
      if (SMALL(device)) {
        expect(heading.introShown, `${where} intro`).toBe(false);
        expect(heading.oneLine, `${where} one line`).toBe(true);
        expect(heading.titleLines, `${where} title lines`).toBe(1);
        expect(heading.titleSize, `${where} title size`).toBeGreaterThanOrEqual(
          1.25 * heading.rem - 0.01,
        );
      } else {
        expect(heading.introShown, `${where} intro`).toBe(true);
        expect(heading.below, `${where} eyebrow above title`).toBe(true);
      }
      await page.getByRole('button', { name: sk ? 'Zrušiť' : 'Cancel', exact: true }).click();
    }
  }
});

test('SCRUM-273 200% text at 390x844 and 320x568: one scrolling page, every choice and both buttons reachable, nothing clipped', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page);
  await createAccount(page, uniqueName('big273'), { nickname: NICKNAME });
  await hideFromLeaderboard(page);
  for (const screenName of ['profile', 'sign-up'] as const) {
    // Signed in for the profile, then signed out for the sign-up Customize screen.
    if (screenName === 'sign-up') await page.context().clearCookies();
    for (const device of [DEVICE.phone, DEVICE.smallPhone]) {
      await page.setViewportSize({ width: device.width, height: device.height });
      await openApp(page);
      // After the page exists (an init script would be ignored by Chromium).
      await page.addStyleTag({ content: 'html{font-size:200% !important}' });
      if (screenName === 'profile') await openProfileDress(page);
      else await openSignUpDress(page);
      const where = `${screenName} ${device.name} 200%`;
      expect(await page.locator('.dress-screen').getAttribute('data-dress-mode'), where).toBe(
        'flow',
      );
      expect(await horizontalOverflow(page), where).toBe(0);
      // The choices are not cut off inside a pane: the page scrolls instead.
      expect(
        await page
          .locator('.dress-choices')
          .evaluate((pane) => pane.scrollHeight - pane.clientHeight),
        where,
      ).toBeLessThanOrEqual(1);
      const choices = page.locator('.look-option');
      await expect(choices).toHaveCount(32);
      for (let i = 0; i < 32; i++) {
        await choices.nth(i).scrollIntoViewIfNeeded();
        await expect(choices.nth(i), `${where} choice ${i}`).toBeInViewport({ ratio: 1 });
      }
      for (const name of ['Surprise me', 'Save', 'Cancel']) {
        const button = page.getByRole('button', { name, exact: true });
        await button.scrollIntoViewIfNeeded();
        await expect(button, `${where} ${name}`).toBeInViewport({ ratio: 1 });
      }
    }
  }
});

test('SCRUM-273 keyboard: a focused choice scrolls into view inside the pane, never under Save | Cancel', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page);
  await createAccount(page, uniqueName('keys273'), { nickname: NICKNAME });
  await hideFromLeaderboard(page);
  for (const device of [DEVICE.smallPhone, DEVICE.smallPhoneLandscape, DEVICE.foldableVivaldi]) {
    await page.setViewportSize({ width: device.width, height: device.height });
    await openApp(page);
    await openProfileDress(page);
    // Order: heading (focused) > Surprise me > one stop per part > Save > Cancel.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Surprise me' })).toBeFocused();
    const inPane = () =>
      page.evaluate(() => {
        const focused = document.activeElement!.closest('.look-option')!.getBoundingClientRect();
        const pane = document.querySelector('.dress-choices')!.getBoundingClientRect();
        const bar = document.querySelector('.dress-actions')!.getBoundingClientRect();
        return (
          focused.top >= pane.top - 0.5 &&
          focused.bottom <= pane.bottom + 0.5 &&
          focused.bottom <= bar.top &&
          scrollY === 0
        );
      });
    for (const part of ['Fur', 'Background', 'Head', 'Neck', 'Eyes']) {
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('group', { name: part }).getByRole('radio', { checked: true }),
        `${device.name} ${part}`,
      ).toBeFocused();
      expect(await inPane(), `${device.name} ${part} in pane`).toBe(true);
      // Walk the whole group with the arrow keys: every choice comes into view.
      const count = await page.getByRole('group', { name: part }).getByRole('radio').count();
      for (let i = 0; i < count; i++) {
        await page.keyboard.press('ArrowRight');
        expect(await inPane(), `${device.name} ${part} arrow ${i}`).toBe(true);
      }
    }
    // Enter on a choice does not save.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Dress your bear' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Dress your bear' })).toBeFocused();
  }
});
