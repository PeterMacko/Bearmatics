// Screen states: how each one is reached with real controls. Selectors avoid visible text so
// the same steps work in English and Slovak.

/** Defined devices (Bearmatics test scope). touch = phone/tablet context like the e2e specs. */
export const DEVICES = [
  [390, 844, true],
  [360, 640, true],
  [320, 568, true],
  [369, 700, true],
  [844, 390, true],
  [568, 320, true],
  [820, 1180, true],
  [1180, 820, true],
  [884, 1004, true],
  [884, 838, true],
  [884, 600, true],
  [742, 702, true],
  [1280, 520, false],
  [733, 500, false],
  [1366, 900, false],
].map(([width, height, touch]) => ({ id: `${width}x${height}`, width, height, touch }));

/** --quick: one upright phone, one landscape phone, one desktop. */
export const QUICK = ['390x844', '844x390', '1366x900'];

export const LANGUAGES = ['en', 'sk'];

/** Fixed wall clock (streak days, lesson time) shared by both builds; run.mjs installs it. */
export const CLOCK = new Date('2026-06-15T09:00:00+02:00');
const CLOCK_TIME = CLOCK.getTime();

const ACCOUNT = {
  kind: 'password',
  username: 'kid',
  nickname: 'Brave Cub',
  look: { fur: 1, background: 1, head: 2, neck: 0, eyes: 0 },
  email: null,
};

/** Mocks /api so screens do not depend on a server: signed out, or signed in with progress. */
export async function mockApi(page, signedIn) {
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/me') return json({ account: signedIn ? ACCOUNT : null });
    if (!signedIn) return json({ error: 'unauthorized' }, 401);
    if (path === '/api/progress')
      return json({ points: 40, streak: 3, frozen: false, today: false });
    if (path === '/api/progress/lessons') return json({ lessonId: 'lesson-1' });
    if (path === '/api/progress/lessons/finish')
      return json({ points: 52, streak: 4, frozen: false, today: true, added: 12, offer: null });
    if (path === '/api/leaderboard')
      return json({
        rows: [
          {
            place: 1,
            nickname: 'Speedy Otter',
            look: { fur: 0, background: 0, head: 3, neck: 0, eyes: 0 },
            points: 960,
            streak: 12,
            frozen: false,
            me: false,
          },
          {
            place: 2,
            nickname: 'Quiet Fox',
            look: { fur: 3, background: 2, head: 0, neck: 3, eyes: 0 },
            points: 410,
            streak: 0,
            frozen: true,
            me: false,
          },
          {
            place: 7,
            nickname: ACCOUNT.nickname,
            bear: ACCOUNT.bear,
            points: 40,
            streak: 3,
            frozen: false,
            me: true,
          },
        ],
        gapBefore: 7,
      });
    return json({ available: false });
  });
}

/** Deterministic Math.random (mulberry32) and a word-audio stub that records the target. */
export function initScript(seed) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const played = [];
  window.__played = played;
  // Word audio: no real playback (timing would differ between runs); the word stays "playing".
  HTMLMediaElement.prototype.play = function () {
    played.push(decodeURIComponent(this.src.split('/').pop().replace('.mp3', '')));
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function () {};
  HTMLMediaElement.prototype.load = function () {};
}

// Course cards by class, not by position: the course choice gained Logic (2nd) and Word search
// (5th) after these states were written, and positions shifted every maths/English state.
const course = {
  small: '.course-small',
  logic: '.course-logic',
  maths: '.course-math',
  english: '.course-english',
  wordsearch: '.course-wordsearch',
};

/** Pages of the 200% text variants (see large()). */
const LARGE = new WeakSet();

/**
 * Pages whose fake clock is paused (see pause()). The capture must not wait for animation frames
 * there: requestAnimationFrame is part of the fake clock and would never fire.
 */
export const FROZEN = new WeakSet();

/**
 * Pauses the page's fake clock, so a screen that a timer would end (a Pexeso miss closing after
 * 1.5 s, the picture demo) stays as it is until the capture. Afterwards time only moves with
 * tick(); no timer fires on its own.
 */
async function pause(page) {
  const now = await page.evaluate(() => performance.now());
  await page.clock.pauseAt(new Date(CLOCK_TIME + Math.ceil(now) + 50));
  FROZEN.add(page);
}

