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
    settingsItem: 'About Bearmatics',
    appSettings: 'Settings',
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
    settingsItem: 'O aplikácii',
    appSettings: 'Nastavenia',
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

/**
 * The fixed top bar (Peter's design round 2): logo + Bearmatics on the left, the language switch on
 * the right, one row inside the window, every link a comfortable target; EN/SK on small bars.
 */
async function expectBar(page: Page, short?: boolean) {
  const bar = page.getByRole('banner');
  const home = bar.getByRole('link', { name: 'Bearmatics', exact: true });
  const nav = bar.getByRole('navigation', { name: 'Language / Jazyk' });
  const width = page.viewportSize()!.width;
  const homeBox = (await home.boundingBox())!;
  const navBox = (await nav.boundingBox())!;
  expect(homeBox.x).toBeGreaterThanOrEqual(0);
  expect(homeBox.x + homeBox.width).toBeLessThanOrEqual(navBox.x);
  expect(navBox.x + navBox.width).toBeLessThanOrEqual(width + 1);
  // One row: both halves share the same middle line.
  expect(
    Math.abs(homeBox.y + homeBox.height / 2 - (navBox.y + navBox.height / 2)),
  ).toBeLessThanOrEqual(4);
  for (const link of await bar.getByRole('link').all()) {
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  // The logo is the favicon, decorative next to its word.
  await expect(home.locator('img')).toHaveAttribute('src', '/favicon.svg');
  await expect(home.locator('img')).toHaveAttribute('alt', '');
  // Visible labels: full names, or EN / SK on small bars; the accessible names stay full.
  const visible = await nav.getByRole('link').evaluateAll((links) =>
    links.map((link) =>
      // The text a sighted user sees: spans wider than the 1 px visually hidden ones.
      [...link.querySelectorAll('span')]
        .filter((span) => span.getBoundingClientRect().width > 2)
        .map((span) => span.textContent)
        .join(''),
    ),
  );
  if (short !== undefined)
    expect(visible).toEqual(short ? ['SK', 'EN'] : ['Slovenčina', 'English']);
  await expect(nav.getByRole('link', { name: 'Slovenčina', exact: true })).toHaveAttribute(
    'lang',
    'sk',
  );
  await expect(nav.getByRole('link', { name: 'English', exact: true })).toHaveAttribute(
    'lang',
    'en',
  );
}

/** Scrolls to the end: the bar stays at the top of the window and nothing slides under it. */
async function expectBarStaysAfterScroll(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  const box = (await page.getByRole('banner').boundingBox())!;
  expect(Math.abs(box.y)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('banner').getByRole('link').first()).toBeInViewport();
  // The topmost element under the bar's middle is the bar itself.
  expect(
    await page.evaluate(() => {
      const bar = document.querySelector('header')!.getBoundingClientRect();
      const hit = document.elementFromPoint(bar.left + bar.width / 2, bar.top + bar.height / 2);
      return !!hit?.closest('header');
    }),
  ).toBe(true);
}

/** The focused link is fully below the fixed bar (scroll-padding + AboutBar's focus handler). */
async function expectClearOfBar(page: Page) {
  const bar = (await page.getByRole('banner').boundingBox())!;
  const box = (await page.locator(':focus').boundingBox())!;
  const barBottom = bar.y + bar.height;
  const height = page.viewportSize()!.height;
  expect(box.y).toBeGreaterThanOrEqual(barBottom - 1);
  // QA224-04: a link that fits below the bar is fully visible (Firefox left it at the bottom
  // edge); QA224-05: a taller one (a screenshot on a short screen) starts right below the bar.
  if (box.height <= height - barBottom) expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
  else expect(box.y).toBeLessThanOrEqual(barBottom + 16);
}

/** Headings and captions wrap only between words (QA224-01): no word is split over two lines. */
async function expectNoWordBreaks(page: Page) {
  const broken = await page.locator('main :is(h1, h2, h3, figcaption)').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const found: string[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const match of node.textContent!.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          // A word split over two lines has boxes on two different lines.
          const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
          if (tops.size > 1) found.push(match[0]);
        }
      }
      return found;
    }),
  );
  expect(broken).toEqual([]);
}

/** Screenshots large enough to read (O1): 260-300 px wide on phones, one per row there. */
async function expectReadableShots(page: Page, oneRow: boolean) {
  const boxes = await page
    .locator('main figure img')
    .evaluateAll((images) => images.map((image) => image.getBoundingClientRect().toJSON()));
  expect(boxes).toHaveLength(13); // SCRUM-309: Bear picks a game; SCRUM-324: Logic menu, Pexeso
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(260);
    expect(box.width).toBeLessThanOrEqual(300);
  }
  // One per row: every picture starts at the same left edge.
  if (oneRow) for (const box of boxes) expect(box.x).toBe(boxes[0].x);
}

