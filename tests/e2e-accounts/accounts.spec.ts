import { expect, test, type Page } from '@playwright/test';
import {
  answerGrownUp,
  createAccount,
  leaveProfile,
  PASSWORD,
  uniqueName,
  WINDOW_SETTLE_MS,
} from '../e2e/support/account';
import { ACCOUNT_DEVICES as DEVICES } from '../e2e/support/devices';
import { setLanguage } from '../e2e/support/language';
import { horizontalOverflow } from '../e2e/support/layout';

// SCRUM-97: optional sign-in with username and password (real server + local database).
async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Maths', exact: true })).toBeVisible();
}

async function signIn(page: Page, username: string, password = PASSWORD) {
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
}

test.describe('signed out', () => {
  test('course choice keeps its layout and offers Sign in at every device', async ({ browser }) => {
    for (const device of DEVICES) {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        hasTouch: device.touch,
      });
      const page = await context.newPage();
      await openApp(page);
      const button = page.getByRole('button', { name: 'Sign in' });
      await expect(button, device.name).toBeVisible();
      const box = (await button.boundingBox())!;
      expect(box.width, device.name).toBeGreaterThanOrEqual(44);
      expect(box.height, device.name).toBeGreaterThanOrEqual(44);
      // Same contained menu as before: no page scroll, button does not cover heading text.
      const layout = await page.evaluate(() => {
        const btn = document.querySelector('.account-button')!.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(document.querySelector('.course-choice h2')!);
        const covers = [...range.getClientRects()].some(
          (r) =>
            r.left < btn.right &&
            btn.left < r.right &&
            r.top + 4 < btn.bottom &&
            btn.top < r.bottom,
        );
        return { scroll: document.documentElement.scrollHeight - innerHeight, covers };
      });
      expect(layout, device.name).toEqual({ scroll: 0, covers: false });
      await context.close();
    }
  });

  test('account screens fit the width of every device and keep the submit button reachable', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    for (const device of DEVICES) {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        hasTouch: device.touch,
      });
      const page = await context.newPage();
      await openApp(page);
      await page.getByRole('button', { name: 'Sign in' }).click();
      for (const [open, submit] of [
        [null, 'Sign in'],
        ['Create account', 'Create account'],
      ] as const) {
        if (open) await page.getByRole('button', { name: open }).click();
        const overflow = await horizontalOverflow(page);
        expect(overflow, `${device.name} ${submit}`).toBe(0);
        const action = page.locator('.account-submit');
        await action.scrollIntoViewIfNeeded();
        await expect(action, `${device.name} ${submit}`).toBeInViewport();
      }
      await context.close();
    }
  });
});