/** Moves the fake clock on (runs due timers and frames): taps that wait out a guard time. */
const tick = (page, ms) => page.clock.runFor(ms);

async function home(page, lang) {
  await page.goto('/');
  // 200% text only once the document exists: an init script cannot style <html> in Chromium.
  if (LARGE.has(page)) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.locator('.course-option').first().waitFor();
  if (lang === 'sk') {
    await page.locator('.settings-button').click();
    await page.getByRole('button', { name: 'Slovenčina', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.locator('[role=dialog]').waitFor({ state: 'detached' });
  }
}

async function openCourse(page, name) {
  await page.locator(course[name]).click();
  await page.locator('.level-option').first().waitFor();
}

async function startLesson(page, name, levelIndex, size = 5) {
  await openCourse(page, name);
  await page.locator('.level-option').nth(levelIndex).click();
  await page
    .locator('.session-options label')
    .filter({ hasText: new RegExp(`^${size}\\b`) })
    .click();
  await page.locator('.start-button').click();
  await page.locator('.practice').waitFor();
}

/** The correct answer of the shown maths exercise, read from the equation like foundation.spec. */
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

async function type(page, value) {
  const box = page.locator('.equation input');
  if ((await box.getAttribute('readonly')) !== null)
    for (const digit of String(value))
      await page
        .locator('.number-pad button')
        .filter({ hasText: new RegExp(`^${digit}$`) })
        .click();
  else await box.fill(String(value));
  await page.locator('.answer-button').click();
}

async function solve(page) {
  await type(page, await answer(page));
  await page.locator('.feedback-correct').first().waitFor();
}

async function finishLesson(page, size = 5) {
  for (let i = 0; i < size; i++) {
    await solve(page);
    await page.locator('.answer-button').click();
  }
  await page.locator('.summary').waitFor();
}

/**
 * State id -> { signedIn, steps(page, lang) }. Each state starts in a fresh browser context.
 * Keep ids stable: they name the output files and the report rows.
 */
export const STATES = {
  course: { steps: home },
  settings: {
    async steps(page, lang) {
      await home(page, lang);
      await page.locator('.settings-button').click();
      await page.locator('[role=dialog]').waitFor();
    },
  },
  signin: {
    async steps(page, lang) {
      await home(page, lang);
      await page.locator('.account-button').click();
      await page.locator('.account-screen').waitFor();
    },
  },
  privacy: {
    async steps(page, lang) {
      await home(page, lang);
      await page.locator('.account-button').click();
      await page.locator('.account-screen .link-button').last().click();
      await page.locator('.account-screen .link-button').waitFor({ state: 'detached' });
    },
  },
  'menu-small': {
    async steps(page, lang) {
      await home(page, lang);
      await openCourse(page, 'small');
    },
  },
  'menu-maths': {
    async steps(page, lang) {
      await home(page, lang);
      await openCourse(page, 'maths');
    },
  },
  'menu-english': {
    async steps(page, lang) {
      await home(page, lang);
      await openCourse(page, 'english');
    },
  },
  'small1-lesson': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'small', 0);
    },
  },
  'small1-hint': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'small', 0);
      await page.locator('.hint-button').click();
      await page.locator('[role=dialog]').waitFor();
    },
  },
  'small1-wrong': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'small', 0);
      const right = await answer(page);
      await type(page, right === 1 ? 2 : right - 1);
      await page.locator('.feedback-incorrect').first().waitFor();
    },
  },
  'small1-correct': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'small', 0);
      await solve(page);
    },
  },
  'small2-lesson': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'small', 1);
    },
  },
  'small3-lesson': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'small', 2);
    },
  },
  'small3-solved': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'small', 2);
      await solve(page);
      await page.locator('.dice-pair').first().waitFor();
    },
  },
  'maths1-lesson': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'maths', 0);
    },
  },
  'maths1-leave': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'maths', 0);
      await solve(page);
      await page.locator('.back-button').click();
      await page.locator('.leave-dialog').waitFor();
    },
  },
  'english1-lesson': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'english', 0);
    },
  },
  'english1-chosen': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'english', 0);
      await page.locator('.word-option').first().click();
    },
  },
  'english3-write': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'english', 2);
      await page.locator('.write-input').waitFor();
    },
  },
  'english1-wrong': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'english', 0);
      const target = await page.evaluate(() => window.__played.at(-1));
      await page
        .locator('.word-option')
        .filter({ hasNotText: new RegExp(`^${target}$`) })
        .first()
        .click();
      await page.locator('.answer-button').click();
      await page.locator('.feedback-incorrect').waitFor();
    },
  },
  'english1-solved': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'english', 0);
      const target = await page.evaluate(() => window.__played.at(-1));
      await page
        .locator('.word-option')
        .filter({ hasText: new RegExp(`^${target}$`) })
        .click();
      await page.locator('.answer-button').click();
      await page.locator('.feedback-correct').waitFor();
    },
  },
  'english1-playfail': {
    async steps(page, lang) {
      await home(page, lang);
      // Word playback is blocked: the feedback line becomes the play-error alert.
      await page.evaluate(() => {
        HTMLMediaElement.prototype.play = () => Promise.reject(new Error('blocked'));
      });
      await startLesson(page, 'english', 0);
      await page.locator('.play-error').waitFor();
    },
  },
  'english3-wrong': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'english', 2);
      await page.locator('.write-input').fill('zzz');
      await page.locator('.answer-button').click();
      await page.locator('.write-wrong').waitFor();
    },
  },
  'english3-solved': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'english', 2);
      const target = await page.evaluate(() => window.__played.at(-1));
      await page.locator('.write-input').fill(target);
      await page.locator('.answer-button').click();
      await page.locator('.answer-button[data-state="correct"]').waitFor();
    },
  },
  'english3-playfail': {
    async steps(page, lang) {
      await home(page, lang);
      await page.evaluate(() => {
        HTMLMediaElement.prototype.play = () => Promise.reject(new Error('blocked'));
      });
      await startLesson(page, 'english', 2);
      await page.locator('.play-error').waitFor();
    },
  },
  'small1-summary': {
    async steps(page, lang) {
      await home(page, lang);
      await startLesson(page, 'small', 0);
      await finishLesson(page);
    },
  },
  'in-course': { signedIn: true, steps: signedInHome },
  'in-menu-maths': {
    signedIn: true,
    async steps(page, lang) {
      await signedInHome(page, lang);
      await openCourse(page, 'maths');
    },
  },
  'in-maths1-lesson': {
    signedIn: true,
    async steps(page, lang) {
      await signedInHome(page, lang);
      await startLesson(page, 'maths', 0);
    },
  },
  'in-maths1-summary': {
    signedIn: true,
    async steps(page, lang) {
      await signedInHome(page, lang);
      await startLesson(page, 'maths', 0);
      await finishLesson(page);
      // Points animation, streak count-up and badge chime run on timers that start only after
      // the (mocked) save answered: wait for the saved summary, then run the timers out.
      await page.locator('.summary-streak-days').waitFor();
      await page.clock.runFor(10_000);
      await page.locator('.summary-streak-days.switched').waitFor();
      await page.clock.runFor(10_000);
    },
  },
};

