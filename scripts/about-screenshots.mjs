#!/usr/bin/env node
// SCRUM-222: phone screenshots for the About page (SCRUM-218), 7 per language.
// Usage: npm run about:shots  (builds, then runs this script), or
//        node scripts/about-screenshots.mjs [--dist dist] [--langs en,sk] [--shots course,leaderboard]
// Renders the built app (dist/) in Chromium at 390 x 844 (phone, portrait, touch) with /api mocked
// by made-up demo data (scripts/about-demo.json: player "Demo Bear" and a 14-player leaderboard;
// no real children, no server or database needed), a seeded Math.random (same exercises every
// run), a fixed clock and reduced motion. Writes public/about/<lang>/<name>.webp (WebP encoded by
// the browser itself, quality lowered step by step until each image is under 60 KB).
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { settle } from './equivalence/capture.mjs';
import { initScript } from './equivalence/states.mjs';

const root = resolve(import.meta.dirname, '..');
const demo = JSON.parse(readFileSync(join(root, 'scripts', 'about-demo.json'), 'utf8'));
const SHOTS = [
  'course',
  'small-maths',
  'take-away',
  'english',
  'summary',
  'app-bar',
  'leaderboard',
];
const { values: args } = parseArgs({
  options: {
    dist: { type: 'string', default: join(root, 'dist') },
    out: { type: 'string', default: join(root, 'public', 'about') },
    langs: { type: 'string', default: 'en,sk' },
    shots: { type: 'string', default: SHOTS.join(',') },
  },
});
const VIEWPORT = { width: 390, height: 844 };
const MAX_BYTES = 60 * 1024;
const CLOCK = new Date('2026-06-15T09:00:00+02:00');
/** Demo lesson time on the summary shot (SCRUM-211). */
const LESSON_MS = 65_000;

/** The built app with the same fallback as the Worker's assets: unknown paths get index.html. */
function serve(dir) {
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
  };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = resolve(dir, `.${path}`);
    if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory())
      file = join(dir, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () =>
      done({ server, url: `http://127.0.0.1:${server.address().port}` }),
    ),
  );
}

/** /api answers for the signed-in demo player. `summary` starts 5 points lower (see summary). */
async function mockApi(page, { summary = false } = {}) {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/me') return json({ account: demo.account });
    if (path === '/api/progress') return json(summary ? demo.summary.before : demo.progress);
    if (path === '/api/progress/lessons') return json({ lessonId: 'demo-lesson' });
    if (path === '/api/progress/lessons/finish') return json(demo.summary.after);
    if (path === '/api/leaderboard') return json(demo.leaderboard);
    return json({ available: false });
  });
}

const COURSE = { small: 0, maths: 1, english: 2 };

