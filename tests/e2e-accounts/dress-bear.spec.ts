import { expect, test, type Page } from '@playwright/test';
import { createAccount, uniqueName } from '../e2e/support/account';
import { ALL_DEVICES, DEVICE } from '../e2e/support/devices';
import { horizontalOverflow } from '../e2e/support/layout';

// SCRUM-249: dress your bear from parts (real server + local database).
async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Maths', exact: true })).toBeVisible();
}

const picker = (page: Page) => page.getByRole('group', { name: 'Choose your bear' });
const looksOnOffer = (page: Page) =>
  picker(page)
    .locator('svg')
    .evaluateAll((svgs) => svgs.map((svg) => svg.getAttribute('data-look')));
const barLook = (page: Page) =>
  page.locator('.app-bar .account-button svg').getAttribute('data-look');
const preview = (page: Page) => page.locator('.dress-preview svg');

async function openSignUp(page: Page) {
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeFocused();
}

async function openDress(page: Page, nickname: string) {
  await page.getByRole('button', { name: `Your profile: ${nickname}` }).click();
  await page.getByRole('button', { name: 'Dress your bear' }).click();
  await expect(page.getByRole('heading', { name: 'Dress your bear' })).toBeFocused();
}

/** Every bar item on one row without overlaps (as in the points spec). */
async function barInOneRow(page: Page) {
  return page.evaluate(() => {
    const items = [
      ...document.querySelectorAll('.app-bar > :not(.app-bar-end), .app-bar-end > *'),
    ].map((el) => el.getBoundingClientRect());
    const tops = items.map((r) => r.top);
    const overlap = items.some((a, i) =>
      items.some(
        (b, j) =>
          i < j &&
          a.left < b.right - 0.5 &&
          b.left < a.right - 0.5 &&
          a.top < b.bottom &&
          b.top < a.bottom,
      ),
    );
    return { spread: Math.round(Math.max(...tops) - Math.min(...tops)), overlap };
  });
}

/** Smallest width and height of the choice targets (labels around the radios). */
const smallestTarget = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluateAll((els) =>
      els.reduce(
        (min, el) =>
          Math.min(min, (el as HTMLElement).offsetWidth, (el as HTMLElement).offsetHeight),
        Infinity,
      ),
    );

