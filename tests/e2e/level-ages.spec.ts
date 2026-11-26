import { expect, test } from '@playwright/test';
import { DEVICE, type Device } from './support/devices';
import { checkMenus } from './support/levelAges';

// SCRUM-308: every level row of the five level menus shows its suggested age as a small badge
// ("5–7", aria-hidden) with the screen-reader text "Ages 5 to 7" / "Vek 5 až 7 rokov". The badge
// sits out of flow in the row's corner: it must not overlap the row's text, number tile, sign or
// selection dot, and the menu must look exactly as it does without it (same line counts, row
// heights, menu mode, page and sideways scroll). Signed in (multiplier signs) is covered by
// tests/e2e-accounts/level-ages.spec.ts with the same check.

/** The defined devices, plus 200% text at 390x844 and 320x568. */
const POINTS: [Device, number][] = [
  [DEVICE.phone, 1],
  [DEVICE.phone360, 1],
  [DEVICE.smallPhone, 1],
  [DEVICE.phoneLandscape, 1],
  [DEVICE.smallPhoneLandscape, 1],
  [DEVICE.tablet, 1],
  [DEVICE.tabletLandscape, 1],
  [DEVICE.foldable, 1],
  [DEVICE.foldableBrowserBar, 1],
  [DEVICE.foldableVivaldi, 1],
  [DEVICE.desktop, 1],
  [DEVICE.wideShort, 1],
  [DEVICE.wideShortSmall, 1],
  [DEVICE.phone, 2],
  [DEVICE.smallPhone, 2],
];

for (const [device, zoom] of POINTS)
  test(`age badges fit every level menu at ${device.name} ${device.width}x${device.height}${zoom === 2 ? ' 200% text' : ''} (EN/SK)`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: device.width, height: device.height });
    for (const lang of ['en', 'sk']) {
      await page.goto(`/?lang=${lang}`);
      await page.locator('.course-option').first().waitFor();
      if (zoom === 2) await page.addStyleTag({ content: 'html{font-size:200% !important}' });
      if (process.env.AGES_NEGATIVE_CSS)
        await page.addStyleTag({ content: process.env.AGES_NEGATIVE_CSS });
      await checkMenus(page, `${lang} ${device.width}x${device.height}@${zoom}`);
    }
  });

test('screen readers hear the age after the level name (EN/SK), exact names', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=en');
  await page.locator('.course-option.course-math').click();
  await expect(page.getByRole('radio', { name: /^Level 4 / })).toHaveAccessibleName(
    'Level 4 · Find the missing number Add & subtract up to 20: missing first or second number Ages 7 to 9',
  );
  await page.locator('.back-button').click();
  await page.locator('.course-option.course-english').click();
  await expect(page.getByRole('radio', { name: /^Level 2 / })).toHaveAccessibleName(
    'Level 2 · Listen and choose: similar-sounding words Ages 5 to 9',
  );
  // The badge itself is not read and does not take taps: tapping it chooses its level.
  const badge = page.locator('.level-option.level-3 .level-age');
  await expect(badge).toHaveText('8–9');
  const box = (await badge.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('radio', { name: /^Level 3 / })).toBeChecked();
  await page.goto('/?lang=sk');
  await page.locator('.course-option.course-small').click();
  await expect(page.getByRole('radio', { name: /^Úroveň 1 / })).toHaveAccessibleName(
    /^Úroveň 1 · Počítame obrázky .+ Vek 5 až 6 rokov$/,
  );
});
