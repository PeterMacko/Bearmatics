import { expect, test, type Page } from '@playwright/test';
import { createAccount, uniqueName } from '../e2e/support/account';
import { answerFor } from '../e2e/support/maths';

// SCRUM-202: daily points multipliers against the real server (local database). Play counts
// live on the device (localStorage), per account and Slovak day.

test.setTimeout(120_000);

const badge = (page: Page) =>
  page.getByRole('navigation', { name: /Main controls|Hlavné ovládanie/ }).getByRole('button', {
    name: /badge|odznak/,
  });
/**
 * Keeps this spec's players (up to 26 points each) off the leaderboard: every accounts spec shares
 * one local database, and the leaderboard spec expects its own 5-point player in the top ten.
 */
async function hideFromLeaderboard(page: Page) {
  const status = await page.evaluate(
    async () =>
      (
        await fetch('/api/me', {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ leaderboard: false }),
        })
      ).status,
  );
  expect(status).toBe(200);
}
const level = (page: Page, n: number) => page.locator(`.level-option.level-${n}`);
const radio = (page: Page, n: number) => level(page, n).getByRole('radio');

/** Plays a 5-exercise Maths lesson of level `n` to the summary, every answer right first try. */
async function playLevel(page: Page, n: number) {
  await level(page, n).click();
  await page.locator('.session-options label').first().click();
  await page.locator('.start-button').click();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('textbox').fill(String(await answerFor(page)));
    await page.locator('.answer-button').click(); // Check
    await page.locator('.answer-button').click(); // Next / See how you did
  }
  await expect(page.locator('.summary')).toBeVisible();
}

/** From the summary back to the Maths level menu. */
async function backToLevels(page: Page) {
  await page.locator('.summary .secondary').click();
  await expect(page.locator('.level-options')).toBeVisible();
}

test('English: 1/2 after two plays, the calculation on the summary, the top-level star', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await createAccount(page, uniqueName('mul'));
  await hideFromLeaderboard(page);
  await page.getByRole('button', { name: 'Maths', exact: true }).click();
  // First plays: no sign except the top level's star.
  await expect(level(page, 1).locator('.next-play')).toHaveCount(0);
  await expect(level(page, 7).locator('.next-play')).toHaveText('★');
  await expect(radio(page, 7)).toHaveAccessibleName(
    /Level 7 .*Next play: one and a half times the points$/,
  );
  await playLevel(page, 1);
  await expect(page.locator('.points-added')).toHaveText('+5 points');
  await backToLevels(page);
  await expect(level(page, 1).locator('.next-play')).toHaveCount(0);
  await playLevel(page, 1);
  await expect(page.locator('.points-added')).toHaveText('+5 points');
  await backToLevels(page);
  // Two plays saved: the third gives half points.
  await expect(level(page, 1).locator('.next-play')).toHaveText('1/2');
  await expect(level(page, 1).locator('.next-play')).toBeVisible();
  await expect(radio(page, 1)).toHaveAccessibleName(/^Level 1 .*Next play: half points$/);
  await playLevel(page, 1);
  await expect(page.locator('.points-added')).toHaveText('Half points: 5 × 1/2 = 3 points');
  await expect(page.getByText('5 × 1/2 = 3 points')).toBeVisible();
  await expect(badge(page)).toHaveAccessibleName('No bear badge yet, 13 points');
  await backToLevels(page);
  // Top level: x1.5 for the first play, then the star is gone (x1, never lower).
  await playLevel(page, 7);
  await expect(page.locator('.points-added')).toHaveText(
    'One and a half times the points: 5 × 1.5 = 8 points',
  );
  await expect(badge(page)).toHaveAccessibleName('No bear badge yet, 21 points');
  await backToLevels(page);
  await expect(level(page, 7).locator('.next-play')).toHaveCount(0);
  await expect(radio(page, 7)).not.toHaveAccessibleName(/Next play/);
  await playLevel(page, 7);
  await expect(page.locator('.points-added')).toHaveText('+5 points');
  // The counts stay on this device after a reload (same account, same day).
  await page.reload();
  await page.getByRole('button', { name: 'Maths', exact: true }).click();
  await expect(level(page, 1).locator('.next-play')).toHaveText('1/2');
  await expect(level(page, 7).locator('.next-play')).toHaveCount(0);
});

