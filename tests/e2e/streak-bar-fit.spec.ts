import { expect, test, type Page } from '@playwright/test';

// QA131-05: the frozen streak's warm-up text never pushes the bar into the page content or a
// second row (200% text, long nickname, 4-digit points). Server answers are mocked.
async function signedIn(page: Page, nickname: string, points: number, streak: number) {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/me')
      return json({
        account: { kind: 'password', username: 'kid', nickname, bear: 2, email: null },
      });
    if (path === '/api/progress') return json({ points, streak, frozen: true, today: false });
    return json({ available: false });
  });
}

test('200% text on a tablet: the profile screen starts below the frozen streak', async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await signedIn(page, 'Brave Cub', 40, 12);
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.getByRole('button', { name: /^Your profile/ }).click();
  await expect(page.getByRole('heading', { name: 'Brave Cub' }).first()).toBeVisible();
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  const hit = await page.evaluate(() => {
    const bar = document.querySelector('.app-bar-end')!.getBoundingClientRect();
    return [
      ...document.querySelectorAll('main h1, main h2, main .eyebrow, main .level-pill, main p'),
    ]
      .filter((e) => !e.closest('.sr-only'))
      .flatMap((e) => {
        const range = document.createRange();
        range.selectNodeContents(e);
        return [...range.getClientRects()].filter((r) => r.width > 0);
      })
      .filter((r) => r.top < bar.bottom && r.right > bar.left).length;
  });
  expect(hit).toBe(0);
});

for (const [width, height, language] of [
  [742, 702, 'English'],
  [1280, 520, 'Slovenčina'],
] as const) {
  test(`${width}x${height}: frozen streak, 20-character nickname, 1500 points stay in one row`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await signedIn(page, 'WWWWWWWWWWWWWWWWWWWW', 1500, 365);
    await page.goto('/');
    if (language !== 'English') {
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.getByRole('button', { name: language }).click();
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('.streak-chip')).toBeVisible();
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    const m = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.app-bar-end > *')].map((e) =>
        e.getBoundingClientRect(),
      );
      const bar = document.querySelector('.app-bar-end')!.getBoundingClientRect();
      const eyebrow = document.querySelector('.menu-shell .eyebrow')?.getBoundingClientRect();
      return {
        rows: Math.max(...items.map((r) => r.top)) - Math.min(...items.map((r) => r.top)),
        eyebrow:
          eyebrow &&
          eyebrow.top < bar.bottom &&
          eyebrow.right > bar.left &&
          eyebrow.left < bar.right,
      };
    });
    expect(m.rows).toBeLessThan(20);
    expect(m.eyebrow).toBeFalsy();
  });
}
