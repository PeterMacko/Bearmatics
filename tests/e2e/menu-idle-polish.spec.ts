import { expect, test } from '@playwright/test';
import { openMathematics } from './course';

test('clock-controlled wink cadence survives selection and locale; visibility and reduced motion cancel it', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/');
  await openMathematics(page);
  await page.clock.runFor(15000);
  await page.locator('input[name=level]').last().check();
  await page.locator('input[name=size]').last().check();
  await page.locator('.settings-button').click();
  await page.getByRole('button', { name: 'Slovenčina' }).click();
  await page.keyboard.press('Escape');
  await page.clock.runFor(14999);
  await expect(page.locator('.bear-wink-eye')).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(page.locator('.bear-wink-eye')).toHaveCount(1);
  await page.clock.runFor(240);
  await expect(page.locator('.bear-wink-eye')).toHaveCount(0);
  await page.clock.runFor(30000);
  await expect(page.locator('.bear-wink-eye')).toHaveCount(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.bear-wink-eye')).toHaveCount(0);
  await expect(page.locator('.bear')).toHaveAttribute('data-idle-motion', 'paused');
  await page.clock.runFor(120000);
  await expect(page.locator('.bear-wink-eye')).toHaveCount(0);
  await page.evaluate(() => {
    delete (document as any).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.bear')).toHaveAttribute('data-idle-motion', 'running');
  await page.clock.runFor(29999);
  await expect(page.locator('.bear-wink-eye')).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(page.locator('.bear-wink-eye')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.bear')).toHaveAttribute('data-idle-motion', 'paused');
  await page.clock.runFor(120000);
  await expect(page.locator('.bear-wink-eye')).toHaveCount(0);
  expect(
    await page.locator('.bear-character').evaluate((el) => getComputedStyle(el).transform),
  ).toBe('none');
  await page.locator('.start-button').click();
  expect(await page.locator('.bear').getAttribute('data-idle-motion')).toBeNull();
});

test('menu accents scale intrinsically with scene, retaining desktop proportions', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [
    [320, 568],
    [439, 628],
    [390, 844],
    [754, 655],
    [1193, 1201],
    [1366, 768],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await openMathematics(page);
    const ratios = await page.locator('.bear-scene').evaluate((scene) =>
      [...scene.querySelectorAll('.scene-leaf')].map((leaf) => ({
        width: parseFloat(getComputedStyle(leaf).width) / scene.clientWidth,
        height: parseFloat(getComputedStyle(leaf).height) / scene.clientHeight,
      })),
    );
    expect(ratios[0].width).toBeCloseTo(24 / 340, 2);
    expect(ratios[0].height).toBeCloseTo(46 / ((340 * 0.88 * 280) / 260), 2);
    expect(ratios[1].width).toBeCloseTo(20 / 340, 2);
    expect(ratios[1].height).toBeCloseTo(36 / ((340 * 0.88 * 280) / 260), 2);
  }
});

for (const [width, height] of [
  [320, 568],
  [754, 655],
  [1920, 1080],
])
  test(`gentle real-frame sway ${width}x${height}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await openMathematics(page);
    const frames = await page.evaluate(
      () =>
        new Promise<any[]>((resolve) => {
          const start = performance.now(),
            frames: any[] = [];
          const rect = (el: Element) => {
            const { x, y, width, height } = el.getBoundingClientRect();
            return { x, y, width, height };
          };
          const sample = (timestamp: number) => {
            const character = document.querySelector('.bear-character')!;
            const m = new DOMMatrix(getComputedStyle(character).transform);
            frames.push({
              t: timestamp - start,
              angle: (Math.atan2(m.b, m.a) * 180) / Math.PI,
              art: rect(character),
              svg: rect(document.querySelector('.bear')!),
              fixed: [
                ...document.querySelectorAll(
                  '.menu-heading,.level-options,.menu-controls,.settings-button,.scene-ring,.scene-leaf',
                ),
              ].map(rect),
            });
            if (performance.now() - start < 8100) requestAnimationFrame(sample);
            else resolve(frames);
          };
          requestAnimationFrame(sample);
        }),
    );
    const angles = frames.map((f) => f.angle);
    expect(Math.min(...angles)).toBeLessThan(-0.8);
    expect(Math.max(...angles)).toBeGreaterThan(0.8);
    expect(Math.max(...angles.map(Math.abs))).toBeLessThanOrEqual(1.3);
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      expect(f.fixed).toEqual(frames[0].fixed);
      expect(f.svg).toEqual(frames[0].svg);
      expect(f.art.x).toBeGreaterThan(f.svg.x);
      expect(f.art.y).toBeGreaterThan(f.svg.y);
      expect(f.art.x + f.art.width).toBeLessThan(f.svg.x + f.svg.width);
      expect(f.art.y + f.art.height).toBeLessThan(f.svg.y + f.svg.height);
      if (i) {
        const previous = frames[i - 1];
        expect(Math.abs(f.angle - previous.angle)).toBeLessThanOrEqual(
          (f.t - previous.t) * 0.0012 + 0.01,
        );
      }
    }
    await info.attach('real-animation-frames', {
      body: JSON.stringify(frames),
      contentType: 'application/json',
    });
    await page.screenshot({ path: info.outputPath('sway.png') });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const staticTransform = await page
      .locator('.bear-character')
      .evaluate((el) => getComputedStyle(el).transform);
    expect(staticTransform).toBe('none');
    await page.waitForTimeout(400);
    expect(
      await page.locator('.bear-character').evaluate((el) => getComputedStyle(el).transform),
    ).toBe(staticTransform);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('.bear')).toHaveAttribute('data-idle-motion', 'paused');
    // Read after React commits and the CSS pause has resolved, not inside dispatch.
    const pause = await page.locator('.bear-character').evaluate(async (el) => {
      const animation = el.getAnimations()[0];
      await animation?.ready;
      return animation?.currentTime;
    });
    await page.waitForTimeout(400);
    const held = await page
      .locator('.bear-character')
      .evaluate((el) => el.getAnimations()[0]?.currentTime);
    expect(Math.abs(Number(held) - Number(pause))).toBeLessThan(40);
    await page.evaluate(() => {
      delete (document as any).hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('.bear')).toHaveAttribute('data-idle-motion', 'running');
    await page.waitForTimeout(300);
    const resumed = await page
      .locator('.bear-character')
      .evaluate((el) => el.getAnimations()[0]?.currentTime);
    expect(Number(resumed)).toBeGreaterThan(Number(held));
    expect(Number(resumed) - Number(held)).toBeLessThan(600);
    await page.locator('.start-button').click();
    expect(await page.locator('.bear-character').evaluate((el) => el.getAnimations().length)).toBe(
      0,
    );
  });