test('Slovak: star, calculation with a decimal comma, then 1/2 after two plays', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await createAccount(page, uniqueName('mul'));
  await hideFromLeaderboard(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Slovenčina' }).click();
  await page.getByRole('button', { name: 'Zavrieť nastavenia' }).click();
  await page.getByRole('button', { name: 'Matematika', exact: true }).click();
  await expect(level(page, 7).locator('.next-play')).toHaveText('★');
  await expect(radio(page, 7)).toHaveAccessibleName(
    /^Úroveň 7 .*Ďalšia hra: jeden a pol násobok bodov$/,
  );
  await playLevel(page, 7);
  await expect(page.locator('.points-added')).toHaveText(
    'Jeden a pol násobok bodov: 5 × 1,5 = 8 bodov',
  );
  await backToLevels(page);
  await expect(level(page, 7).locator('.next-play')).toHaveCount(0);
  await playLevel(page, 2);
  await backToLevels(page);
  await playLevel(page, 2);
  await expect(page.locator('.points-added')).toHaveText('+5 bodov');
  await backToLevels(page);
  await expect(level(page, 2).locator('.next-play')).toHaveText('1/2');
  await expect(radio(page, 2)).toHaveAccessibleName(/^Úroveň 2 .*Ďalšia hra: polovica bodov$/);
  await playLevel(page, 2);
  await expect(page.locator('.points-added')).toHaveText('Polovica bodov: 5 × 1/2 = 3 body');
  await expect(badge(page)).toHaveAccessibleName('Zatiaľ bez medvedieho odznaku, 21 bodov');
});

test('another account on the same device keeps its own counts', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await createAccount(page, uniqueName('mul'));
  await hideFromLeaderboard(page);
  await page.getByRole('button', { name: 'Maths', exact: true }).click();
  await playLevel(page, 1);
  await backToLevels(page);
  await playLevel(page, 1);
  await backToLevels(page);
  await expect(level(page, 1).locator('.next-play')).toHaveText('1/2');
  // Sign out and create a second account: its first plays are full points again.
  await page.getByRole('button', { name: /^Your profile/ }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByText('You are signed out.')).toBeVisible();
  await page.goto('/');
  await createAccount(page, uniqueName('mul'), { nickname: 'Little Cub' });
  await hideFromLeaderboard(page);
  await page.getByRole('button', { name: 'Maths', exact: true }).click();
  await expect(level(page, 1).locator('.next-play')).toHaveCount(0);
  await expect(level(page, 7).locator('.next-play')).toHaveText('★');
});