async function signedInHome(page, lang) {
  await home(page, lang);
  await page.locator('.streak-chip').waitFor();
}

STATES['in-profile'] = {
  signedIn: true,
  async steps(page, lang) {
    await signedInHome(page, lang);
    await page.locator('.account-button').click();
    // The profile (SCRUM-281) has no badge any more: its rows mark the screen.
    await page.locator('.profile-screen .profile-rows').waitFor();
  },
};
STATES['in-leaderboard'] = {
  signedIn: true,
  async steps(page, lang) {
    await signedInHome(page, lang);
    await page.locator('.app-bar .bar-progress').click();
    await page.locator('.leaderboard-table').waitFor();
  },
};

// ---------------------------------------------------------------------------------------------
// SCRUM-335 Wave 0: the screens added since refactoring round 1 (Logic, patterns, Pexeso, Word
// search, Bear picks, Dress your bear, the profile windows). Timers are moved on with tick() (the
// fake clock), never waited out, so every state ends in the same place in both builds.

/** Opens Logic and starts a level (1-8); Pexeso levels (6-8) have no exercise count. */
async function startLogic(page, level, size = 5) {
  await openCourse(page, 'logic');
  await page.locator(`.logic-home .level-${level}`).click();
  if (level < 6)
    await page
      .locator('.logic-home .session-options label')
      .filter({ hasText: new RegExp(`^${size}\\b`) })
      .click();
  await page.locator('.logic-home .start-button').click();
}