test('SCRUM-249 sign-up: exactly 4 random looks (new set each time), Customize, saved look shown', async ({
  page,
}) => {
  await openApp(page);
  await openSignUp(page);
  await expect(picker(page).getByRole('radio')).toHaveCount(4);
  await expect(page.getByRole('button', { name: /new ideas/i })).toHaveCount(0);
  const first = await looksOnOffer(page);
  expect(first).toHaveLength(4);
  // Back and open again: a new random set.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  const second = await looksOnOffer(page);
  expect(second).not.toEqual(first);

  await page.getByLabel('Username').fill(uniqueName('dress'));
  await page.getByLabel('Password', { exact: true }).fill('honeyPot42');
  await page.getByLabel('Password again').fill('honeyPot42');
  await page.getByLabel('Nickname').fill('Dress Cub');
  await picker(page).getByRole('radio').nth(3).check();
  await page.getByRole('button', { name: 'Customize' }).click();
  await expect(page.getByRole('heading', { name: 'Dress your bear' })).toBeFocused();
  // The dress screen starts from the chosen look.
  await expect(preview(page)).toHaveAttribute('data-look', second[3]!);
  await page.getByRole('group', { name: 'Fur' }).getByRole('radio', { name: 'Mint' }).check();
  await page
    .getByRole('group', { name: 'Background' })
    .getByRole('radio', { name: 'Coral' })
    .check();
  await page.getByRole('group', { name: 'Head' }).getByRole('radio', { name: 'Flower' }).check();
  await page.getByRole('group', { name: 'Neck' }).getByRole('radio', { name: 'Bow tie' }).check();
  await page
    .getByRole('group', { name: 'Eyes' })
    .getByRole('radio', { name: 'Sunglasses' })
    .check();
  await expect(
    page.getByRole('img', { name: 'Mint bear with a flower, a bow tie and sunglasses' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Customize' })).toBeFocused();
  // The typed form is still there.
  await expect(page.getByLabel('Nickname')).toHaveValue('Dress Cub');
  await expect(picker(page).getByRole('radio').nth(3)).toBeChecked();
  await expect(picker(page).getByRole('radio').nth(3)).toHaveAccessibleName(
    'Mint bear with a flower, a bow tie and sunglasses',
  );
  await page.getByLabel('A parent knows I am creating this account').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Your profile: Dress Cub' })).toBeVisible();
  expect(await barLook(page)).toBe('7.7.5.1.2');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Your profile: Dress Cub' })).toBeVisible();
  expect(await barLook(page)).toBe('7.7.5.1.2');
});

test('SCRUM-249 dress screen by keyboard; Cancel and Back keep the old look, Save keeps the new', async ({
  page,
}) => {
  await openApp(page);
  await createAccount(page, uniqueName('keys'), { nickname: 'Key Cub' });
  const before = await barLook(page);
  await openDress(page, 'Key Cub');
  await expect(preview(page)).toHaveAttribute('data-look', before!);
  // Tab order: Surprise me, then one stop per radio group (the checked choice), Save, Cancel.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Surprise me' })).toBeFocused();
  for (const part of ['Fur', 'Background', 'Head', 'Neck', 'Eyes']) {
    await page.keyboard.press('Tab');
    const focused = page.getByRole('group', { name: part }).getByRole('radio', { checked: true });
    await expect(focused, part).toBeFocused();
  }
  // Arrow keys move inside a group and the preview follows.
  const eyes = page.getByRole('group', { name: 'Eyes' });
  const eyesBefore = await eyes.getByRole('radio', { checked: true }).getAttribute('value');
  await page.keyboard.press('ArrowRight');
  const eyesAfter = await eyes.getByRole('radio', { checked: true }).getAttribute('value');
  expect(eyesAfter).toBe(String((Number(eyesBefore) + 1) % 4));
  await expect(preview(page)).toHaveAttribute('data-look', new RegExp(`\\.${eyesAfter}$`));
  // QA256-01: Enter on a choice does not save and close the screen (no implicit form submit).
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Dress your bear' })).toBeVisible();
  await expect(eyes.getByRole('radio', { checked: true })).toBeFocused();
  expect(await barLook(page)).toBe(before);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Dress your bear' })).toBeFocused();
  expect(await barLook(page)).toBe(before);

  // Back in the bar cancels too and returns to the profile, not to the menu.
  await page.getByRole('button', { name: 'Dress your bear' }).click();
  await page.getByRole('button', { name: 'Surprise me' }).click();
  await expect(preview(page)).not.toHaveAttribute('data-look', before!);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'Dress your bear' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Hi, Key Cub!' })).toBeVisible();
  expect(await barLook(page)).toBe(before);

  // Surprise me + Save by keyboard: the new look is stored.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  const surprised = await preview(page).getAttribute('data-look');
  expect(surprised).not.toBe(before);
  await page.getByRole('button', { name: 'Save', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
  expect(await barLook(page)).toBe(surprised);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Your profile: Key Cub' })).toBeVisible();
  expect(await barLook(page)).toBe(surprised);
});

test('SCRUM-249 dress screen fits every defined device: 48 px choices, no sideways scroll, one-row bar', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page);
  await createAccount(page, uniqueName('fit'), { nickname: 'Twelve chars' });
  for (const device of ALL_DEVICES) {
    await page.setViewportSize({ width: device.width, height: device.height });
    await openApp(page);
    await openDress(page, 'Twelve chars');
    const where = device.name;
    expect(await horizontalOverflow(page), where).toBe(0);
    expect(await smallestTarget(page, '.look-option'), where).toBeGreaterThanOrEqual(48);
    const buttons = page.locator('.dress-screen button');
    for (const box of await buttons.evaluateAll((els) =>
      els.map((el) => [(el as HTMLElement).offsetWidth, (el as HTMLElement).offsetHeight]),
    )) {
      expect(Math.min(...box), where).toBeGreaterThanOrEqual(48);
    }
    // Short landscape phones keep the bar as a left column by design; elsewhere one row.
    const bar = await barInOneRow(page);
    expect(bar.overlap, where).toBe(false);
    if (device.height > 500) expect(bar.spread, where).toBeLessThan(20);
    for (const name of ['Save', 'Cancel']) {
      const button = page.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button, `${where} ${name}`).toBeInViewport();
    }
    await page.getByRole('button', { name: 'Cancel' }).click();
  }
});

test('SCRUM-249 sign-up looks fit every defined device', async ({ page }) => {
  test.setTimeout(120_000);
  for (const device of ALL_DEVICES) {
    await page.setViewportSize({ width: device.width, height: device.height });
    await openApp(page);
    await openSignUp(page);
    const where = device.name;
    expect(await horizontalOverflow(page), where).toBe(0);
    expect(await smallestTarget(page, '.bear-option'), where).toBeGreaterThanOrEqual(48);
    const customize = page.getByRole('button', { name: 'Customize' });
    expect(
      Math.min(...Object.values((await customize.boundingBox())!).slice(2)),
      where,
    ).toBeGreaterThanOrEqual(48);
    await page.getByRole('button', { name: 'Customize' }).click();
    expect(await horizontalOverflow(page), `${where} dress`).toBe(0);
    if (device.height > 500)
      expect((await barInOneRow(page)).spread, `${where} dress bar`).toBeLessThan(20);
    await page.getByRole('button', { name: 'Cancel' }).click();
  }
});

test('SCRUM-249 200% text: dress screen and sign-up stay inside 390x844 and 320x568', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page);
  await createAccount(page, uniqueName('big'), { nickname: 'Big Cub' });
  for (const device of [DEVICE.phone, DEVICE.smallPhone]) {
    await page.setViewportSize({ width: device.width, height: device.height });
    await openApp(page);
    // After the page exists (an init script would be ignored by Chromium).
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await openDress(page, 'Big Cub');
    expect(await horizontalOverflow(page), `${device.name} dress`).toBe(0);
    expect(await smallestTarget(page, '.look-option'), device.name).toBeGreaterThanOrEqual(48);
    expect((await barInOneRow(page)).spread, `${device.name} bar`).toBeLessThan(20);
    for (const name of ['Surprise me', 'Save', 'Cancel']) {
      const button = page.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button, `${device.name} ${name}`).toBeInViewport();
    }
  }
  // Signed out: sign-up at 200%.
  await page.context().clearCookies();
  for (const device of [DEVICE.phone, DEVICE.smallPhone]) {
    await page.setViewportSize({ width: device.width, height: device.height });
    await openApp(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await openSignUp(page);
    expect(await horizontalOverflow(page), `${device.name} sign-up`).toBe(0);
    expect(await smallestTarget(page, '.bear-option'), device.name).toBeGreaterThanOrEqual(48);
    await page.getByRole('button', { name: 'Customize' }).click();
    expect(await horizontalOverflow(page), `${device.name} sign-up dress`).toBe(0);
  }
});
