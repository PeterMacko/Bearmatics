import { expect, test, type Page } from '@playwright/test';
import { ALL_DEVICES, DEVICE, type Device } from './support/devices';
import { openMathematics, openSmallMaths } from './support/course';
import { answerFor } from './support/maths';

// SCRUM-211: lesson time and average time per example on the summary, every course, signed in
// (mocked server) and out. The clock is Playwright's fake clock: Date.now is held at the lesson
// start and moved 3:25 on before the last tap, so the expected text is exact.

const T0 = new Date('2026-06-15T09:00:00+02:00').getTime();
const LESSON_MS = 205_000;
const KEY = 'bearmatics.lessonStart';

/** Signed-in demo player: 123 points before, +8 (5 x 1.5) after, a new badge and streak 5. */
async function signedIn(page: Page) {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/me')
      return json({
        account: { kind: 'password', username: 'kid', nickname: 'Kid', bear: 2, email: null },
      });
    if (path === '/api/progress')
      return json({ points: 123, streak: 4, frozen: false, today: false });
    if (path === '/api/progress/lessons') return json({ lessonId: 'a'.repeat(32) });
    if (path === '/api/progress/lessons/finish')
      return json({ points: 131, streak: 5, frozen: false, today: true, added: 8, offer: null });
    return json({ available: false });
  });
}

async function signedOut(page: Page) {
  await page.route('**/api/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(
        new URL(route.request().url()).pathname === '/api/me' ? { account: null } : {},
      ),
    }),
  );
}

/** Records the word each play() uses, so English answers are known. */
async function recordWords(page: Page) {
  await page.addInitScript(() => {
    const played: string[] = [];
    (window as unknown as { played: string[] }).played = played;
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      played.push(decodeURIComponent(this.src.split('/').pop()!.replace('.mp3', '')));
      return original.call(this).catch(() => undefined);
    };
  });
}
const target = (page: Page) =>
  page.evaluate(() => (window as unknown as { played: string[] }).played.at(-1)!);

type Course = 'small' | 'maths' | 'english';

/** Plays a 5-exercise lesson right first time; the last tap shows the summary 3:25 later. */
async function playLesson(page: Page, course: Course, level = 1) {
  if (course === 'small') await openSmallMaths(page);
  else if (course === 'maths') await openMathematics(page);
  else await page.getByRole('button', { name: /^(English|Angličtina)$/ }).click();
  await page
    .locator('.level-option')
    .nth(level - 1)
    .click();
  await page.locator('.session-options label').first().click(); // 5
  await page.clock.setFixedTime(T0);
  await page.locator('.start-button').click();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), KEY)).toBe(
    JSON.stringify({ startedAt: T0, size: 5 }),
  );
  for (let i = 0; i < 5; i++) {
    if (course === 'english') {
      const word = await target(page);
      await page
        .locator('.word-option')
        .filter({ hasText: new RegExp(`^${word}$`, 'i') })
        .click();
    } else await page.getByRole('textbox').fill(String(await answerFor(page)));
    await page.locator('.answer-button').click(); // Check
    if (i === 4) await page.clock.setFixedTime(T0 + LESSON_MS);
    await page.locator('.answer-button').click(); // Next / See how you did
  }
  await expect(page.locator('.summary')).toBeVisible();
}

for (const course of ['small', 'maths', 'english'] as const)
  for (const account of ['signed out', 'signed in'] as const)
    test(`${course} ${account}: the summary shows the lesson time; leaving clears the start`, async ({
      page,
    }) => {
      await page.clock.install({ time: T0 });
      await recordWords(page);
      await (account === 'signed in' ? signedIn(page) : signedOut(page));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      await playLesson(page, course);
      const line = page.locator('.summary .lesson-time');
      await expect(line.locator('[aria-hidden="true"]')).toHaveText(
        'Time 3:25 · about 41 s per example',
      );
      await expect(line.locator('.sr-only')).toHaveText(
        'Time 3 minutes 25 seconds, about 41 seconds per example',
      );
      // Under the first-try score; signed in, above the points.
      expect(
        await page.evaluate(
          () => document.querySelector('.first-try')!.nextElementSibling!.className,
        ),
      ).toBe('lesson-time');
      if (account === 'signed in') {
        await expect(page.locator('.summary-points')).toBeVisible();
        await expect(page.locator('.summary .points-multiplied')).toHaveCount(0); // level 1: x1
      } else await expect(page.locator('.points-hint')).toBeVisible();
      // Slovak, same time.
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.getByRole('button', { name: 'Slovenčina' }).click();
      await page.getByRole('button', { name: 'Zavrieť nastavenia' }).click();
      await expect(line.locator('[aria-hidden="true"]')).toHaveText(
        'Čas 3:25 · asi 41 s na príklad',
      );
      await expect(line.locator('.sr-only')).toHaveText(
        'Čas 3 minúty 25 sekúnd, asi 41 sekúnd na príklad',
      );
      // Leaving the summary removes the start from the tab.
      await page.locator('.summary .secondary').click();
      expect(await page.evaluate((key) => sessionStorage.getItem(key), KEY)).toBeNull();
    });