/**
 * Starts a bear path level (1 or 2) and runs the clock past the picture demo (reduced motion:
 * still steps for 4.5 s) and the "?" balloon of the first puzzle (3 s and its fade).
 */
async function startBearPath(page, level, size = 5) {
  await startLogic(page, level, size);
  await tick(page, 4_600);
  await page.locator('.logic-board').waitFor();
  await tick(page, 3_500);
}

/** Bear, honey and stones (0-based) from the board's accessible name (digits only). */
async function bearPuzzle(page) {
  const label = await page.locator('.logic-board').getAttribute('aria-label');
  const [bearRow, bearCol, honeyRow, honeyCol, ...rest] = label
    .match(/\d+/g)
    .map((n) => Number(n) - 1);
  const stones = [];
  for (let i = 0; i < rest.length; i += 2) stones.push([rest[i], rest[i + 1]]);
  return { bear: [bearRow, bearCol], honey: [honeyRow, honeyCol], stones };
}

const MOVES = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

/** Arrow selectors of the shortest way from the bear to the honey around the stones (4 x 4). */
async function wayToHoney(page) {
  const p = await bearPuzzle(page);
  const key = ([r, c]) => `${r},${c}`;
  const stones = new Set(p.stones.map(key));
  const queue = [[p.bear, []]];
  const seen = new Set([key(p.bear)]);
  while (queue.length) {
    const [cell, way] = queue.shift();
    for (const [name, [dr, dc]] of Object.entries(MOVES)) {
      const next = [cell[0] + dr, cell[1] + dc];
      if (next.some((n) => n < 0 || n > 3) || seen.has(key(next)) || stones.has(key(next)))
        continue;
      if (key(next) === key(p.honey)) return [...way, `.arrow-${name}`];
      seen.add(key(next));
      queue.push([next, [...way, `.arrow-${name}`]]);
    }
  }
  throw new Error('no way to the honey');
}

/** Plans the given arrows and presses Go; the walk runs out on the clock (400 ms a step). */
async function walk(page, arrows) {
  for (const arrow of arrows) await page.locator(arrow).click();
  await page.locator('.logic-go').click();
  await tick(page, 6_000);
  await page.locator('.logic-practice:not([data-walking])').waitFor();
}

async function solveBearPath(page) {
  await walk(page, await wayToHoney(page));
  await page.locator('.logic-practice[data-solved]').waitFor();
}

/** Plays a whole bear path lesson to its summary, every puzzle first try. */
async function finishBearPath(page, size = 5) {
  for (let i = 0; i < size; i++) {
    await solveBearPath(page);
    await page.locator('.logic-actions .answer-button:not(.logic-go)').click();
    await tick(page, 500);
  }
  await page.locator('.summary').waitFor();
}

/** Starts a pattern level (3-5) and runs the clock past its picture demo. */
async function startPatterns(page, level, size = 5) {
  await startLogic(page, level, size);
  await tick(page, 4_600);
  await page.locator('.pattern-choice:not([aria-disabled])').first().waitFor();
}

// Arrow names in both languages (the rows' accessible names), for the rule check below.
const ARROW_TURN = { up: 0, right: 1, down: 2, left: 3, nahor: 0, doprava: 1, nadol: 2, doľava: 3 };

/** Is `candidate` right for the "?" place (from the visible names, like the e2e helper)? */
function fits(names, gap, candidate) {
  const row = names.map((n, i) => (i === gap ? candidate.toLowerCase() : n.toLowerCase()));
  const arrows = row.map((n) => ARROW_TURN[n.split(' ').at(-1)]);
  if (arrows.every((a) => a !== undefined)) {
    const step = (arrows[1] - arrows[0] + 4) % 4;
    return (
      (step === 1 || step === 3) &&
      arrows.every((a, i) => i === 0 || (a - arrows[i - 1] + 4) % 4 === step)
    );
  }
  const counts = row.map((n) => Number(n.split(' ')[0]));
  if (counts.every((c) => Number.isInteger(c))) {
    const step = counts[1] - counts[0];
    return Math.abs(step) === 1 && counts.every((c, i) => i === 0 || c - counts[i - 1] === step);
  }
  for (let p = 2; p <= 4 && 2 * p <= row.length; p++)
    if (row.every((n, i) => i < p || n === row[i - p])) return true;
  return false;
}