test('create an account, stay signed in, edit the profile, sign out and in, delete', async ({
  page,
}) => {
  const username = uniqueName('Cub');
  const sent: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) sent.push(`${request.url()} ${request.postData() ?? ''}`);
  });
  await openApp(page);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  // Form checks in order, before anything is sent.
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Username: 3–20 letters or digits, no spaces.');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Password: at least 8 characters.');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Password again').fill(`${PASSWORD}x`);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('The two passwords are not the same.');
  await page.getByLabel('Password again').fill(PASSWORD);
  await page.getByLabel('Nickname').fill('Brave Cub');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Please tick that a parent knows.');
  expect(sent.filter((line) => line.includes('/api/auth/signup'))).toHaveLength(0);
  await expect(page.getByText('A forgotten password cannot be reset yet.')).toBeVisible();
  // SCRUM-249: one of 4 random looks; the app bar shows the chosen one.
  const chosen = page.locator('.bear-option').nth(1);
  await chosen.locator('input').check();
  const look = await chosen.locator('svg').getAttribute('data-look');
  await page.getByLabel('A parent knows I am creating this account').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  const profileButton = page.getByRole('button', { name: 'Your profile: Brave Cub' });
  await expect(profileButton).toBeVisible();
  await expect(profileButton.locator(`svg[data-look="${look}"]`)).toBeVisible();

  // The plain password never leaves the browser.
  const signup = sent.find((line) => line.includes('/api/auth/signup'))!;
  expect(signup).not.toContain(PASSWORD);
  expect(signup).toMatch(/"key":"[0-9a-f]{64}"/);
  for (const line of sent) expect(line.split(' ')[0]).not.toContain(username);

  // Still signed in after a reload.
  await page.reload();
  await expect(profileButton).toBeVisible();

  // Profile: dress the bear, nickname, email add and remove.
  await profileButton.click();
  await expect(page.getByRole('heading', { name: 'Hi, Brave Cub!' })).toBeFocused();
  await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
  await page.getByRole('button', { name: 'Dress your bear' }).click();
  await page.getByRole('group', { name: 'Fur' }).getByRole('radio', { name: 'Honey' }).check();
  await page.getByRole('group', { name: 'Head' }).getByRole('radio', { name: 'Crown' }).check();
  await page.getByRole('group', { name: 'Neck' }).getByRole('radio', { name: 'None' }).check();
  await page
    .getByRole('group', { name: 'Eyes' })
    .getByRole('radio', { name: 'Glasses', exact: true })
    .check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Honey bear with a crown and glasses' }),
  ).toBeVisible();
  await expect(profileButton.locator('svg[data-look^="2."][data-look$=".3.0.1"]')).toBeVisible();
  // SCRUM-281: every change in its own window.
  await page.getByRole('button', { name: 'Change nickname' }).click();
  const window = page.getByRole('dialog');
  await expect(window.getByLabel('Nickname')).toBeFocused();
  await window.getByLabel('Nickname').fill('Honey Star');
  await window.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(window).toHaveCount(0);
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hi, Honey Star!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Your profile: Honey Star' })).toBeVisible();
  await page.getByRole('button', { name: 'Change email' }).click();
  await window.getByLabel('Email (optional)').fill('parent@example.com');
  await window.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(window).toHaveCount(0);
  await expect(page.locator('.profile-row', { hasText: 'Email' })).toContainText(
    'parent@example.com',
  );
  await page.getByRole('button', { name: 'Change email' }).click();
  await window.getByRole('button', { name: 'Remove email' }).click();
  await expect(page.getByText('Email removed.')).toBeVisible();
  await expect(page.locator('.profile-row', { hasText: 'Email' })).toContainText('No email saved.');
  await page.getByRole('button', { name: 'Change email' }).click();
  await expect(window.getByLabel('Email (optional)')).toHaveValue('');
  await page.keyboard.press('Escape');

  // Change password: wrong current one first.
  await page.getByRole('button', { name: 'Change password' }).click();
  await window.getByLabel('Current password').fill('notMyPassword');
  await window.getByLabel('New password', { exact: true }).fill('newHoney42');
  await window.getByLabel('New password again').fill('newHoney42');
  await window.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(window.getByText('The current password is not right.')).toBeVisible();
  await window.getByLabel('Current password').fill(PASSWORD);
  await window.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(window).toHaveCount(0);
  await expect(page.getByText('Password changed. Other devices are signed out.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change password' })).toBeFocused();

  // Sign out (grown-up question), wrong password, sign in with the new one (username case ignored).
  await leaveProfile(page, 'sign-out');
  await expect(page.getByText('You are signed out.')).toBeVisible();
  await signIn(page, username.toUpperCase(), PASSWORD);
  await expect(page.getByRole('alert')).toHaveText('Wrong username or password.');
  await signIn(page, username.toLowerCase(), 'newHoney42');
  await expect(page.getByRole('button', { name: 'Your profile: Honey Star' })).toBeVisible();

  // Delete: a window with the grown-up question, Keep first.
  await page.getByRole('button', { name: 'Your profile: Honey Star' }).click();
  await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page.getByRole('button', { name: 'Keep my account' })).toBeFocused();
  await page.getByRole('button', { name: 'Keep my account' }).click();
  await expect(page.getByRole('button', { name: 'Delete account' })).toBeFocused();
  // A wrong answer deletes nothing and asks a new question.
  await page.getByRole('button', { name: 'Delete account' }).click();
  await answerGrownUp(page, 1);
  await page.waitForTimeout(WINDOW_SETTLE_MS);
  await window.getByRole('button', { name: 'Yes, delete forever' }).click();
  await expect(window.getByRole('alert')).toHaveText('That is not right. Here is a new question.');
  await answerGrownUp(page);
  await window.getByRole('button', { name: 'Yes, delete forever' }).click();
  await expect(page.getByText('Your account was deleted.')).toBeVisible();
  await signIn(page, username, 'newHoney42');
  await expect(page.getByRole('alert')).toHaveText('Wrong username or password.');
});

