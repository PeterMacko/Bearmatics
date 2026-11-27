import { expect, test, type Page } from '@playwright/test';
import { createAccount, uniqueName } from '../e2e/support/account';
import { answerFor } from '../e2e/support/maths';

// SCRUM-309 "Bear picks a game" against the real server (local database): x1.5 on top of the
// table multiplier, the server takes the new top 12 for a 5-exercise lesson, a mode lesson is a
// normal play of its level in the daily count, and the next-game screen shows the table sign.

test.setTimeout(120_000);

const badge = (page: Page) =>
  page.getByRole('navigation', { name: /Main controls|Hlavné ovládanie/ }).getByRole('button', {
    name: /badge|odznak/,
  });
/** Keeps this spec's players off the shared database's leaderboard (see multipliers.spec). */
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
const game = (page: Page) => page.locator('.pick-game-level').textContent();
async function until(page: Page, match: RegExp) {
  for (
    let i = 0;
    i < 200 &&
    !match.test(`${await page.locator('.pick-game-course').textContent()}|${await game(page)}`);
    i++
  )
    await page.getByRole('button', { name: /Choose another|Vyber inú/ }).press('Enter');
  // Every new game restarts the 600 ms tap guard (QA321-04).
  await page.waitForTimeout(650);
}
async function solveAll(page: Page) {
  while (!(await page.locator('.summary').isVisible())) {
    await page.getByRole('textbox').fill(String(await answerFor(page)));
    await page.locator('.answer-button').click();
    await page.locator('.answer-button').click();
  }
}

test('signed in: Maths top level in the mode gives 5 × 1.5 × 1.5 = 12 points and counts as a play', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem('bearmatics-bear-picks', JSON.stringify({ age: 9, size: 5 })),
  );
  await page.goto('/');
  await createAccount(page, uniqueName('pick'), { nickname: 'Abcdefghijkl' });
  await hideFromLeaderboard(page);
  // Signed in: the course intro and the button's × 1.5 as before, no sign-in note.
  await expect(page.locator('.course-choice .intro')).toHaveText('Pick a course to start.');
  await expect(page.getByRole('button', { name: 'Bear picks a game' })).toHaveAccessibleDescription(
    'Games for your age, points × 1.5',
  );
  await page.getByRole('button', { name: 'Bear picks a game' }).click();
  await page.waitForTimeout(650);
  await expect(page.locator('.pick-note')).toHaveCount(0);
  await until(page, /^Maths\|/);
  const shown = (await game(page))!;
  const level = Number(/Level (\d)/.exec(shown)![1]);
  // Maths 4-7, first play today: the table's star next to the mode's x1.5.
  await expect(page.locator('.pick-tag-table')).toHaveText('★');
  await expect(page.locator('.pick-tag-mode')).toHaveText('× 1.5');
  await expect(page.locator('.pick-game')).toContainText(
    'Next play: one and a half times the points',
  );
  await page.getByRole('button', { name: 'Play' }).click();
  await solveAll(page);
  await expect(page.locator('.points-bear-picks')).toHaveText('Bear picks a game × 1.5');
  await expect(page.locator('.points-added')).toHaveText(
    'One and a half times the points, Bear picks a game × 1.5: 5 × 1.5 × 1.5 = 12 points',
  );
  await expect(badge(page)).toHaveAccessibleName('No bear badge yet, 12 points');
  // The server stored 12 (its limit for 5 exercises is now 12).
  expect(
    await page.evaluate(async () => (await (await fetch('/api/progress')).json()).points),
  ).toBe(12);
  // The lesson is a play of that Maths level today.
  const plays = await page.evaluate(() => JSON.parse(localStorage.getItem('bearmatics-plays')!));
  expect(Object.values(plays)[0]).toMatchObject({ counts: { [`math:${level}`]: 1 } });
  // Stop: the Maths menu no longer shows the star on that level (x1 now), others still do.
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('heading', { name: 'What shall we learn today?' })).toBeFocused();
  await page.waitForTimeout(650); // taps right after Stop are its rest (QA321-01)
  await page.getByRole('button', { name: 'Maths', exact: true }).click();
  await expect(page.locator(`.level-option.level-${level} .next-play`)).toHaveCount(0);
  const other = level === 7 ? 6 : 7;
  await expect(page.locator(`.level-option.level-${other} .next-play`)).toHaveText('★');
  // Back in the mode, the same game now shows no table sign, only the x1.5.
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await page.getByRole('button', { name: 'Bear picks a game' }).click();
  await page.waitForTimeout(650);
  await until(page, new RegExp(`^Maths\\|Level ${level} `));
  await expect(page.locator('.pick-tag-table')).toHaveCount(0);
  await expect(page.locator('.pick-tag-mode')).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  await solveAll(page);
  // Table x1: 5 × 1.5 = 8 points.
  await expect(page.locator('.points-added')).toHaveText(
    'Bear picks a game × 1.5: 5 × 1.5 = 8 points',
  );
  await expect(badge(page)).toHaveAccessibleName('No bear badge yet, 20 points');
});

test('signed in, Slovak: Small maths 1 after two plays: half points × 1,5 in the mode', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem('bearmatics-bear-picks', JSON.stringify({ age: 5, size: 10 })),
  );
  await page.goto('/');
  const name = uniqueName('pick');
  await createAccount(page, name);
  await hideFromLeaderboard(page);
  // Two normal plays of Small maths 1 today on this device (the count is kept per account).
  await page.evaluate((username) => {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Bratislava',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    localStorage.setItem(
      'bearmatics-plays',
      JSON.stringify({ [`password:${username}`]: { day, counts: { 'small:1': 2 } } }),
    );
  }, name);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Slovenčina' }).click();
  await page.getByRole('button', { name: 'Zavrieť nastavenia' }).click();
  await page.getByRole('button', { name: 'Medveď vyberie hru' }).click();
  await page.waitForTimeout(650);
  await until(page, /^Malá matematika\|Úroveň 1 /);
  await expect(page.locator('.pick-tag-table')).toHaveText('1/2');
  await expect(page.locator('.pick-tag-mode')).toHaveText('× 1,5');
  await expect(page.getByRole('radio', { name: '10 príkladov' })).toBeChecked();
  await page.getByRole('button', { name: 'Hrať' }).click();
  await expect(page.locator('.exercise-position')).toHaveText(/ z 10$/);
});