async function home(page, lang) {
  await page.goto('/');
  await page.locator('.course-option').first().waitFor();
  await page.locator('.streak-chip').waitFor();
  if (lang === 'sk') {
    await page.locator('.settings-button').click();
    await page.getByRole('button', { name: 'Slovenčina', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.locator('[role=dialog]').waitFor({ state: 'detached' });
    // Closing Settings returns focus to the gear: no focus ring in the picture (QA224-02).
    await page.evaluate(() => document.activeElement?.blur?.());
  }
}

async function openCourse(page, name) {
  await page.locator('.course-option').nth(COURSE[name]).click();
  await page.locator('.level-option').first().waitFor();
}

async function startLesson(page, name, levelIndex, size) {
  await openCourse(page, name);
  await page.locator('.level-option').nth(levelIndex).click();
  await page
    .locator('.session-options label')
    .filter({ hasText: new RegExp(`^${size}\\b`) })
    .click();
  await page.locator('.start-button').click();
  await page.locator('.practice').waitFor();
}

/** Numbers of the equation on screen and the position of the blank (0, 1 or 2 = result). */
function terms(page) {
  return page.locator('.equation').evaluate((element) => {
    const parts = [...element.querySelectorAll('[data-term]')];
    return {
      numbers: parts.map((p) => Number(p.textContent)),
      blank: parts.findIndex((p) => p.querySelector('input')),
    };
  });
}

/**
 * Starts lessons until the first exercise is a good example (e.g. groups big enough to show
 * pictures). Deterministic: the seeded Math.random gives the same lessons in the same order.
 */
async function startExample(page, name, levelIndex, wanted) {
  await openCourse(page, name);
  for (let tries = 0; tries < 50; tries++) {
    await page.locator('.level-option').nth(levelIndex).click();
    await page.locator('.start-button').click();
    await page.locator('.practice').waitFor();
    if (wanted(await terms(page))) return;
    await page.locator('.back-button').click();
    await page.locator('.level-option').first().waitFor();
  }
  throw new Error(`no good example for ${name} level ${levelIndex + 1}`);
}

/** The right answer of the maths exercise on screen, read from the equation. */
function answer(page) {
  return page.locator('.equation').evaluate((element) => {
    const parts = [...element.querySelectorAll('[data-term]')];
    const blank = parts.findIndex((p) => p.querySelector('input'));
    const [a, b, c] = parts.map((p) => Number(p.textContent));
    const op = element.querySelector('.operator').textContent.trim();
    const ops = {
      '+': [c - b, c - a, a + b],
      '−': [c + b, a - c, a - b],
      '×': [c / b, c / a, a * b],
      '÷': [c * b, a / c, a / b],
      ':': [c * b, a / c, a / b],
    };
    return ops[op][blank];
  });
}

async function solve(page) {
  for (const digit of String(await answer(page)))
    await page
      .locator('.number-pad button')
      .filter({ hasText: new RegExp(`^${digit}$`) })
      .click();
  await page.locator('.answer-button').click();
  await page.locator('.feedback-correct').first().waitFor();
}

/** How each screenshot is reached with real controls (selectors work in both languages). */
const STEPS = {
  course: home,
  'small-maths': async (page, lang) => {
    await home(page, lang);
    // Two groups of pictures, the result to find.
    await startExample(
      page,
      'small',
      0,
      ({ numbers: [a, b], blank }) => blank === 2 && a >= 2 && b >= 2 && a !== b,
    );
  },
  'take-away': async (page, lang) => {
    await home(page, lang);
    // A full basket; the child has already taken some pictures out.
    await startExample(
      page,
      'small',
      1,
      ({ numbers: [a, b], blank }) => blank === 2 && a >= 4 && b >= 2 && b < a,
    );
    const { numbers } = await terms(page);
    for (let i = 0; i < numbers[1]; i++) {
      await page.locator('.in-basket .basket-picture').first().click();
      // Quick repeated taps are ignored by the app: let the (fake) clock move on between taps.
      await page.clock.runFor(1_000);
    }
    await page
      .locator('.taken-out .basket-picture')
      .nth(numbers[1] - 1)
      .waitFor();
    // Back to the answer box, as when the child goes on to type the answer.
    await page.locator('.equation input').focus();
  },
  english: async (page, lang) => {
    await home(page, lang);
    await startLesson(page, 'english', 0, 10);
    await page.locator('.word-option').first().waitFor();
  },
  summary: async (page, lang) => {
    await home(page, lang);
    // SCRUM-211: the lesson time is a demo value too: Date.now is held at the start and moved
    // 65 s on before the last tap ("Time 1:05 · about 13 s per exercise"); timers keep running.
    await page.clock.setFixedTime(CLOCK);
    await startLesson(page, 'maths', 0, 5);
    for (let i = 0; i < 5; i++) {
      await solve(page);
      if (i === 4) await page.clock.setFixedTime(new Date(CLOCK.getTime() + LESSON_MS));
      await page.locator('.answer-button').click();
    }
    await page.locator('.summary').waitFor();
    // Points, badge and streak animations run on timers after the (mocked) save: run them out.
    await page.locator('.summary-streak-days').waitFor();
    await page.clock.runFor(10_000);
    await page.locator('.summary-streak-days.switched').waitFor();
    await page.clock.runFor(10_000);
  },
  'app-bar': async (page, lang) => {
    await home(page, lang);
    await openCourse(page, 'maths');
  },
  leaderboard: async (page, lang) => {
    await home(page, lang);
    await page.locator('.app-bar .bar-progress').click();
    await page.locator('.leaderboard-table').waitFor();
  },
};

/** PNG -> WebP in the browser (no extra tools): the best quality that stays under MAX_BYTES. */
async function toWebp(page, png) {
  for (const quality of [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5, 0.4]) {
    const data = await page.evaluate(
      async ([base64, q]) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return canvas.toDataURL('image/webp', q).split(',')[1];
      },
      [png.toString('base64'), quality],
    );
    const webp = Buffer.from(data, 'base64');
    if (webp.length <= MAX_BYTES) return { webp, quality };
  }
  throw new Error('could not get the screenshot under 60 KB');
}

const seedOf = (name) => [...name].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

async function shoot(browser, url, lang, name) {
  const context = await browser.newContext({
    baseURL: url,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'Europe/Bratislava',
  });
  try {
    await context.clock.install({ time: CLOCK });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    await page.addInitScript(initScript, seedOf(`${lang}:${name}`));
    await mockApi(page, { summary: name === 'summary' });
    await STEPS[name](page, lang);
    // Nothing hovered from the last tap; animations finished or paused.
    await page.mouse.move(0, 0);
    // No focus ring on a control left focused by the steps (QA224-02); an answer box the child
    // is typing in stays focused, as in real use.
    await page.evaluate(() => {
      const active = document.activeElement;
      if (active && active !== document.body && !active.matches('input, textarea')) active.blur();
    });
    await page.evaluate(settle);
    const png = await page.screenshot({ animations: 'disabled', caret: 'hide' });
    const { webp, quality } = await toWebp(page, png);
    const dir = join(args.out, lang);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.webp`), webp);
    return { lang, name, bytes: webp.length, quality };
  } finally {
    await context.close();
  }
}

const { server, url } = await serve(resolve(args.dist));
const browser = await chromium.launch();
const results = [];
try {
  for (const lang of args.langs.split(','))
    for (const name of args.shots.split(',')) {
      if (!STEPS[name]) throw new Error(`unknown screenshot ${name}`);
      const result = await shoot(browser, url, lang, name);
      results.push(result);
      console.log(
        `${lang}/${name}.webp  ${(result.bytes / 1024).toFixed(1)} KB  (quality ${result.quality})`,
      );
    }
} finally {
  await browser.close();
  server.close();
}
const total = results.reduce((sum, r) => sum + r.bytes, 0);
console.log(`${results.length} images, ${(total / 1024).toFixed(1)} KB in ${args.out}`);