test('an account without email, and a username that is already taken', async ({ page }) => {
  const username = uniqueName('Pip');
  await openApp(page);
  await createAccount(page, username);
  await page.getByRole('button', { name: 'Your profile: Brave Cub' }).click();
  await expect(page.getByText('No email saved.', { exact: false })).toBeVisible();
  await leaveProfile(page, 'sign-out');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Username').fill(username.toUpperCase());
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Password again').fill(PASSWORD);
  await page.getByLabel('Nickname').fill('Other');
  await page.getByLabel('A parent knows I am creating this account').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('This username is taken. Try another one.');
});

test('too many wrong passwords lock the username for a while', async ({ page }) => {
  const username = uniqueName('Lock');
  await openApp(page);
  await createAccount(page, username);
  await page.getByRole('button', { name: 'Your profile: Brave Cub' }).click();
  await leaveProfile(page, 'sign-out');
  for (let i = 0; i < 4; i++) {
    await signIn(page, username, `wrong${i}pass`);
    await expect(page.getByRole('alert')).toHaveText('Wrong username or password.');
    await page.getByLabel('Username').fill('');
  }
  await signIn(page, username, 'wrong5pass');
  await expect(page.getByRole('alert')).toHaveText(
    'Too many tries. Wait 15 minutes, then try again.',
  );
  await signIn(page, username, PASSWORD);
  await expect(page.getByRole('alert')).toHaveText(
    'Too many tries. Wait 15 minutes, then try again.',
  );
});

test('Slovak texts and keyboard-only sign-up', async ({ page }) => {
  const username = uniqueName('Kb');
  await openApp(page);
  await setLanguage(page, 'Slovenčina', { gear: 'name' });
  const signInButton = page.getByRole('button', { name: 'Prihlásiť sa' });
  await signInButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Prihlásenie' })).toBeFocused();
  await expect(page.getByText('Prihlásenie je dobrovoľné.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Vytvoriť účet' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Nový účet' })).toBeFocused();
  // The app bar (Back, profile, settings) comes before the heading; after it the form fields
  // in visual order (SCRUM-133).
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Nastavenia' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Prihlásiť sa' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Späť' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Používateľské meno')).toBeFocused();
  await page.keyboard.type(username);
  await page.keyboard.press('Tab');
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press('Tab');
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Medvedík');
  await page.keyboard.press('Tab');
  // SCRUM-249: 4 random looks with Slovak names, then Customize (Upraviť).
  await page.keyboard.press('ArrowRight');
  const second = page.getByRole('group', { name: 'Vyber si medvedíka' }).getByRole('radio').nth(1);
  await expect(second).toBeChecked();
  await expect(second).toBeFocused();
  await expect(second).toHaveAccessibleName(/^(\S+ medvedík|Panda)( so? .+)?$/);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Upraviť' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Rodič vie, že si zakladám účet')).toBeChecked();
  await expect(page.getByText('Použi prezývku, nie svoje skutočné meno')).toBeVisible();
  await page.getByLabel('Používateľské meno').press('Enter');
  await expect(page.getByRole('button', { name: 'Tvoj profil: Medvedík' })).toBeVisible();
});

test('the privacy page explains what is stored and how to delete it', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'What we store' }).click();
  await expect(page.getByRole('heading', { name: 'What we store' })).toBeFocused();
  await expect(page.getByText('never the password itself', { exact: false })).toBeVisible();
  await expect(page.getByText('Profile → Delete account', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'mr.petermacko@gmail.com' })).toHaveAttribute(
    'href',
    'mailto:mr.petermacko@gmail.com',
  );
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeFocused();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'Maths', exact: true })).toBeVisible();
});