async function solvePattern(page) {
  const names = (await page.locator('.pattern-row').getAttribute('aria-label')).split(', ');
  const gap = names.findIndex((n) => /^(question mark|otáznik)$/i.test(n));
  const choices = await page
    .locator('.pattern-choice')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const right = choices.map((c, i) => (fits(names, gap, c) ? i : -1)).filter((i) => i >= 0);
  if (right.length !== 1) throw new Error(`${right.length} right pattern choices`);
  await page.locator('.pattern-choice').nth(right[0]).click();
  await tick(page, 1_000);
  await page.locator('.pattern-actions .answer-button[data-state="correct"]').waitFor();
}

/** Starts a Pexeso level (6 / 7 / 8 = 6 / 10 / 15 pairs) past the board's 600 ms tap guard. */
async function startPexeso(page, level) {
  await startLogic(page, level);
  await page.locator('.pexeso-card').first().waitFor();
  await tick(page, 700);
}

/** Turns card i after the 300 ms between card taps; returns its picture (the face's markup). */
async function turnCard(page, i) {
  await tick(page, 320);
  await page.locator('.pexeso-card').nth(i).click();
  const card = page.locator('.pexeso-card').nth(i);
  if (!(await card.count())) return null; // the last pair: the summary replaced the board
  return card.locator('.pexeso-face').innerHTML();
}

/**
 * Plays from memory until `stop` says so after a turn (or the board is done): an unseen card,
 * then its seen partner or the next unseen card. A miss closes on the clock (1.5 s).
 */
async function playPexeso(page, stop = () => false) {
  const known = new Map();
  const found = new Set();
  const total = await page.locator('.pexeso-card').count();
  const partnerOf = (i) =>
    [...known.entries()].find(
      ([j, face]) => j !== i && !found.has(j) && face === known.get(i),
    )?.[0];
  const unseen = () =>
    Array.from({ length: total }, (_, i) => i).filter((i) => !known.has(i) && !found.has(i));
  while (found.size < total) {
    const pair = [...known.keys()].find((i) => !found.has(i) && partnerOf(i) !== undefined);
    const first = pair ?? unseen()[0];
    known.set(first, await turnCard(page, first));
    const second = partnerOf(first) ?? unseen()[0];
    const face = await turnCard(page, second);
    if (face === null) return;
    known.set(second, face);
    const kind = known.get(first) === face ? 'pair' : 'miss';
    if (kind === 'pair') found.add(first).add(second);
    if (stop(kind)) return;
    if (kind === 'miss') await tick(page, 1_600);
  }
}

const SEARCH_WORDS = [
  'seven',
  'ten',
  'blue',
  'pink',
  'red',
  'dog',
  'cat',
  'Suzy',
  'eleven',
  'book',
  'green',
  'desk',
  'yellow',
  'girl',
  'boy',
  'pencil',
  'ruler',
  'sister',
  'star',
  'grey',
];

/** Opens Word search and starts a level (1-3); 5 words = one grid. */
async function startSearch(page, level, size = 5) {
  await openCourse(page, 'wordsearch');
  await page
    .locator('.wordsearch-home .level-option')
    .nth(level - 1)
    .click();
  await page
    .locator('.wordsearch-home .session-options label')
    .filter({ hasText: new RegExp(`^${size}\\b`) })
    .click();
  await page.locator('.wordsearch-home .start-button').click();
  await page.locator('.ws-board').waitFor();
  await tick(page, 700);
}

/** The grid's words with their first and last cells (index 0-35), scanned in all 8 directions. */
async function gridWords(page) {
  const letters = await page.locator('.ws-cell').allTextContents();
  const at = (r, c) => (r >= 0 && r < 6 && c >= 0 && c < 6 ? letters[r * 6 + c] : '');
  const out = [];
  for (const word of SEARCH_WORDS) {
    const target = word.toUpperCase();
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++)
        for (const [dr, dc] of Object.values(MOVES).concat([
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ]))
          if ([...target].every((ch, i) => at(r + i * dr, c + i * dc) === ch))
            out.push({
              word: target,
              first: r * 6 + c,
              last: (r + (target.length - 1) * dr) * 6 + c + (target.length - 1) * dc,
            });
  }
  if (out.length !== 5) throw new Error(`${out.length} words found in the grid`);
  return out;
}