/** Scrolls every screenshot into view (they load lazily) and waits until each has loaded. */
async function expectImagesLoaded(page: Page, lang: Lang) {
  const images = page.locator('main img');
  await expect(images).toHaveCount(13);
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
      // EN / SK on phones (bars narrower than 24em), full names from the landscape phone up.
      await expectBar(page, device.width < 420);
      // The page title starts below the bar, not under it.
      const barBottom = (await page.getByRole('banner').boundingBox())!;
      const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
      expect(title.y).toBeGreaterThanOrEqual(barBottom.y + barBottom.height);
      // No other way back to the app than the bar (the old "Open Bearmatics" links are gone).
      await expect(page.getByRole('contentinfo')).toHaveCount(0);
      await expect(page.getByRole('link', { name: /open bearmatics|otvoriť/i })).toHaveCount(0);
      await expectImagesLoaded(page, lang);
      await expectNoHorizontalScroll(page);
      await expectNoWordBreaks(page);
      await expectReadableShots(page, device.width <= 620);
      await expectBarStaysAfterScroll(page);
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
  await expect(switcher.getByRole('link', { name: 'English', exact: true })).toHaveAttribute(
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
  test(`Settings opens the About page in the app language and the bar's Bearmatics opens the app in that language ${lang}`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('.course-option').first().waitFor();
    await page.locator('.settings-button').click();
    if (lang === 'sk') await page.getByRole('button', { name: 'Slovenčina' }).click();
    await page.getByRole('link', { name: COPY[lang].settingsItem }).click();
    await expectAboutPage(page, lang, `/about/${lang}`);
    const home = page.getByRole('banner').getByRole('link', { name: 'Bearmatics', exact: true });
    await expect(home).toHaveAttribute('href', `/?lang=${lang}`);
    await home.click();
    // The app opens in the page's language and the parameter leaves the address.
    await expect(page.locator('.course-option')).toHaveCount(5);
    await expect(page).toHaveURL('/');
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('button', { name: COPY[lang].appSettings })).toBeVisible();
    await expect(page.locator('.app-bar')).toBeVisible();
    // ... and the app's own Settings About link still follows the app language.
    await page.locator('.settings-button').click();
    await expect(page.getByRole('link', { name: COPY[lang].settingsItem })).toHaveAttribute(
      'href',
      `/about/${lang}`,
    );
    // replaceState, not a new entry: Back returns to the About page.
    await page.goBack();
    await expectAboutPage(page, lang, `/about/${lang}`);
  });

for (const other of LANGS)
  test(`the About page in ${other} opens the app in ${other}, also after switching the page language`, async ({
    page,
  }) => {
    const first = other === 'sk' ? 'en' : 'sk';
    await page.goto(`/about/${first}`);
    await page
      .getByRole('navigation', { name: 'Language / Jazyk' })
      .getByRole('link', { name: other === 'sk' ? 'Slovenčina' : 'English', exact: true })
      .click();
    await expectAboutPage(page, other, `/about/${other}`);
    await page.getByRole('link', { name: 'Bearmatics', exact: true }).click();
    await expect(page.locator('.course-option')).toHaveCount(5);
    await expect(page).toHaveURL('/');
    await expect(page.locator('html')).toHaveAttribute('lang', other);
  });

test('the app start without a language, or with an unknown one, stays English as before', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.course-option').first().waitFor();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  for (const query of ['?lang=de', '?lang=SK', '?lang=']) {
    await page.goto(`/${query}`);
    await page.locator('.course-option').first().waitFor();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // Ignored values are left alone in the address.
    expect(new URL(page.url()).search).toBe(query === '?lang=' ? '?lang=' : query);
  }
  // A Slovak browser does not change the start either (only the About page follows it).
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
    { width: 360, height: 640 },
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
      // Phones and the small landscape phone show EN / SK; the bar stays one row in the window.
      await expectBar(page, true);
      for (const link of await page.locator('a').all()) {
        const box = (await link.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
      }
      for (const image of await page.locator('main img').all()) {
        const box = (await image.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
      }
      // Images load lazily: scroll through so every layout is final, then check the words.
      await expectImagesLoaded(page, lang);
      await expectNoWordBreaks(page);
      await expectBarStaysAfterScroll(page);
      await expectNoHorizontalScroll(page);
    });

