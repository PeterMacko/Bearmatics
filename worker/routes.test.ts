// CR-20 guard: every /api route answered for each session state, recorded as a snapshot.
// Status, headers (incl. every set-cookie) and body must stay exactly the same across refactors
// of the session/limit plumbing. Random values (tokens, IDs) are replaced by placeholders.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from './accounts';
import { handleApi, type Env } from './api';
import { randomHex, sha256Hex } from './crypto';
import { slovakDay } from './streak';
import { freshDb } from './testDb';

const ORIGIN = 'https://bearmatics.test';
const DAY_MS = 24 * 60 * 60 * 1000;
let db: Awaited<ReturnType<typeof freshDb>>;
let env: Env;

beforeAll(async () => {
  db = await freshDb();
  env = { DB: db.DB };
}, 60_000);
afterAll(() => db?.dispose());

const key = (n: number) => n.toString(16).padStart(2, '0').repeat(32);
const hide = (text: string) =>
  text
    .replace(/[0-9a-f]{32}\.[0-9a-f]{64}/g, '<hex32.hex64>')
    .replace(/[0-9a-f]{64}/g, '<hex64>')
    .replace(/[0-9a-f]{32}/g, '<hex32>')
    .replace(/code_challenge=[^&]+/g, 'code_challenge=<challenge>')
    // SCRUM-202: progress answers carry today's Slovak day.
    .replace(/"day":"\d{4}-\d{2}-\d{2}"/g, '"day":"<day>"');

type Init = { method?: string; body?: unknown; cookie?: string; origin?: string | null };

function request(path: string, init: Init = {}) {
  const headers = new Headers();
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  if (init.cookie) headers.set('cookie', init.cookie);
  const method = init.method ?? (init.body !== undefined ? 'POST' : 'GET');
  if (method !== 'GET' && method !== 'HEAD' && init.origin !== null)
    headers.set('origin', init.origin ?? ORIGIN);
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** Everything the browser can see of an answer, with random values hidden. */
async function record(response: Response) {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') headers[name] = hide(value);
  });
  const text = await response.text();
  return {
    status: response.status,
    headers,
    setCookie: response.headers.getSetCookie().map(hide),
    body: hide(text),
  };
}

const call = async (path: string, init: Init = {}, e: Env = env) =>
  record(await handleApi(request(path, init), e));

let users = 0;
/** A new password account; returns its session cookie and id. */
async function player() {
  users++;
  const username = `route${users}x`;
  const response = await handleApi(
    request('/api/auth/signup', {
      body: { username, key: key(1), nickname: 'Little Bear', bear: 2, parentConfirmed: true },
    }),
    env,
  );
  expect(response.status).toBe(201);
  const token = new RegExp(`${SESSION_COOKIE}=([0-9a-f]+)`).exec(
    response.headers.get('set-cookie') ?? '',
  )![1];
  const { id } = (await env.DB.prepare('SELECT id FROM accounts WHERE username = ?')
    .bind(username)
    .first<{ id: string }>())!;
  return { cookie: `${SESSION_COOKIE}=${token}`, id, username };
}

/** A session row that exists but has run out. */
async function expiredCookie() {
  const { id } = await player();
  const token = randomHex(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(token), id, Date.now() - 1000)
    .run();
  return `${SESSION_COOKIE}=${token}`;
}

type State = 'signed out' | 'expired' | 'unknown token' | 'malformed token' | 'valid';
const STATES: State[] = ['signed out', 'expired', 'unknown token', 'malformed token', 'valid'];

async function cookieFor(state: State) {
  if (state === 'signed out') return { cookie: undefined };
  if (state === 'expired') return { cookie: await expiredCookie() };
  if (state === 'unknown token') return { cookie: `${SESSION_COOKIE}=${randomHex(32)}` };
  if (state === 'malformed token') return { cookie: `${SESSION_COOKIE}=not-a-token` };
  return player();
}

type Setup = { cookie?: string; id?: string; username?: string };
type Case = {
  name: string;
  path: string;
  method: string;
  /** Request body; may depend on the signed-in player (prepared first). */
  body?: (s: Setup) => Promise<unknown> | unknown;
};

const day = (offset: number) => slovakDay(Date.now() + offset * DAY_MS);

