import { expect, test, type Page } from '@playwright/test';
import {
  createAccount,
  hideFromLeaderboard,
  leaveProfile,
  uniqueName,
} from '../e2e/support/account';
import { badge as barBadge } from '../e2e/support/bar';
import { answerFor } from '../e2e/support/maths';

// SCRUM-202: daily points multipliers against the real server (local database). Play counts
// live on the device (localStorage), per account and Slovak day.

test.setTimeout(120_000);

const badge = (page: Page) => barBadge(page, { anyLanguage: true });
// hideFromLeaderboard keeps this spec's players (up to 26 points each) off the leaderboard.
const level = (page: Page, n: number) => page.locator(`.level-option.level-${n}`);
const radio = (page: Page, n: number) => level(page, n).getByRole('radio');

/** Plays a 5- (or 10-) exercise Maths lesson of level `n` to the summary, all right first try. */
async function playLevel(page: Page, n: number, exercises: 5 | 10 = 5) {
  await level(page, n).click();
  await page
    .locator('.session-options label')
    .nth(exercises === 5 ? 0 : 1)
    .click();
  await page.locator('.start-button').click();
  for (let i = 0; i < exercises; i++) {
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
  // First plays: no sign except the star on Maths levels 4-7.
  await expect(level(page, 1).locator('.next-play')).toHaveCount(0);
  await expect(level(page, 3).locator('.next-play')).toHaveCount(0);
  await expect(level(page, 4).locator('.next-play')).toHaveText('★');
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
  await leaveProfile(page, 'sign-out');
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
    ['Small maths', 'Malá matematika', 3, 3],
    ['Maths', 'Matematika', 7, 6], // 1/2, 1/4 and the stars on levels 4-7
    ['English', 'Angličtina', 3, 3],
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
      for (const [en, sk, top, signCount] of courses) {
        const where = `${language} ${width}x${height} ${en}`;
        await page.getByRole('button', { name: language === 'EN' ? en : sk, exact: true }).click();
        await expect(page.locator('.level-options')).toBeVisible();
        await expect(page.locator('.next-play')).toHaveCount(signCount);
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

test('the calculation line adds no page scroll where summaries already scroll (EN and SK)', async ({
  page,
}) => {
  // QA204-03: 568x320 and phones at 200% text already scroll at x1. On the same summary, the
  // calculation line must not scroll more than the plain "+N points" line would, must stay one
  // line, and its screen-reader prefix must stay visually hidden.
  const username = uniqueName('mul');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await createAccount(page, username);
  await hideFromLeaderboard(page);
  await page.evaluate((user) => {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Bratislava',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const counts = { 'math:1': 2 };
    localStorage.setItem(
      'bearmatics-plays',
      JSON.stringify({ [`password:${user}`]: { day, counts } }),
    );
  }, username);
  await page.reload();
  await page.getByRole('button', { name: 'Maths', exact: true }).click();
  // 10 exercises (two-digit lines). Level 1 after two plays: x1/2; level 4 first play: x1.5.
  for (const [n, calc] of [
    [1, '10 × 1/2 = 5'],
    [4, '10 × 1.5 = 15'],
  ] as const) {
    await playLevel(page, n, 10);
    await expect(page.locator('.points-multiplied')).toContainText(calc);
    for (const [width, height, zoom] of [
      [568, 320, 100],
      [320, 568, 200],
      [390, 844, 200],
    ] as const) {
      await page.setViewportSize({ width, height });
      const big =
        zoom === 200
          ? await page.addStyleTag({ content: 'html{font-size:200% !important}' })
          : null;
      for (const language of ['EN', 'SK'] as const) {
        if (language === 'SK') {
          await page.getByRole('button', { name: 'Settings' }).click();
          await page.getByRole('button', { name: 'Slovenčina' }).click();
          await page.getByRole('button', { name: 'Zavrieť nastavenia' }).click();
        }
        const where = `${calc} ${language} ${width}x${height}@${zoom}%`;
        const m = await page.evaluate(async () => {
          const root = document.documentElement;
          const scroll = () => root.scrollHeight - root.clientHeight;
          const line = document.querySelector<HTMLElement>('.points-multiplied')!;
          const sr = line.querySelector<HTMLElement>('.sr-only')!;
          const srBox = sr.getBoundingClientRect();
          const style = getComputedStyle(line);
          const lines = Math.round(
            line.getBoundingClientRect().height / parseFloat(style.lineHeight),
          );
          const withCalc = scroll();
          // The same summary with the plain line in its place.
          const plain = document.createElement('p');
          plain.className = 'points-added';
          plain.textContent = document.documentElement.lang === 'sk' ? '+8 bodov' : '+8 points';
          // (swapped out of the DOM, so no rule for the calculation applies to the summary)
          line.replaceWith(plain);
          await new Promise(requestAnimationFrame);
          const withPlain = scroll();
          plain.replaceWith(line);
          return {
            withCalc,
            withPlain,
            lines,
            side: root.scrollWidth - root.clientWidth,
            srHidden:
              srBox.width <= 1 && srBox.height <= 1 && getComputedStyle(sr).position === 'absolute',
          };
        });
        expect(m.srHidden, `${where}: screen-reader prefix hidden`).toBe(true);
        expect(m.lines, `${where}: calculation on one line`).toBe(1);
        expect(m.side, `${where}: side scroll`).toBe(0);
        expect(m.withCalc, `${where}: page scroll vs the plain line`).toBeLessThanOrEqual(
          m.withPlain,
        );
        if (language === 'SK') {
          await page.getByRole('button', { name: 'Nastavenia' }).click();
          await page.getByRole('button', { name: 'English' }).click();
          await page.getByRole('button', { name: 'Close settings' }).click();
        }
      }
      if (big) await big.evaluate((el) => (el as unknown as Element).remove());
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await backToLevels(page);
  }
});