for (const lang of LANGS)
  test(`every link is reachable with the keyboard in page order, with visible focus ${lang}`, async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/about/${lang}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    const links = await page
      .locator('a[href]')
      .evaluateAll((list) => list.map((a) => a.getAttribute('href')));
    // Bearmatics, Slovenčina, English, play (bar), the 13 full-size screenshots (SCRUM-241: Word
    // search; SCRUM-309: Bear picks a game; SCRUM-324: Logic menu, Pexeso), What we store, e-mail.
    const shots = [
      'course',
      'small-maths',
      'take-away',
      'logic',
      'patterns',
      'logic-menu',
      'pexeso',
      'english',
      'wordsearch',
      'bear-picks',
      'summary',
      'app-bar',
    ];
    expect(links).toEqual([
      `/?lang=${lang}`,
      '/about/sk',
      '/about/en',
      `/?lang=${lang}`,
      ...[...shots, 'leaderboard'].map((shot) => `/about/${lang}/${shot}.webp`),
      '#about-store',
      links[18],
    ]);
    expect(links[18]).toMatch(/^mailto:/);
    const reached: (string | null)[] = [];
    // WebKit-style "Tab skips links" does not apply to Chromium/Firefox on Linux.
    for (let i = 0; i < links.length; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      reached.push(await focused.getAttribute('href'));
      // Visible focus ring, and the focused link is not hidden under the fixed bar.
      const ring = await focused.evaluate((a) => {
        const style = getComputedStyle(a);
        return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
      });
      expect(ring.style).not.toBe('none');
      expect(ring.width).toBeGreaterThanOrEqual(2);
      await expect(focused).toBeInViewport();
      if (i >= 4) await expectClearOfBar(page);
    }
    expect(reached, browserName).toEqual(links);
    // From the end of the page, Shift+Tab walks back up into the bar; every link on the way
    // stays clear of the bar.
    for (let i = links.length - 2; i >= 2; i--) {
      await page.keyboard.press('Shift+Tab');
      const focused = page.locator(':focus');
      await expect(focused).toHaveAttribute('href', links[i]!);
      if (i >= 4) await expectClearOfBar(page);
    }
    await expect(page.locator(':focus')).toHaveAttribute('href', '/about/en');
    await expect(page.locator(':focus')).toBeInViewport();
    // "Full details" jumps to the list, which lands below the bar.
    await page.goto(`/about/${lang}`);
    await page.locator('a[href="#about-store"]').click();
    await expect(page).toHaveURL(new RegExp(`/about/${lang}#about-store$`));
    // Lands below the fixed bar (scroll-margin-top) and focus moves to the heading (O3).
    const store = page.getByRole('heading', { level: 3 });
    await expect(store).toBeFocused();
    await expect(store).toHaveAttribute('id', 'about-store');
    const barHeight = (await page.getByRole('banner').boundingBox())!.height;
    await expect.poll(async () => (await store.boundingBox())!.y).toBeGreaterThanOrEqual(barHeight);
    await expect(store).toBeInViewport();
    expect((await store.boundingBox())!.y).toBeLessThan(barHeight + 40);
    // Tab continues from there: the e-mail link in the list below.
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('href', /^mailto:/);
    // Enter follows the focused link (the second bar link: Slovenčina).
    await page.goto(`/about/${lang}`);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expectAboutPage(page, 'sk', '/about/sk');
  });

test('a screenshot opens its full-size file in a new tab (O1)', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about/sk');
  // The last of the 13 screenshots (SCRUM-309 added Bear picks a game, SCRUM-324 two Logic ones).
  const link = page.getByRole('link', { name: /otvorí sa na novej karte/ }).nth(12);
  await expect(link).toHaveAttribute('href', '/about/sk/leaderboard.webp');
  await link.scrollIntoViewIfNeeded();
  const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await tab.waitForLoadState();
  expect(new URL(tab.url()).pathname).toBe('/about/sk/leaderboard.webp');
  await expect(page).toHaveURL('/about/sk');
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

// QA224-04/05: keyboard focus on the tall screenshot links stays fully usable on short screens
// and with 200% text, both directions.
for (const [width, height, zoom] of [
  [390, 844, 1],
  [320, 568, 1],
  [844, 390, 1],
  [390, 844, 2],
] as const) {
  test(`screenshot links keep clear of the bar and the window edge ${width}x${height}${zoom === 2 ? ' 200%' : ''}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/about/en');
    if (zoom === 2) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await page.getByRole('heading', { level: 1 }).waitFor();
    const shots = page.locator('a.about-shot-link');
    await page.locator('a[href^="/about/sk"]').first().focus();
    await page.keyboard.press('Tab'); // English
    await page.keyboard.press('Tab'); // play
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveClass(/about-shot-link/);
      await expect
        .poll(() => page.evaluate(() => document.activeElement!.getBoundingClientRect().top))
        .toBeGreaterThan(0);
      await expectClearOfBar(page);
    }
    for (let i = 6; i >= 0; i--) {
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator(':focus')).toHaveAttribute(
        'href',
        (await shots.nth(i).getAttribute('href'))!,
      );
      await expectClearOfBar(page);
    }
  });
}