/** Every route and method of the route table, with a body that succeeds when signed in. */
const CASES: Case[] = [
  { name: 'health', path: '/api/health', method: 'GET' },
  { name: 'health HEAD', path: '/api/health', method: 'HEAD' },
  { name: 'me', path: '/api/me', method: 'GET' },
  { name: 'me HEAD', path: '/api/me', method: 'HEAD' },
  {
    name: 'update profile',
    path: '/api/me',
    method: 'PATCH',
    body: () => ({ nickname: 'New  Name', bear: 4, email: 'p@example.com', leaderboard: false }),
  },
  { name: 'delete account', path: '/api/me', method: 'DELETE' },
  {
    name: 'change password',
    path: '/api/me/password',
    method: 'POST',
    body: () => ({ currentKey: key(1), newKey: key(2) }),
  },
  { name: 'progress', path: '/api/progress', method: 'GET' },
  { name: 'progress HEAD', path: '/api/progress', method: 'HEAD' },
  {
    name: 'start lesson',
    path: '/api/progress/lessons',
    method: 'POST',
    body: () => ({ size: 5 }),
  },
  {
    name: 'finish lesson',
    path: '/api/progress/lessons/finish',
    method: 'POST',
    body: async (s) => {
      let lessonId = 'ab'.repeat(16);
      if (s.cookie && s.id) {
        const started = await handleApi(
          request('/api/progress/lessons', { body: { size: 5 }, cookie: s.cookie }),
          env,
        );
        if (started.status === 201) lessonId = ((await started.json()) as never)['lessonId'];
      }
      return { lessonId, size: 5, points: 3 };
    },
  },
  {
    name: 'answer streak (unlock)',
    path: '/api/progress/streak',
    method: 'POST',
    body: async (s) => {
      if (s.id) {
        // A frozen streak with today's open offer: 2 missed days, 100 points -> cost 10.
        await env.DB.prepare(
          `INSERT INTO progress (account_id, points, streak, last_day, offer_day)
           VALUES (?, 100, 4, ?, ?)`,
        )
          .bind(s.id, day(-3), day(0))
          .run();
      }
      return { unlock: true, cost: 10 };
    },
  },
  { name: 'leaderboard', path: '/api/leaderboard', method: 'GET' },
  { name: 'leaderboard HEAD', path: '/api/leaderboard', method: 'HEAD' },
  {
    name: 'sign up',
    path: '/api/auth/signup',
    method: 'POST',
    body: () => ({
      username: `signup${++users}x`,
      key: key(3),
      nickname: 'Cub',
      bear: 5,
      parentConfirmed: true,
    }),
  },
  {
    name: 'sign in',
    path: '/api/auth/signin',
    method: 'POST',
    body: async () => ({ username: (await player()).username, key: key(1) }),
  },
  { name: 'sign out', path: '/api/auth/signout', method: 'POST', body: () => ({}) },
  { name: 'google available', path: '/api/auth/google', method: 'GET' },
  { name: 'google start', path: '/api/auth/google/start', method: 'GET' },
  { name: 'google callback', path: '/api/auth/google/callback?code=c&state=s', method: 'GET' },
  {
    name: 'google complete',
    path: '/api/auth/google/complete',
    method: 'POST',
    body: () => ({ nickname: 'Cub', bear: 1, parentConfirmed: true }),
  },
];

describe('every /api route in every session state', () => {
  for (const c of CASES) {
    for (const state of STATES) {
      it(`${c.method} ${c.name}: ${state}`, async () => {
        const setup: Setup = await cookieFor(state);
        const body = c.body ? await c.body(setup) : undefined;
        expect(
          await call(c.path, { method: c.method, body, cookie: setup.cookie }),
        ).toMatchSnapshot();
      });
    }
  }
});

describe('write routes with a bad body, per session state', () => {
  const writes = CASES.filter((c) => c.method !== 'GET' && c.method !== 'HEAD');
  for (const c of writes) {
    for (const state of ['signed out', 'valid'] as const) {
      it(`${c.method} ${c.name}: invalid JSON fields, ${state}`, async () => {
        const setup = await cookieFor(state);
        expect(
          await call(c.path, {
            method: c.method,
            body: { size: 7, key: 'x', username: '!', nickname: '', bear: 99, unlock: 'x' },
            cookie: setup.cookie,
          }),
        ).toMatchSnapshot();
        // Not JSON at all.
        const r = request(c.path, { method: c.method, cookie: setup.cookie });
        expect(await record(await handleApi(r, env))).toMatchSnapshot();
      });
      it(`${c.method} ${c.name}: foreign origin, ${state}`, async () => {
        const setup = await cookieFor(state);
        expect(
          await call(c.path, {
            method: c.method,
            body: {},
            cookie: setup.cookie,
            origin: 'https://evil.test',
          }),
        ).toMatchSnapshot();
      });
    }
  }
});

