import { expect, test, type Page } from '@playwright/test';
import { openMathematics } from './support/course';
import { ALL_DEVICES } from './support/devices';
import { expectNoHorizontalScroll } from './support/layout';

// SCRUM-218: the About page at /about, /about/sk and /about/en (screenshots: SCRUM-222).
const COPY = {
  en: {
    title: 'About Bearmatics',
    headings: [
      'H1 About Bearmatics',
      'H2 Courses',
      'H2 How a lesson works',
      'H2 Signing in (optional)',
      'H2 Your data',
      'H3 What we store',
    ],
    open: 'Open Bearmatics',
    settingsItem: 'About Bearmatics',
  },
  sk: {
    title: 'O aplikácii Bearmatics',
    headings: [
      'H1 O aplikácii Bearmatics',
      'H2 Kurzy',
      'H2 Ako prebieha lekcia',
      'H2 Prihlásenie (nepovinné)',
      'H2 Vaše údaje',
      'H3 Čo ukladáme',
    ],
    open: 'Otvoriť Bearmatics',
    settingsItem: 'O aplikácii',
  },
} as const;
type Lang = keyof typeof COPY;
const LANGS = ['en', 'sk'] as const;

async function expectAboutPage(page: Page, lang: Lang, path: string) {
  await expect(page).toHaveURL(path);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY[lang].title);
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page).toHaveTitle(COPY[lang].title);
  // No app around it: no app bar, no lesson controls.
  await expect(page.locator('.app-bar, .app-shell')).toHaveCount(0);
}

const headings = (page: Page) =>
  page
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((list) => list.map((h) => `${h.tagName} ${h.textContent}`));

/** Scrolls every screenshot into view (they load lazily) and waits until each has loaded. */
async function expectImagesLoaded(page: Page, lang: Lang) {
  const images = page.locator('main img');
  await expect(images).toHaveCount(7);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth))
      .toBe(390);
    expect(await image.getAttribute('src')).toMatch(new RegExp(`^/about/${lang}/[a-z-]+\\.webp$`));
    expect((await image.getAttribute('alt'))!.length).toBeGreaterThan(30);
  }
}

