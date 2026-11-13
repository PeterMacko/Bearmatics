import { expect, test } from '@playwright/test';

test('idle menu wink renders one curved eye without moving content', async ({ page }, info) => {
  test.setTimeout(75000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 754, height: 655 });
  await page.goto('/');
  const before = await page.locator('.bear').evaluate((bear) => {
    const { x, y, width, height } = bear.getBoundingClientRect();
    return { x, y, width, height };
  });
  // Observe in the renderer: locator polling can miss this intentionally brief gesture,
  // and screenshots can take longer than its 240 ms lifetime.
  const events = await page.evaluate(
    () =>
      new Promise<
        {
          elapsed: number;
          eye: string | null;
          box: { x: number; y: number; width: number; height: number };
        }[]
      >((resolve) => {
        const bear = document.querySelector('.bear')!;
        const start = performance.now();
        const events: {
          elapsed: number;
          eye: string | null;
          box: { x: number; y: number; width: number; height: number };
        }[] = [];
        const observer = new MutationObserver(() => {
          const eye = bear.querySelector('.bear-wink-eye');
          const { x, y, width, height } = bear.getBoundingClientRect();
          events.push({
            elapsed: performance.now() - start,
            eye: eye?.getAttribute('d') ?? null,
            box: { x, y, width, height },
          });
          if (events.length === 4 && !eye) {
            clearTimeout(timeout);
            observer.disconnect();
            resolve(events);
          }
        });
        const timeout = setTimeout(() => {
          observer.disconnect();
          resolve(events);
        }, 65000);
        observer.observe(bear, { childList: true, subtree: true });
      }),
  );
  expect(events).toHaveLength(4);
  expect(events[2].eye).toBe('M156 120q7 6 14 0');
  expect(events[2].elapsed - events[0].elapsed).toBeGreaterThan(30000);
  expect(events[2].elapsed - events[0].elapsed).toBeLessThan(31000);
  expect(events[3].eye).toBeNull();
  expect(events[3].elapsed - events[2].elapsed).toBeGreaterThan(180);
  expect(events[3].elapsed - events[2].elapsed).toBeLessThan(600);
  expect(events[0].eye).toBe('M156 120q7 6 14 0');
  expect(events[0].elapsed).toBeGreaterThan(29000);
  expect(events[0].elapsed).toBeLessThan(32000);
  expect(events[1].eye).toBeNull();
  expect(events[1].elapsed - events[0].elapsed).toBeGreaterThan(180);
  expect(events[1].elapsed - events[0].elapsed).toBeLessThan(600);
  for (const event of events) expect(event.box).toEqual(before);
  await info.attach('real-timing', {
    body: JSON.stringify(events),
    contentType: 'application/json',
  });
});

test('rendered wink visual and menu exit cleanup with held browser clock', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 754, height: 655 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/');
  const before = await page.locator('.bear').evaluate((bear) => {
    const { x, y, width, height } = bear.getBoundingClientRect();
    return { x, y, width, height };
  });
  await page.clock.runFor(30000);
  await expect(page.locator('.bear-wink-eye')).toHaveAttribute('d', 'M156 120q7 6 14 0');
  await page.screenshot({ path: info.outputPath('wink-clock-held.png') });
  expect(
    await page.locator('.bear').evaluate((bear) => {
      const { x, y, width, height } = bear.getBoundingClientRect();
      return { x, y, width, height };
    }),
  ).toEqual(before);
  await page.locator('.start-button').click();
  await expect(page.locator('.workspace')).toHaveClass(/in-session/);
  await page.clock.runFor(60000);
  await expect(page.locator('.bear-wink-eye')).toHaveCount(0);
  expect(await page.locator('.bear').getAttribute('data-winking')).toBeNull();
});