test('without a stored start the summary has no time line and no error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install({ time: T0 });
  await signedOut(page);
  await page.goto('/');
  await openMathematics(page);
  await page.locator('.session-options label').first().click();
  await page.locator('.start-button').click();
  await page.evaluate((key) => sessionStorage.removeItem(key), KEY);
  for (let i = 0; i < 5; i++) {
    await page.getByRole('textbox').fill(String(await answerFor(page)));
    await page.locator('.answer-button').click();
    await page.locator('.answer-button').click();
  }
  await expect(page.locator('.summary .first-try')).toContainText('5 / 5');
  await expect(page.locator('.lesson-time')).toHaveCount(0);
  expect(errors).toEqual([]);
});

/**
 * Summary page scroll per defined device, EN/SK, signed out and signed in at the worst case
 * (Maths level 4 first play: the "5 × 1.5 = 8 points" calculation line, a new badge and the
 * streak). "Before" is the same summary with the time line swapped out of the DOM (so no rule
 * for it applies: the main layout). Phones signed in must not newly scroll.
 */
const PHONES: Device[] = [
  DEVICE.phone,
  DEVICE.phone360,
  DEVICE.smallPhone,
  DEVICE.phoneLandscape,
  DEVICE.smallPhoneLandscape,
];
const SIZES = [
  ...ALL_DEVICES.filter((d) => d !== DEVICE.phone369).map((d) => ({ ...d, zoom: 100 })),
  { ...DEVICE.phone, zoom: 200 },
  { ...DEVICE.smallPhone, zoom: 200 },
];

for (const account of ['signed out', 'signed in'] as const)
  test(`summary scroll with the time line, ${account}, defined devices EN/SK`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await page.clock.install({ time: T0 });
    await (account === 'signed in' ? signedIn(page) : signedOut(page));
    const rows: Record<string, unknown>[] = [];
    for (const size of SIZES) {
      for (const language of ['EN', 'SK'] as const) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto('/');
        // Every play is the first of the day (x1.5 on level 4): forget earlier plays.
        await page.evaluate(() => localStorage.removeItem('bearmatics-plays'));
        if (language === 'SK') {
          await page.getByRole('button', { name: 'Settings' }).click();
          await page.getByRole('button', { name: 'Slovenčina' }).click();
          await page.getByRole('button', { name: 'Zavrieť nastavenia' }).click();
        }
        if (size.zoom === 200)
          await page.addStyleTag({ content: 'html{font-size:200% !important}' });
        await playLesson(page, 'maths', account === 'signed in' ? 4 : 1);
        if (account === 'signed in') {
          await expect(page.locator('.summary .points-multiplied')).toBeVisible();
          await expect(page.locator('.summary-streak')).toBeVisible();
          // Points, badge and streak animations: let them finish (worst case: the new badge).
          await page.clock.runFor(10_000);
          await expect(page.locator('.summary .new-badge')).toBeVisible();
        }
        const m = await page.evaluate(async () => {
          const root = document.documentElement;
          const scroll = () => root.scrollHeight - root.clientHeight;
          const line = document.querySelector<HTMLElement>('.lesson-time')!;
          const lines = Math.round(
            line.getBoundingClientRect().height / parseFloat(getComputedStyle(line).lineHeight),
          );
          const after = scroll();
          const side = root.scrollWidth - root.clientWidth;
          const placeholder = document.createComment('time');
          line.replaceWith(placeholder);
          await new Promise(requestAnimationFrame);
          const before = scroll();
          placeholder.replaceWith(line);
          return {
            before,
            after,
            side,
            lines,
            newBadge: !!document.querySelector('.summary .new-badge'),
          };
        });
        const row = {
          account,
          device: `${size.width}x${size.height}`,
          zoom: size.zoom,
          language,
          ...m,
        };
        rows.push(row);
        const where = `${account} ${language} ${size.name} ${size.width}x${size.height}@${size.zoom}%`;
        expect.soft(m.side, `${where}: side scroll`).toBe(0);
        const phone = PHONES.some((p) => p.width === size.width && p.height === size.height);
        if (phone && size.zoom === 100 && m.before <= 0)
          expect.soft(m.after, `${where}: newly scrolls`).toBeLessThanOrEqual(0);
      }
    }
    console.log(`SCROLL211 ${JSON.stringify(rows)}`);
    await testInfo.attach('scroll.json', {
      body: JSON.stringify(rows, null, 1),
      contentType: 'application/json',
    });
  });
