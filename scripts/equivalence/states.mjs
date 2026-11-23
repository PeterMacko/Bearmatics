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

const course = { small: 0, maths: 1, english: 2 };

/** Pages of the 200% text variants (see large()). */
const LARGE = new WeakSet();

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
  await page.locator('.course-option').nth(course[name]).click();
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
    await page.locator('.account-screen .profile-badge').waitFor();
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
for (const id of ['course', 'menu-maths', 'small1-lesson', 'in-maths1-summary', 'in-profile'])
  STATES[`${id}-200`] = large(STATES[id]);
