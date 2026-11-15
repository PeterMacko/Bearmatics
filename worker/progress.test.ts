// SCRUM-117 points against a real local D1: limits, counting once, deletion.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from './accounts';
import { handleApi, type Env } from './api';
import { freshDb } from './testDb';

const ORIGIN = 'https://bearmatics.test';
let db: Awaited<ReturnType<typeof freshDb>>;
let env: Env;

beforeAll(async () => {
  db = await freshDb();
  env = { DB: db.DB };
}, 60_000);
afterAll(() => db?.dispose());

// oxlint-disable-next-line typescript/no-explicit-any -- test responses are checked by value
const read = (response: Response): Promise<any> => response.json();

function api(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; origin?: string | null } = {},
) {
  const headers = new Headers();
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  if (init.cookie) headers.set('cookie', init.cookie);
  const method = init.method ?? (init.body !== undefined ? 'POST' : 'GET');
  if (method !== 'GET' && init.origin !== null) headers.set('origin', init.origin ?? ORIGIN);
  return handleApi(
    new Request(`${ORIGIN}${path}`, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    env,
  );
}

let users = 0;
async function newPlayer(): Promise<string> {
  users++;
  const response = await api('/api/auth/signup', {
    body: {
      username: `player${users}x`,
      key: 'ab'.repeat(32),
      nickname: 'Bear',
      bear: 1,
      parentConfirmed: true,
    },
  });
  expect(response.status).toBe(201);
  const match = new RegExp(`${SESSION_COOKIE}=([0-9a-f]+)`).exec(
    response.headers.get('set-cookie') ?? '',
  );
  return `${SESSION_COOKIE}=${match![1]}`;
}

const start = (cookie: string, size: unknown = 10) =>
  api('/api/progress/lessons', { body: { size }, cookie });
const finish = (cookie: string, body: Record<string, unknown>) =>
  api('/api/progress/lessons/finish', { body, cookie });
const total = async (cookie: string) => (await read(await api('/api/progress', { cookie }))).points;

async function lesson(cookie: string, size = 10): Promise<string> {
  const response = await start(cookie, size);
  expect(response.status).toBe(201);
  return (await read(response)).lessonId;
}

describe('points (SCRUM-117)', () => {
  it('needs a signed-in player', async () => {
    expect((await api('/api/progress')).status).toBe(401);
    expect((await api('/api/progress/lessons', { body: { size: 10 } })).status).toBe(401);
    expect(
      (await api('/api/progress/lessons/finish', { body: { lessonId: 'a'.repeat(32) } })).status,
    ).toBe(401);
  });

  it('starts at 0 and adds the points of a finished lesson once', async () => {
    const cookie = await newPlayer();
    expect(await total(cookie)).toBe(0);
    const id = await lesson(cookie);
    const first = await finish(cookie, { lessonId: id, size: 10, points: 7 });
    expect(first.status).toBe(200);
    expect(await read(first)).toMatchObject({ points: 7, added: 7 });
    expect(await read(await finish(cookie, { lessonId: id, size: 10, points: 7 }))).toMatchObject({
      points: 7,
      added: 0,
    });
    const second = await lesson(cookie, 5);
    await finish(cookie, { lessonId: second, size: 5, points: 5 });
    expect(await total(cookie)).toBe(12);
  });

  it('counts parallel saves of one lesson once', async () => {
    const cookie = await newPlayer();
    const id = await lesson(cookie, 20);
    const replies = await Promise.all(
      Array.from({ length: 12 }, () => finish(cookie, { lessonId: id, size: 20, points: 20 })),
    );
    const added = (await Promise.all(replies.map(read))).map((r) => r.added);
    expect(added.filter((n) => n === 20)).toHaveLength(1);
    expect(await total(cookie)).toBe(20);
  });

  it('rejects more points than the lesson size, wrong sizes and unknown lessons', async () => {
    const cookie = await newPlayer();
    const id = await lesson(cookie, 5);
    for (const body of [
      { lessonId: id, size: 5, points: 6 },
      { lessonId: id, size: 5, points: -1 },
      { lessonId: id, size: 5, points: 2.5 },
      { lessonId: id, size: 5, points: '5' },
      { lessonId: id, size: 10, points: 6 },
      { lessonId: id, size: 7, points: 1 },
      { lessonId: 'nope', size: 5, points: 1 },
    ])
      expect((await finish(cookie, body)).status, JSON.stringify(body)).toBe(400);
    expect((await start(cookie, 7)).status).toBe(400);
    expect((await start(cookie, '10')).status).toBe(400);
    expect((await finish(cookie, { lessonId: 'f'.repeat(32), size: 5, points: 1 })).status).toBe(
      404,
    );
    expect(await total(cookie)).toBe(0);
  });

  it("never counts another player's lesson", async () => {
    const owner = await newPlayer();
    const other = await newPlayer();
    const id = await lesson(owner);
    expect((await finish(other, { lessonId: id, size: 10, points: 10 })).status).toBe(404);
    expect(await total(other)).toBe(0);
  });

  it('only counts lessons started in the last 2 days, and forgets older lesson IDs', async () => {
    const cookie = await newPlayer();
    const id = await lesson(cookie);
    await env.DB.prepare('UPDATE lessons SET started_at = ? WHERE id = ?')
      .bind(Date.now() - 2 * 24 * 60 * 60 * 1000 - 1000, id)
      .run();
    expect((await finish(cookie, { lessonId: id, size: 10, points: 3 })).status).toBe(404);
    await lesson(cookie); // a new start clears expired lesson IDs
    expect(await env.DB.prepare('SELECT 1 FROM lessons WHERE id = ?').bind(id).first()).toBeNull();
  });

  it('needs our own Origin for writes', async () => {
    const cookie = await newPlayer();
    const forged = await api('/api/progress/lessons', {
      body: { size: 10 },
      cookie,
      origin: 'https://evil.test',
    });
    expect(forged.status).toBe(403);
  });

  it('deleting the account removes its points and lesson IDs', async () => {
    const cookie = await newPlayer();
    const id = await lesson(cookie);
    await finish(cookie, { lessonId: id, size: 10, points: 4 });
    await lesson(cookie);
    const accountId = (await env.DB.prepare(
      'SELECT account_id FROM progress p JOIN lessons l USING (account_id) WHERE l.id = ?',
    )
      .bind(id)
      .first<{ account_id: string }>())!.account_id;
    expect((await api('/api/me', { method: 'DELETE', body: {}, cookie })).status).toBe(200);
    for (const table of ['progress', 'lessons'])
      expect(
        await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE account_id = ?`)
          .bind(accountId)
          .first('n'),
      ).toBe(0);
  });
});

describe('account deleted while a points request runs (QA124 OBS-1)', () => {
  // The session was valid when read, then the account is deleted (another device) before the
  // write: the foreign key fails. That is "not signed in" (401), not a server error.
  async function racing(cookie: string, sqlStart: string) {
    const accountId = (await env.DB.prepare('SELECT id FROM accounts WHERE username = ?')
      .bind(`player${users}x`)
      .first<{ id: string }>())!.id;
    let armed = false;
    const real = env.DB;
    const db = Object.create(real) as D1Database;
    db.prepare = (sql: string) => {
      if (sql.trim().startsWith(sqlStart)) armed = true;
      return real.prepare(sql);
    };
    db.batch = async (statements) => {
      if (armed) {
        armed = false;
        await real.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();
      }
      return real.batch(statements);
    };
    return { db, cookie };
  }

  it('lesson start answers 401', async () => {
    const cookie = await newPlayer();
    const { db } = await racing(cookie, 'INSERT INTO lessons');
    const saved = env;
    env = { DB: db };
    try {
      const response = await start(cookie, 10);
      expect(response.status).toBe(401);
      expect(await read(response)).toEqual({ error: 'not_signed_in' });
    } finally {
      for (const table of ['lessons', 'progress'])
        expect(
          await env.DB.prepare(
            `SELECT COUNT(*) AS n FROM ${table} WHERE account_id NOT IN (SELECT id FROM accounts)`,
          ).first('n'),
        ).toBe(0);
      env = saved;
    }
  });

  it('lesson finish answers 401', async () => {
    const cookie = await newPlayer();
    const id = await lesson(cookie, 10);
    const { db } = await racing(cookie, 'INSERT INTO progress');
    const saved = env;
    env = { DB: db };
    try {
      const response = await finish(cookie, { lessonId: id, size: 10, points: 3 });
      expect(response.status).toBe(401);
    } finally {
      env = saved;
    }
    for (const table of ['lessons', 'progress'])
      expect(
        await env.DB.prepare(
          `SELECT COUNT(*) AS n FROM ${table} WHERE account_id NOT IN (SELECT id FROM accounts)`,
        ).first('n'),
      ).toBe(0);
  });
});

describe('streak (SCRUM-118) through the API', () => {
  const day = (offset: number) => {
    const ms = Date.now() + offset * 86_400_000;
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava' }).format(ms);
  };
  async function accountOf(cookie: string) {
    void cookie;
    return (await env.DB.prepare('SELECT id FROM accounts WHERE username = ?')
      .bind(`player${users}x`)
      .first<{ id: string }>())!.id;
  }
  const setRow = (id: string, points: number, streak: number, lastDay: string | null) =>
    env.DB.prepare(
      'UPDATE progress SET points = ?, streak = ?, last_day = ?, offer_day = NULL WHERE account_id = ?',
    )
      .bind(points, streak, lastDay, id)
      .run();
  const play = async (cookie: string, points = 5) => {
    const id = await lesson(cookie, 5);
    return read(await finish(cookie, { lessonId: id, size: 5, points }));
  };
  const answer = (cookie: string, body: Record<string, unknown>) =>
    api('/api/progress/streak', { body, cookie });

  it('first lesson -> streak 1; same day again -> still 1; saved twice -> once', async () => {
    const cookie = await newPlayer();
    expect(await read(await api('/api/progress', { cookie }))).toEqual({
      points: 0,
      streak: 0,
      frozen: false,
    });
    const id = await lesson(cookie, 5);
    expect(await read(await finish(cookie, { lessonId: id, size: 5, points: 5 }))).toEqual({
      points: 5,
      streak: 1,
      frozen: false,
      added: 5,
      offer: null,
    });
    expect(await read(await finish(cookie, { lessonId: id, size: 5, points: 5 }))).toMatchObject({
      streak: 1,
      added: 0,
    });
    expect(await play(cookie)).toMatchObject({ points: 10, streak: 1 });
  });

  it('yesterday -> +1; the example: 12 days, 2 missed, 140 points -> cost 14, Yes -> 126 / 13', async () => {
    const cookie = await newPlayer();
    await play(cookie, 0);
    const id = await accountOf(cookie);
    await setRow(id, 10, 4, day(-1));
    expect(await play(cookie)).toMatchObject({ streak: 5, frozen: false, offer: null });
    await setRow(id, 135, 12, day(-3));
    expect(await read(await api('/api/progress', { cookie }))).toMatchObject({
      streak: 12,
      frozen: true,
    });
    const offered = await play(cookie, 5);
    expect(offered).toMatchObject({ points: 140, streak: 12, frozen: true });
    expect(offered.offer).toEqual({ streak: 12, missed: 2, cost: 14 });
    // Wrong price (it changed meanwhile) -> the new offer, nothing paid.
    const changed = await answer(cookie, { unlock: true, cost: 10 });
    expect(changed.status).toBe(409);
    expect(await read(changed)).toMatchObject({ error: 'offer_changed', offer: { cost: 14 } });
    const yes = await answer(cookie, { unlock: true, cost: 14 });
    expect(yes.status).toBe(200);
    expect(await read(yes)).toEqual({ points: 126, streak: 13, frozen: false });
    // Answered: no second payment.
    expect((await answer(cookie, { unlock: true, cost: 14 })).status).toBe(409);
    expect(await play(cookie, 0)).toMatchObject({ points: 126, streak: 13, offer: null });
  });

  it('No thanks -> 1; 8 missed -> 1 without offer; 0 points -> 1', async () => {
    const cookie = await newPlayer();
    await play(cookie, 0);
    const id = await accountOf(cookie);
    await setRow(id, 50, 6, day(-2));
    expect((await play(cookie)).offer).toEqual({ streak: 6, missed: 1, cost: 5 });
    expect(await read(await answer(cookie, { unlock: false }))).toEqual({
      points: 55,
      streak: 1,
      frozen: false,
    });
    await setRow(id, 50, 6, day(-9));
    expect(await play(cookie)).toMatchObject({ streak: 1, offer: null });
    await setRow(id, 0, 6, day(-2));
    expect(await play(cookie, 0)).toMatchObject({ streak: 1, offer: null });
  });

  it('an unanswered offer comes back after the next lesson the same day', async () => {
    const cookie = await newPlayer();
    await play(cookie, 0);
    const id = await accountOf(cookie);
    await setRow(id, 100, 3, day(-3));
    // Cost from the points after each lesson: min(20, 10% of 105 / 110).
    expect((await play(cookie, 5)).offer).toEqual({ streak: 3, missed: 2, cost: 10 });
    expect((await play(cookie, 5)).offer).toEqual({ streak: 3, missed: 2, cost: 11 });
  });

  it('parallel lessons on a new day add one day only', async () => {
    const cookie = await newPlayer();
    await play(cookie, 0);
    const id = await accountOf(cookie);
    await setRow(id, 10, 4, day(-1));
    const ids = await Promise.all(Array.from({ length: 6 }, () => lesson(cookie, 5)));
    await Promise.all(ids.map((lessonId) => finish(cookie, { lessonId, size: 5, points: 1 })));
    expect(await read(await api('/api/progress', { cookie }))).toEqual({
      points: 16,
      streak: 5,
      frozen: false,
    });
  });

  it('answer needs a signed-in player, our Origin and a boolean', async () => {
    expect((await api('/api/progress/streak', { body: { unlock: true } })).status).toBe(401);
    const cookie = await newPlayer();
    expect((await answer(cookie, { unlock: 'yes' })).status).toBe(400);
    expect(
      (
        await api('/api/progress/streak', {
          body: { unlock: false },
          cookie,
          origin: 'https://evil.test',
        })
      ).status,
    ).toBe(403);
    expect((await answer(cookie, { unlock: false })).status).toBe(409);
  });
});
