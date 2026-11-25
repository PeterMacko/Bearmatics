import { expect, test } from '@playwright/test';

// SCRUM-218: against the real Worker (wrangler dev, run_worker_first + single-page-application
// assets) every About address answers 200 with the app page, so direct links and refresh work.
for (const path of ['/about', '/about/', '/about/sk', '/about/en', '/about/en/', '/about/xx']) {
  test(`the server answers ${path} with the app page`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(await response.text()).toContain('<div id="root"></div>');
  });
}

test('the About page opens from the real server and its screenshots are served', async ({
  page,
}) => {
  await page.goto('/about/sk');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('O aplikácii Bearmatics');
  const sources = await page
    .locator('.about-shot img')
    .evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).getAttribute('src')!),
    );
  expect(sources).toHaveLength(10);
  for (const source of sources) {
    const response = await page.request.get(source);
    expect(response.status(), source).toBe(200);
    expect(response.headers()['content-type'], source).toContain('image/webp');
  }
});