describe('other answers of signed-in routes', () => {
  it('unknown route, unknown method', async () => {
    expect(await call('/api/nope')).toMatchSnapshot();
    expect(await call('/api/me', { method: 'PUT', body: {} })).toMatchSnapshot();
    expect(await call('/api/progress', { method: 'POST', body: {} })).toMatchSnapshot();
  });

  it('sign-in attempt limit: 5 wrong tries, then even the right key is locked', async () => {
    const { username } = await player();
    const answers = [];
    for (let i = 0; i < 6; i++)
      answers.push(await call('/api/auth/signin', { body: { username, key: key(9) } }));
    answers.push(await call('/api/auth/signin', { body: { username, key: key(1) } }));
    // Unknown and malformed user names answer the same way.
    for (const name of ['nobody77', '??'])
      answers.push(await call('/api/auth/signin', { body: { username: name, key: key(9) } }));
    expect(answers).toMatchSnapshot();
  });

  it('password change attempt limit with a valid session', async () => {
    const { cookie } = await player();
    const answers = [];
    for (let i = 0; i < 6; i++)
      answers.push(
        await call('/api/me/password', { body: { currentKey: key(9), newKey: key(2) }, cookie }),
      );
    answers.push(
      await call('/api/me/password', { body: { currentKey: key(1), newKey: key(2) }, cookie }),
    );
    expect(answers).toMatchSnapshot();
  });

  it('password change for a Google-less password account after success keeps this session', async () => {
    const { cookie } = await player();
    const changed = await call('/api/me/password', {
      body: { currentKey: key(1), newKey: key(2) },
      cookie,
    });
    expect([changed, await call('/api/me', { cookie })]).toMatchSnapshot();
  });

  it('streak: no offer, changed price, answer No', async () => {
    const { cookie, id } = await player();
    const answers = [await call('/api/progress/streak', { body: { unlock: false }, cookie })];
    await env.DB.prepare(
      `INSERT INTO progress (account_id, points, streak, last_day, offer_day)
       VALUES (?, 100, 4, ?, ?)`,
    )
      .bind(id, day(-3), day(0))
      .run();
    answers.push(await call('/api/progress/streak', { body: { unlock: true, cost: 3 }, cookie }));
    answers.push(await call('/api/progress/streak', { body: { unlock: false }, cookie }));
    expect(answers).toMatchSnapshot();
  });

  it('finish: unknown lesson, size mismatch, repeated save, frozen-streak offer', async () => {
    const { cookie, id } = await player();
    const start = async () =>
      (
        (await (
          await handleApi(request('/api/progress/lessons', { body: { size: 10 }, cookie }), env)
        ).json()) as { lessonId: string }
      ).lessonId;
    const finish = (lessonId: string, size = 10, points = 4) =>
      call('/api/progress/lessons/finish', { body: { lessonId, size, points }, cookie });
    const answers = [await finish('cd'.repeat(16))];
    const lesson = await start();
    answers.push(await finish(lesson, 5));
    answers.push(await finish(lesson, 10, 16)); // SCRUM-202: at most ceil(1.5 x 10) = 15
    answers.push(await finish(lesson));
    answers.push(await finish(lesson));
    // Next lesson after a 3-day break: an unlock offer.
    await env.DB.prepare('UPDATE progress SET last_day = ? WHERE account_id = ?')
      .bind(day(-3), id)
      .run();
    answers.push(await finish(await start()));
    answers.push(await call('/api/progress', { cookie }));
    expect(answers).toMatchSnapshot();
  });

  it('account deleted while starting or finishing a lesson (other device)', async () => {
    const answers = [];
    for (const [sqlStart, route] of [
      ['INSERT INTO lessons', 'start'],
      ['UPDATE lessons', 'finish'],
    ] as const) {
      const { cookie, id } = await player();
      const lessonId = (
        (await (
          await handleApi(request('/api/progress/lessons', { body: { size: 5 }, cookie }), env)
        ).json()) as { lessonId: string }
      ).lessonId;
      let armed = false;
      const real = env.DB;
      const racing = Object.create(real) as D1Database;
      racing.prepare = (sql: string) => {
        if (sql.trim().startsWith(sqlStart)) armed = true;
        return real.prepare(sql);
      };
      racing.batch = async (statements) => {
        if (armed) {
          armed = false;
          await real.prepare('DELETE FROM accounts WHERE id = ?').bind(id).run();
        }
        return real.batch(statements);
      };
      answers.push(
        route === 'start'
          ? await call('/api/progress/lessons', { body: { size: 5 }, cookie }, { DB: racing })
          : await call(
              '/api/progress/lessons/finish',
              { body: { lessonId, size: 5, points: 2 }, cookie },
              { DB: racing },
            ),
      );
    }
    expect(answers).toMatchSnapshot();
  });

  it('Google configured: start, callback without state cookie, complete without pending', async () => {
    const google: Env = { DB: env.DB, GOOGLE_CLIENT_ID: 'id-1', GOOGLE_CLIENT_SECRET: 'secret' };
    expect([
      await call('/api/auth/google', {}, google),
      await call('/api/auth/google/start', {}, google),
      await call('/api/auth/google/callback?code=c&state=s', {}, google),
      await call(
        '/api/auth/google/complete',
        { body: { nickname: 'Cub', bear: 1, parentConfirmed: true } },
        google,
      ),
    ]).toMatchSnapshot();
  });
});
