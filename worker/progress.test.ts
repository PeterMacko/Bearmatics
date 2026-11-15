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
    expect(await read(first)).toEqual({ points: 7, added: 7 });
    expect(await read(await finish(cookie, { lessonId: id, size: 10, points: 7 }))).toEqual({
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