test('the summary calculation needs no page scroll on phones (EN and SK)', async ({ page }) => {
  const username = uniqueName('mul');
  await page.goto('/');
  await createAccount(page, username);
  await hideFromLeaderboard(page);
  const sizes = [
    [390, 844],
    [360, 640],
    [320, 568],
    [844, 390],
  ] as const;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    // Two plays of level 1 saved today on this device: the next one gives half points.
    await page.evaluate((user) => {
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Bratislava',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      localStorage.setItem(
        'bearmatics-plays',
        JSON.stringify({ [`password:${user}`]: { day, counts: { 'math:1': 2 } } }),
      );
    }, username);
    await page.goto('/');
    await page.getByRole('button', { name: 'Maths', exact: true }).click();
    await playLevel(page, 1);
    await expect(page.locator('.points-multiplied')).toHaveText(/5 × 1\/2 = 3 points$/);
    await expect(page.locator('.summary-points .badge-meter')).toBeVisible();
    const fit = () =>
      page.evaluate(() => ({
        down: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        side: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
    expect(await fit(), `EN ${width}x${height}`).toEqual({ down: 0, side: 0 });
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Slovenčina' }).click();
    await page.getByRole('button', { name: 'Zavrieť nastavenia' }).click();
    await expect(page.locator('.points-multiplied')).toHaveText(/5 × 1\/2 = 3 body$/);
    expect(await fit(), `SK ${width}x${height}`).toEqual({ down: 0, side: 0 });
    await page.getByRole('button', { name: 'Nastavenia' }).click();
    await page.getByRole('button', { name: 'English' }).click();
    await page.getByRole('button', { name: 'Close settings' }).click();
  }
});

test('at 200% text the sign leaves the level number readable (phones, 3 courses, EN and SK)', async ({
  page,
}) => {
  // QA204-02: the badge keeps its px size while text grows; the sign must not cover the digit.
  const username = uniqueName('mul');
  await page.goto('/');
  await createAccount(page, username);
  await hideFromLeaderboard(page);
  // Plays saved today on this device: 1/2 and 1/4 signs in every course, star on the top level.
  await page.evaluate((user) => {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Bratislava',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const counts = {
      'small:1': 2,
      'small:2': 4,
      'math:1': 2,
      'math:2': 4,
      'english:1': 4,
      'english:2': 2,
    };
    localStorage.setItem(
      'bearmatics-plays',
      JSON.stringify({ [`password:${user}`]: { day, counts } }),
    );
  }, username);
  await page.reload();
  await page.addStyleTag({ content: 'html{font-size:200% !important}' });
  const courses = [
    ['Small maths', 'Malá matematika', 3],
    ['Maths', 'Matematika', 7],
    ['English', 'Angličtina', 3],
  ] as const;
  for (const language of ['EN', 'SK'] as const) {
    if (language === 'SK') {
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.getByRole('button', { name: 'Slovenčina' }).click();
      await page.getByRole('button', { name: 'Zavrieť nastavenia' }).click();
    }
    for (const [width, height] of [
      [390, 844],
      [320, 568],
    ] as const) {
      await page.setViewportSize({ width, height });
      for (const [en, sk, top] of courses) {
        const where = `${language} ${width}x${height} ${en}`;
        await page.getByRole('button', { name: language === 'EN' ? en : sk, exact: true }).click();
        await expect(page.locator('.level-options')).toBeVisible();
        await expect(page.locator('.next-play')).toHaveCount(3);
        await expect(level(page, top).locator('.next-play')).toHaveText('★');
        const measure = () =>
          page.evaluate(() => {
            const area = (r: { width: number; height: number }) =>
              Math.max(0, r.width) * Math.max(0, r.height);
            const cut = (a: DOMRect, b: DOMRect) =>
              area({
                width: Math.min(a.right, b.right) - Math.max(a.left, b.left),
                height: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
              });
            const signs = [...document.querySelectorAll<HTMLElement>('.next-play')].map((sign) => {
              const badge = sign.parentElement!;
              const range = document.createRange();
              range.selectNodeContents(badge.firstChild!); // the digit's text node
              const digit = range.getBoundingClientRect();
              const box = sign.getBoundingClientRect();
              const option = badge.closest('.level-option')!.getBoundingClientRect();
              const title = document.createRange();
              title.selectNodeContents(
                badge.closest('.level-option')!.querySelector('.level-title')!,
              );
              const onTitle = [...title.getClientRects()].some((r) => cut(r, box) > 0);
              return {
                covered: cut(digit, box) / area(digit),
                inside:
                  box.left >= option.left - 0.5 &&
                  box.right <= option.right + 0.5 &&
                  box.top >= option.top - 0.5 &&
                  box.bottom <= option.bottom + 0.5,
                onTitle,
              };
            });
            const root = document.documentElement;
            const list = document.querySelector('.level-options')!;
            return {
              signs,
              page: root.scrollHeight - root.clientHeight,
              side: root.scrollWidth - root.clientWidth,
              list: list.scrollHeight - list.clientHeight,
            };
          });
        const shown = await measure();
        for (const sign of shown.signs) {
          expect(sign.covered, `${where}: share of the digit under the sign`).toBeLessThanOrEqual(
            0.2,
          );
          expect(sign.inside, `${where}: sign inside its option`).toBe(true);
          expect(sign.onTitle, `${where}: sign over the title`).toBe(false);
        }
        // The signs are decoration out of flow: page and level-list scroll as without them.
        await page.evaluate(() => {
          const off = document.createElement('style');
          off.id = 'no-signs';
          off.textContent = '.next-play{display:none !important}';
          document.head.append(off);
        });
        const hidden = await measure();
        await page.evaluate(() => document.getElementById('no-signs')!.remove());
        expect({ page: shown.page, side: shown.side, list: shown.list }, where).toEqual({
          page: hidden.page,
          side: 0,
          list: hidden.list,
        });
        await page
          .getByRole('navigation', { name: /Main controls|Hlavné ovládanie/ })
          .getByRole('button', { name: /^(Back to courses|Späť na kurzy)$/ })
          .click();
        await expect(
          page.getByRole('button', { name: language === 'EN' ? en : sk, exact: true }),
        ).toBeVisible();
      }
    }
  }
});
