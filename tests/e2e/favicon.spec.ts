import { expect, test } from '@playwright/test';

test('built local favicon responses are actual SVG and 32px PNG, not SPA HTML', async ({
  page,
  request,
}, testInfo) => {
  await page.goto('/');
  const icons = await page.locator('link[rel="icon"]').evaluateAll((elements) =>
    elements.map((el) => ({
      href: el.getAttribute('href')!,
      type: el.getAttribute('type'),
      sizes: el.getAttribute('sizes'),
    })),
  );
  expect(icons).toEqual(
    expect.arrayContaining([
      { href: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
      { href: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
    ]),
  );
  const svg = await request.get('/favicon.svg');
  expect(svg.status()).toBe(200);
  expect(svg.headers()['content-type']).toContain('image/svg+xml');
  const artwork = await svg.text();
  expect(artwork).toContain('viewBox="0 0 64 64"');
  expect(artwork.replace('xmlns="http://www.w3.org/2000/svg"', '')).not.toMatch(
    /<script|https?:|<foreignObject|<image|onload=|b\./i,
  );
  const png = await request.get('/favicon-32.png');
  expect(png.status()).toBe(200);
  expect(png.headers()['content-type']).toContain('image/png');
  const bytes = await png.body();
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(16)).toBe(32);
  expect(bytes.readUInt32BE(20)).toBe(32);
  // Capture the exact SVG artwork at native 16/32 CSS-pixel sizes on both tab-chrome contrasts.
  await page.setContent(
    `<div style="display:flex;gap:16px;padding:16px;background:#fff"><img src="/favicon.svg" width="16" height="16"><img src="/favicon.svg" width="32" height="32"></div><div style="display:flex;gap:16px;padding:16px;background:#252533"><img src="/favicon.svg" width="16" height="16"><img src="/favicon-32.png" width="32" height="32"></div>`,
  );
  await expect(page.locator('img')).toHaveCount(4);
  await expect
    .poll(() =>
      page
        .locator('img')
        .evaluateAll((imgs) =>
          imgs.every(
            (img) =>
              (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('favicon-native-sizes.png') });
});