for (const device of ALL_DEVICES)
  for (const lang of LANGS)
    test(`About page ${lang} on ${device.name} ${device.width}x${device.height}: direct open, reload, headings, images, no sideways scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.goto(`/about/${lang}`);
      await expectAboutPage(page, lang, `/about/${lang}`);
      expect(await headings(page)).toEqual(COPY[lang].headings);
      await expectNoHorizontalScroll(page);
      // Every link is a comfortable target, except the e-mail link inside the privacy text.
      for (const link of await page.locator('header a, footer a').all()) {
        const box = (await link.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x + box.width).toBeLessThanOrEqual(device.width + 1);
      }
      await expectImagesLoaded(page, lang);
      await expectNoHorizontalScroll(page);
      await page.reload();
      await expectAboutPage(page, lang, `/about/${lang}`);
    });

test.describe('bare /about with a Slovak browser', () => {
  test.use({ locale: 'sk-SK' });
  test('shows Slovak and keeps the address; unknown /about/xx behaves the same', async ({
    page,
  }) => {
    for (const path of ['/about', '/about/', '/about/xx']) {
      await page.goto(path);
      await expectAboutPage(page, 'sk', path);
      await page.reload();
      await expectAboutPage(page, 'sk', path);
    }
    // An explicit address wins over the browser language.
    await page.goto('/about/en');
    await expectAboutPage(page, 'en', '/about/en');
  });
});

for (const locale of ['en-US', 'de-DE'])
  test.describe(`bare /about with a ${locale} browser`, () => {
    test.use({ locale });
    test('shows English', async ({ page }) => {
      for (const path of ['/about', '/about/xx']) {
        await page.goto(path);
        await expectAboutPage(page, 'en', path);
      }
      await page.goto('/about/sk');
      await expectAboutPage(page, 'sk', '/about/sk');
    });
  });

test('the language switch changes the address and the page, and Back returns', async ({ page }) => {
  await page.goto('/about/en');
  const switcher = page.getByRole('navigation', { name: 'Language / Jazyk' });
  await expect(switcher.getByRole('link', { name: 'English' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await switcher.getByRole('link', { name: 'Slovenčina' }).click();
  await expectAboutPage(page, 'sk', '/about/sk');
  await expect(switcher.getByRole('link', { name: 'Slovenčina' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await switcher.getByRole('link', { name: 'English' }).click();
  await expectAboutPage(page, 'en', '/about/en');
  await page.goBack();
  await expectAboutPage(page, 'sk', '/about/sk');
});

for (const lang of LANGS)
  test(`Settings opens the About page in the app language and "Open Bearmatics" returns to the start ${lang}`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('.course-option').first().waitFor();
    await page.locator('.settings-button').click();
    if (lang === 'sk') await page.getByRole('button', { name: 'Slovenčina' }).click();
    await page.getByRole('link', { name: COPY[lang].settingsItem }).click();
    await expectAboutPage(page, lang, `/about/${lang}`);
    await page.getByRole('link', { name: COPY[lang].open }).first().click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('.course-option')).toHaveCount(3);
    await expect(page.locator('.app-bar')).toBeVisible();
    // The footer link goes to the same start.
    await page.goto(`/about/${lang}`);
    await page.getByRole('link', { name: COPY[lang].open }).last().click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('.course-option')).toHaveCount(3);
  });

test('the About link in a lesson with work asks first; leaving opens the page', async ({
  page,
}) => {
  await page.goto('/');
  await openMathematics(page);
  await page.getByRole('button', { name: 'Let’s count' }).click();
  await page.getByRole('textbox').pressSequentially('7');
  await page.locator('.settings-button').click();
  await page.getByRole('link', { name: 'About Bearmatics' }).click();
  await expect(page.getByRole('dialog', { name: 'Leave this trail?' })).toBeVisible();
  await expect(page).toHaveURL('/');
  await page.getByRole('button', { name: 'Keep practising' }).click();
  await expect(page.getByRole('textbox')).toHaveValue('7');
  await page.locator('.settings-button').click();
  await page.getByRole('link', { name: 'About Bearmatics' }).click();
  await page.getByRole('button', { name: 'Choose a new trail' }).click();
  await expectAboutPage(page, 'en', '/about/en');
});

for (const lang of LANGS)
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 568, height: 320 },
  ])
    test(`200% text fits without sideways scroll ${lang} ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto(`/about/${lang}`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      // After the document exists (an init script cannot style <html> in Chromium).
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await expectNoHorizontalScroll(page);
      for (const link of await page.locator('a').all()) {
        const box = (await link.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
      }
      for (const image of await page.locator('main img').all()) {
        const box = (await image.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
      }
    });

for (const lang of LANGS)
  test(`every link is reachable with the keyboard in page order ${lang}`, async ({
    page,
    browserName,
  }) => {
    await page.goto(`/about/${lang}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    const links = await page
      .locator('a[href]')
      .evaluateAll((list) => list.map((a) => `${a.textContent}|${a.getAttribute('href')}`));
    // Slovenčina, English, Open (header), What we store, e-mail, Open (footer).
    expect(links).toHaveLength(6);
    const reached: string[] = [];
    // WebKit-style "Tab skips links" does not apply to Chromium/Firefox on Linux.
    for (let i = 0; i < links.length; i++) {
      await page.keyboard.press('Tab');
      reached.push(
        await page.evaluate(
          () =>
            `${document.activeElement?.textContent}|${document.activeElement?.getAttribute('href')}`,
        ),
      );
    }
    expect(reached, browserName).toEqual(links);
    // Enter follows the focused link (the language switch).
    await page.goto(`/about/${lang}`);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expectAboutPage(page, 'sk', '/about/sk');
  });

test('the app start does not load the About page code or screenshots', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.goto('/');
  await page.locator('.course-option').first().waitFor();
  await openMathematics(page);
  await page.waitForLoadState('networkidle');
  expect(requests.filter((path) => /about/i.test(path))).toEqual([]);
  // The About page loads its own chunk.
  requests.length = 0;
  await page.goto('/about/en');
  await page.getByRole('heading', { level: 1 }).waitFor();
  expect(requests.some((path) => /\/assets\/AboutPage-.*\.js$/.test(path))).toBe(true);
});
