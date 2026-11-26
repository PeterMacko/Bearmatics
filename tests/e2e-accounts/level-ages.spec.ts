import { expect, test } from '@playwright/test';
import { createAccount, uniqueName } from '../e2e/support/account';
import { checkMenus } from '../e2e/support/levelAges';

// SCRUM-308 signed in: the age badge next to the multiplier signs (1/2, 1/4, star) on every
// level menu at the narrowest and the enlarged-text phones, EN/SK. Same check as the signed-out
// spec (tests/e2e/level-ages.spec.ts): no overlap, and the menu is unchanged without the badges.

test.setTimeout(240_000);

test('signed in: age badges and multiplier signs side by side on every level menu', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=en');
  await createAccount(page, uniqueName('ages'));
  const user = await page.evaluate(
    async () => (await (await fetch('/api/me')).json()).account.username as string,
  );
  // Today's plays on this device: 1/2 and 1/4 on Small maths, Maths and English 1-2.
  await page.evaluate((username) => {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Bratislava',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const counts = { 'small:1': 2, 'small:2': 4, 'math:1': 2, 'math:2': 4 };
    localStorage.setItem(
      'bearmatics-plays',
      JSON.stringify({
        [`password:${username}`]: { day, counts: { ...counts, 'english:1': 2, 'english:2': 4 } },
      }),
    );
  }, user);
  for (const [width, height, zoom] of [
    [320, 568, 1],
    [390, 844, 1],
    [1366, 900, 1],
    [320, 568, 2],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const lang of ['en', 'sk']) {
      await page.goto(`/?lang=${lang}`);
      await page.locator('.course-option').first().waitFor();
      if (zoom === 2) await page.addStyleTag({ content: 'html{font-size:200% !important}' });
      await page.locator('.course-option.course-math').click();
      await expect(page.locator('.level-option .next-play')).toHaveText([
        '1/2',
        '1/4',
        '★',
        '★',
        '★',
        '★',
      ]);
      await page.locator('.back-button').click();
      await checkMenus(page, `signed in ${lang} ${width}x${height}@${zoom}`);
    }
  }
});