test('200% text on phones: account screens stay inside the screen (QA114-02)', async ({
  browser,
}) => {
  for (const device of DEVICES.filter((d) => d.width <= 390)) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      hasTouch: true,
    });
    const page = await context.newPage();
    await openApp(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.getByRole('button', { name: 'Sign in' }).click();
    const overflow = () => horizontalOverflow(page);
    expect(await overflow(), `${device.name} sign in`).toBe(0);
    await page.getByRole('button', { name: 'Create account' }).click();
    expect(await overflow(), `${device.name} create account`).toBe(0);
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'What we store' }).click();
    expect(await overflow(), `${device.name} privacy`).toBe(0);
    await context.close();
  }
});

test('profile at 200% text on a phone stays inside the screen', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await openApp(page);
  await createAccount(page, uniqueName('Big'), { email: 'parent@example.com' });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.getByRole('button', { name: 'Your profile: Brave Cub' }).click();
  expect(await horizontalOverflow(page)).toBe(0);
  // SCRUM-281: the Delete window (warning + grown-up question) fits too.
  await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);
  await context.close();
});

test('the address bar cannot put a message on the sign-in screen (QA114-04)', async ({ page }) => {
  await page.goto('/?account=Your%20password%20expired%2C%20enter%20it%20at%20evil.example');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('evil.example', { exact: false })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/?account=google-failed');
  await expect(page.getByText('Google sign-in did not work. Try again.')).toBeVisible();
});

test('the parent checkbox has a large enough tap target (QA114-05)', async ({ browser }) => {
  // Loops over every device: ~30 s in Firefox under the full suite already on main.
  test.setTimeout(120_000);
  for (const device of DEVICES) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      hasTouch: device.touch,
    });
    const page = await context.newPage();
    await openApp(page);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: 'Create account' }).click();
    const label = page.locator('.parent-check label');
    const box = (await label.boundingBox())!;
    expect(box.height, device.name).toBeGreaterThanOrEqual(44);
    await label.click({ position: { x: 4, y: box.height - 4 } });
    await expect(page.getByLabel('A parent knows I am creating this account')).toBeChecked();
    await context.close();
  }
});

test('Google: first sign-in asks for nickname, bear and parent; later sign-ins go straight in', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Almost done!' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.getByLabel('Nickname').fill('Maculko');
  // SCRUM-249: 4 random looks; dress the third one and keep it.
  const picker = page.getByRole('group', { name: 'Choose your bear' });
  await expect(picker.getByRole('radio')).toHaveCount(4);
  await picker.getByRole('radio').nth(2).check();
  await page.getByRole('button', { name: 'Customize' }).click();
  await page.getByRole('group', { name: 'Fur' }).getByRole('radio', { name: 'Panda' }).check();
  await page.getByRole('group', { name: 'Head' }).getByRole('radio', { name: 'Cap' }).check();
  await page.getByRole('group', { name: 'Neck' }).getByRole('radio', { name: 'Medal' }).check();
  await page.getByRole('group', { name: 'Eyes' }).getByRole('radio', { name: 'None' }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(picker.getByRole('radio').nth(2)).toHaveAccessibleName(
    'Panda with a cap and a medal',
  );
  await expect(picker.getByRole('radio').nth(2)).toBeChecked();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toHaveText('Please tick that a parent knows.');
  await page.getByLabel('A parent knows I am creating this account').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  const profile = page.getByRole('button', { name: 'Your profile: Maculko' });
  await expect(profile).toBeVisible();
  await page.reload();
  await expect(profile).toBeVisible();
  await expect(profile.locator('svg[data-look^="4."][data-look$=".1.5.0"]')).toBeVisible();
  await profile.click();
  await expect(page.getByText('Signed in with Google')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Panda with a cap and a medal' })).toBeVisible();
  // SCRUM-281: no Email row and no Change password for Google accounts.
  await expect(page.getByRole('button', { name: 'Change email' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Change password' })).toHaveCount(0);
  await expect(page.locator('.profile-row')).toHaveCount(2);
  await leaveProfile(page, 'sign-out');
  await page.getByRole('link', { name: 'Continue with Google' }).click();
  await expect(profile).toBeVisible();
  await profile.click();
  await leaveProfile(page, 'delete');
  await expect(page.getByText('Your account was deleted.')).toBeVisible();
  // After deleting, Google asks for nickname and bear again (a new account).
  await page.getByRole('link', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Almost done!' })).toBeVisible();
});
