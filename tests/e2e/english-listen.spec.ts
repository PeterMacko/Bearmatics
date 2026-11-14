import { expect, test, type Page } from '@playwright/test';
import { allWords } from '../../src/english/words';

// SCRUM-79: English listen-and-choose on the defined devices (Peter's test scope).
const DEVICES: [string, number, number][] = [
  ['phone', 390, 844],
  ['small phone', 320, 568],
  ['phone 360', 360, 640],
  ['phone landscape', 844, 390],
  ['small phone landscape', 568, 320],
  ['tablet', 820, 1180],
  ['tablet landscape', 1180, 820],
  ['foldable unfolded', 884, 1004],
  ['foldable with browser bar', 884, 838],
  ['foldable narrow with browser bar', 742, 702],
  ['wide short', 1280, 520],
  ['desktop', 1366, 900],
];

async function startEnglish(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: /Let’s listen/ }).click();
  await expect(page.getByRole('button', { name: 'Play the word again' })).toBeFocused();
}

for (const [name, width, height] of DEVICES) {
  test(`English exercise fits ${name} ${width}x${height}: squares, one-line words, no page scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await startEnglish(page);
    await page.locator('.word-option').first().click();
    const layout = await page.evaluate(() => {
      const rect = (el: Element) => el.getBoundingClientRect();
      const controls = [
        ...document.querySelectorAll('.speaker-button, .word-option, .answer-button'),
      ].map(rect);
      const options = [...document.querySelectorAll('.word-option')];
      return {
        pageScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        sideScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        inView: controls.every(
          (r) =>
            r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
        ),
        square: options.every((o) => Math.abs(rect(o).width - rect(o).height) <= 1),
        oneLine: options.every((o) => {
          const range = document.createRange();
          range.selectNodeContents(o);
          return range.getClientRects().length === 1 && o.scrollWidth <= o.clientWidth;
        }),
        minSide: Math.min(...controls.map((r) => Math.min(r.width, r.height))),
      };
    });
    expect(layout.pageScroll).toBeLessThanOrEqual(1);
    expect(layout.sideScroll).toBeLessThanOrEqual(0);
    expect(layout.inView).toBe(true);
    expect(layout.square).toBe(true);
    expect(layout.oneLine).toBe(true);
    expect(layout.minSide).toBeGreaterThanOrEqual(44);
  });
}

// The four longest-rendering words checked together, then every word, at each device:
// after a refit the text must stay on one line inside its square.
for (const [name, width, height] of DEVICES) {
  test(`English: all 111 words stay on one line at ${name} ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 900,
      isMobile: width < 900,
    });
    const page = await context.newPage();
    await startEnglish(page);
    const words = allWords();
    const groups = [['seventeen', 'butterfly', 'umbrella', 'computer']];
    for (let i = 0; i < words.length; i += 4) groups.push(words.slice(i, i + 4));
    for (const group of groups) {
      const broken = await page.evaluate(async (group) => {
        const buttons = [...document.querySelectorAll<HTMLElement>('.word-option')];
        buttons.forEach((b, i) => (b.textContent = group[i % group.length]));
        window.dispatchEvent(new Event('resize'));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return buttons
          .filter((b) => {
            const range = document.createRange();
            range.selectNodeContents(b);
            return range.getClientRects().length !== 1 || b.scrollWidth > b.clientWidth;
          })
          .map((b) => b.textContent);
      }, group);
      expect(broken, `words broken at ${width}x${height}`).toEqual([]);
    }
    await context.close();
  });
}

test('English: the speaker never reveals the answer; a tapped word lights only itself', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startEnglish(page);
  const speaker = page.getByRole('button', { name: 'Play the word again' });
  await speaker.click();
  await expect(page.locator('.word-option[data-playing="true"]')).toHaveCount(0);
  const first = page.locator('.word-option').first();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(speaker).not.toHaveAttribute('data-playing', 'true');
});

test('English: Check without a choice asks to choose; a missed word returns in review; summary scores first tries', async ({
  page,
}) => {
  // Record which word file each play() uses, so the test knows the spoken target.
  await page.addInitScript(() => {
    const played: string[] = [];
    (window as unknown as { played: string[] }).played = played;
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      played.push(decodeURIComponent(this.src.split('/').pop()!.replace('.mp3', '')));
      return original.call(this).catch(() => undefined);
    };
  });
  const target = () =>
    page.evaluate(() => (window as unknown as { played: string[] }).played.at(-1)!);
  const choose = async (word: string) => {
    await page
      .locator('.word-option')
      .filter({ hasText: new RegExp(`^${word}$`, 'i') })
      .click();
    await page.getByRole('button', { name: 'Check answer' }).click();
  };
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('radio', { name: '5 exercises' }).click();
  await page.getByRole('button', { name: /Let’s listen/ }).click();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('status')).toHaveText('Choose a word first.');
  const missed = await target();
  const options = await page.locator('.word-option').allInnerTexts();
  await choose(options.find((o) => o.toLowerCase() !== missed)!);
  await expect(page.getByRole('status')).toContainText('Not quite');
  await choose(missed);
  for (let i = 2; i <= 5; i++) {
    await page.getByRole('button', { name: /Next word/ }).click();
    await expect(page.getByText(`Word ${i} of 5`)).toBeVisible();
    await choose(await target());
  }
  await page.getByRole('button', { name: /Review tricky ones/ }).click();
  await expect(page.getByRole('heading', { name: 'Let’s listen to these again' })).toBeVisible();
  expect(await target()).toBe(missed);
  await choose(missed);
  await page.getByRole('button', { name: /See how you did/ }).click();
  await expect(page.getByText('5 words completed')).toBeVisible();
  await expect(page.getByText('4 / 5')).toBeVisible();
});

test('English word audio files are served for every word', async ({ request }) => {
  for (const word of ['seven', 'suzy', 'grey', 'yellow', 'seventeen', 'butterfly']) {
    const response = await request.get(`/audio/words/${word}.mp3`);
    expect(response.status()).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(2000);
  }
});

// QA87-01: the playback-failure message must not make the page scroll on any defined device.
for (const [name, width, height] of DEVICES) {
  test(`English: "could not play" fits ${name} ${width}x${height} without page scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.route('**/audio/words/*.mp3', (route) => route.abort());
    await page.goto('/');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.getByRole('button', { name: /Let’s listen/ }).click();
    await expect(page.getByRole('alert')).toContainText('The word could not play.');
    await page.locator('.word-option').first().click();
    await page.getByRole('button', { name: 'Check answer' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          scroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
          inView: [
            ...document.querySelectorAll(
              '.speaker-button, .word-option, .answer-button, .play-error',
            ),
          ]
            .map((e) => e.getBoundingClientRect())
            .every((r) => r.top >= 0 && r.bottom <= innerHeight + 1),
        })),
      )
      .toEqual({ scroll: 0, inView: true });
    await page.unroute('**/audio/words/*.mp3');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}