/** Taps the first, then the last letter of a word (the next tap after the tap guard). */
async function findWord(page, word) {
  await page.locator('.ws-cell').nth(word.first).click();
  await tick(page, 600);
  await page.locator('.ws-cell').nth(word.last).click();
  await tick(page, 700);
}

/** Signed in: waits for the saved summary and runs its count-ups and chime out. */
async function savedSummary(page) {
  await page.locator('.summary').waitFor();
  await page.locator('.summary-streak-days').waitFor();
  await tick(page, 10_000);
  await page.locator('.summary-streak-days.switched').waitFor();
  await tick(page, 10_000);
}

/** Signed in: the profile (account button). */
async function openProfile(page, lang) {
  await signedInHome(page, lang);
  await page.locator('.account-button').click();
  await page.locator('.profile-screen .profile-rows').waitFor();
}

/** A profile window, opened by its button; the window's 600 ms press guard runs out. */
function profileWindow(opener, name) {
  return {
    signedIn: true,
    async steps(page, lang) {
      await openProfile(page, lang);
      await page.locator(opener).click();
      await page.locator(`.profile-window-${name}`).waitFor();
      await tick(page, 700);
    },
  };
}

Object.assign(STATES, {
  'menu-logic': {
    async steps(page, lang) {
      await home(page, lang);
      await openCourse(page, 'logic');
    },
  },
  // The picture demo of a fresh device (not seen yet), reduced motion: three still steps. The
  // clock is paused so its 4.5 s end cannot come before the capture.
  'logic1-demo': {
    async steps(page, lang) {
      await home(page, lang);
      await openCourse(page, 'logic');
      await tick(page, 700);
      await pause(page);
      await page.locator('.logic-home .start-button').click();
      await page.locator('.logic-demo-still .demo-frame').nth(2).waitFor();
    },
  },
  'logic1-ready': {
    async steps(page, lang) {
      await home(page, lang);
      await startBearPath(page, 1);
    },
  },
  'logic1-planned': {
    async steps(page, lang) {
      await home(page, lang);
      await startBearPath(page, 1);
      for (const arrow of await wayToHoney(page)) await page.locator(arrow).click();
    },
  },
  // One arrow away from the bear, never onto the honey (it is 2-4 moves away): paw dot, retry.
  'logic1-wrong': {
    async steps(page, lang) {
      await home(page, lang);
      await startBearPath(page, 1);
      const { bear } = await bearPuzzle(page);
      await walk(page, [bear[1] < 3 ? '.arrow-right' : '.arrow-left']);
      await page.locator('.logic-go[data-state="incorrect"]').waitFor();
    },
  },
  'logic1-solved': {
    async steps(page, lang) {
      await home(page, lang);
      await startBearPath(page, 1);
      await solveBearPath(page);
    },
  },
  'logic1-summary': {
    async steps(page, lang) {
      await home(page, lang);
      await startBearPath(page, 1);
      await finishBearPath(page);
    },
  },
  'logic2-ready': {
    async steps(page, lang) {
      await home(page, lang);
      await startBearPath(page, 2);
    },
  },
  'logic2-solved': {
    async steps(page, lang) {
      await home(page, lang);
      await startBearPath(page, 2);
      await solveBearPath(page);
    },
  },
  'pattern3-ready': {
    async steps(page, lang) {
      await home(page, lang);
      await startPatterns(page, 3);
    },
  },
  'pattern3-solved': {
    async steps(page, lang) {
      await home(page, lang);
      await startPatterns(page, 3);
      await solvePattern(page);
    },
  },
  'pattern4-ready': {
    async steps(page, lang) {
      await home(page, lang);
      await startPatterns(page, 4);
    },
  },
  'pattern5-ready': {
    async steps(page, lang) {
      await home(page, lang);
      await startPatterns(page, 5);
    },
  },
  'pexeso6-board': {
    async steps(page, lang) {
      await home(page, lang);
      await startPexeso(page, 6);
    },
  },
  'pexeso7-board': {
    async steps(page, lang) {
      await home(page, lang);
      await startPexeso(page, 7);
    },
  },
  'pexeso8-board': {
    async steps(page, lang) {
      await home(page, lang);
      await startPexeso(page, 8);
    },
  },
  'pexeso6-open': {
    async steps(page, lang) {
      await home(page, lang);
      await startPexeso(page, 6);
      await turnCard(page, 0);
      await page.locator('.pexeso-card[data-state="open"]').waitFor();
    },
  },
  // Two different pictures face up: the clock is paused, so the 1.5 s close does not come.
  'pexeso6-miss': {
    async steps(page, lang) {
      await home(page, lang);
      await startPexeso(page, 6);
      await pause(page);
      await playPexeso(page, (kind) => kind === 'miss');
      await page.locator('.pexeso-card[data-state="open"]').nth(1).waitFor();
    },
  },
  'pexeso6-pair': {
    async steps(page, lang) {
      await home(page, lang);
      await startPexeso(page, 6);
      await playPexeso(page, (kind) => kind === 'pair');
      await tick(page, 1_000);
    },
  },
  'pexeso6-summary': {
    async steps(page, lang) {
      await home(page, lang);
      await startPexeso(page, 6);
      await playPexeso(page);
      await page.locator('.summary').waitFor();
      await tick(page, 3_000);
    },
  },
  'menu-wordsearch': {
    async steps(page, lang) {
      await home(page, lang);
      await openCourse(page, 'wordsearch');
    },
  },
  'ws1-ready': {
    async steps(page, lang) {
      await home(page, lang);
      await startSearch(page, 1);
    },
  },
  'ws2-ready': {
    async steps(page, lang) {
      await home(page, lang);
      await startSearch(page, 2);
    },
  },
  'ws3-ready': {
    async steps(page, lang) {
      await home(page, lang);
      await startSearch(page, 3);
    },
  },
  'ws1-marked': {
    async steps(page, lang) {
      await home(page, lang);
      await startSearch(page, 1);
      const [word] = await gridWords(page);
      await page.locator('.ws-cell').nth(word.first).click();
      await page.locator('.ws-cell[aria-pressed="true"]').waitFor();
    },
  },
  'ws1-found': {
    async steps(page, lang) {
      await home(page, lang);
      await startSearch(page, 1);
      const [word] = await gridWords(page);
      await findWord(page, word);
      await page.locator('.ws-cell[data-word]').first().waitFor();
    },
  },
  'ws2-found': {
    async steps(page, lang) {
      await home(page, lang);
      await startSearch(page, 2);
      const [word] = await gridWords(page);
      await findWord(page, word);
      await page.locator('.ws-revealed').waitFor();
    },
  },
  // Letters-in-order mode: on, and the first right letter of the word to spell chosen.
  'ws1-letters': {
    async steps(page, lang) {
      await home(page, lang);
      await startSearch(page, 1);
      // The switch shows only when focused (keyboard): focus it and press Enter.
      await page.locator('.ws-letters-toggle').focus();
      await page.locator('.ws-letters-toggle').press('Enter');
      const word = await page
        .locator('.ws-words li:not([data-found]) .ws-word')
        .first()
        .innerText();
      await page
        .locator('.ws-letter')
        .filter({ hasText: new RegExp(`^${word.trim()[0]}$`) })
        .click();
      await tick(page, 700);
    },
  },
  // Level 2 hides the word: the letters prompt has no word, only the speaker.
  'ws2-letters': {
    async steps(page, lang) {
      await home(page, lang);
      await startSearch(page, 2);
      // The switch shows only when focused (keyboard): focus it and press Enter.
      await page.locator('.ws-letters-toggle').focus();
      await page.locator('.ws-letters-toggle').press('Enter');
      await page.locator('.ws-letter-buttons').waitFor();
      await tick(page, 700);
    },
  },
  'ws1-solved': {
    async steps(page, lang) {
      await home(page, lang);
      await startSearch(page, 1);
      for (const word of await gridWords(page)) await findWord(page, word);
      await page.locator('.wordsearch-practice[data-solved]').waitFor();
      await tick(page, 1_000);
    },
  },
  'ws1-summary': {
    async steps(page, lang) {
      await home(page, lang);
      await startSearch(page, 1);
      for (const word of await gridWords(page)) await findWord(page, word);
      await page.locator('.ws-actions .answer-button').click();
      await page.locator('.summary').waitFor();
      await tick(page, 3_000);
    },
  },
  'picks-age': {
    async steps(page, lang) {
      await home(page, lang);
      await page.locator('.bear-picks-button').click();
      await page.locator('.pick-age').waitFor();
      await tick(page, 700);
    },
  },
  'picks-next': {
    async steps(page, lang) {
      await home(page, lang);
      await page.locator('.bear-picks-button').click();
      await tick(page, 700);
      await page.locator('.pick-age-button').nth(3).click();
      await page.locator('.pick-next').waitFor();
      await tick(page, 700);
    },
  },
  // A Maths game (Choose another by keyboard until one comes up), played to its summary.
  'picks-summary': {
    async steps(page, lang) {
      await home(page, lang);
      await page.locator('.bear-picks-button').click();
      await tick(page, 700);
      await page.locator('.pick-age-button').nth(3).click();
      await page.locator('.pick-next').waitFor();
      for (let i = 0; i < 50 && !(await page.locator('.pick-game.course-math').count()); i++)
        await page.locator('.pick-another').press('Enter');
      await tick(page, 700);
      await page.locator('.pick-game.course-math').waitFor();
      await page.locator('.pick-play').click();
      await page.locator('.practice').waitFor();
      await finishLesson(page);
      await tick(page, 3_000);
    },
  },
  'in-logic1-summary': {
    signedIn: true,
    async steps(page, lang) {
      await signedInHome(page, lang);
      await startBearPath(page, 1);
      await finishBearPath(page);
      await savedSummary(page);
    },
  },
  'in-pexeso6-summary': {
    signedIn: true,
    async steps(page, lang) {
      await signedInHome(page, lang);
      await startPexeso(page, 6);
      await playPexeso(page);
      await savedSummary(page);
    },
  },
  'in-ws1-summary': {
    signedIn: true,
    async steps(page, lang) {
      await signedInHome(page, lang);
      await startSearch(page, 1);
      for (const word of await gridWords(page)) await findWord(page, word);
      await page.locator('.ws-actions .answer-button').click();
      await savedSummary(page);
    },
  },
  'in-dress': {
    signedIn: true,
    async steps(page, lang) {
      await openProfile(page, lang);
      await page.locator('.profile-dress').click();
      await page.locator('.dress-screen').waitFor();
      await tick(page, 700);
    },
  },
  'in-window-nickname': profileWindow('.profile-row:nth-child(1) .profile-edit', 'nickname'),
  'in-window-email': profileWindow('.profile-row:nth-child(2) .profile-edit', 'email'),
  'in-window-leaderboard': profileWindow('.profile-row:nth-child(3) .profile-edit', 'leaderboard'),
  'in-window-password': profileWindow(
    '.profile-buttons .secondary-button:nth-of-type(1)',
    'password',
  ),
  // The grown-up question (sign out and delete account ask it; seeded numbers).
  'in-window-sign-out': profileWindow(
    '.profile-buttons .secondary-button:nth-of-type(2)',
    'sign-out',
  ),
  'in-window-delete': profileWindow('.profile-buttons .danger-button', 'delete'),
  'in-bear-full': {
    signedIn: true,
    async steps(page, lang) {
      await openProfile(page, lang);
      await page.locator('.profile-bear-button').click();
      await page.locator('.bear-full').waitFor();
      await tick(page, 700);
    },
  },
});

/** The same state with the page text at 200% (browser text-size setting). */
function large(state) {
  return {
    ...state,
    async steps(page, lang) {
      LARGE.add(page);
      await state.steps(page, lang);
    },
  };
}
for (const id of [
  'course',
  'menu-maths',
  'small1-lesson',
  'in-maths1-summary',
  'in-profile',
  // SCRUM-335 Wave 0
  'logic1-ready',
  'pexeso8-board',
  'ws3-ready',
  'in-dress',
  'in-window-nickname',
])
  STATES[`${id}-200`] = large(STATES[id]);
