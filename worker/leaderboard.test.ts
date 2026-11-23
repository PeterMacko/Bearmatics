// SCRUM-148 rows and order with fixed data (AC 2) and the API (AC 3-5).
import { OLD_BEARS } from '../shared/bearLook';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from './accounts';
import { type Env } from './api';
import { leaderboardRows, type Player } from './leaderboard';
import { apiCaller, read } from './testApi';
import { freshDb } from './testDb';

const p = (id: string, points: number, streak = 0, nickname = id): Player => ({
  id,
  nickname,
  look: { fur: 0, background: 0, head: 0, neck: 0, eyes: 0 },
  points,
  streak,
  frozen: false,
});
const view = (players: Player[], me: string | null) => {
  const { rows, gapBefore } = leaderboardRows(players, me);
  return {
    rows: rows.map((r) => `${r.place}:${r.nickname}${r.me ? '*' : ''}`),
    gapBefore,
  };
};

describe('rows and order (fixed data)', () => {
  const many = Array.from({ length: 15 }, (_, i) =>
    p(`P${String(i + 1).padStart(2, '0')}`, 200 - i * 10),
  );
  it('top 10 when I am in it', () => {
    expect(view(many, 'P03')).toEqual({
      rows: [
        '1:P01',
        '2:P02',
        '3:P03*',
        '4:P04',
        '5:P05',
        '6:P06',
        '7:P07',
        '8:P08',
        '9:P09',
        '10:P10',
      ],
      gapBefore: null,
    });
  });
  it('me at place 11: top 10, me and the one after, no gap', () => {
    expect(view(many, 'P11')).toEqual({
      rows: [
        ...Array.from({ length: 10 }, (_, i) => `${i + 1}:P${String(i + 1).padStart(2, '0')}`),
        '11:P11*',
        '12:P12',
      ],
      gapBefore: null,
    });
  });
  it('me lower: gap, one before, me, one after', () => {
    expect(view(many, 'P13').rows.slice(10)).toEqual(['12:P12', '13:P13*', '14:P14']);
    expect(view(many, 'P13').gapBefore).toBe(10);
  });
  it('me at the last place: gap, one before, me', () => {
    expect(view(many, 'P15').rows.slice(10)).toEqual(['14:P14', '15:P15*']);
  });
  it('not listed (off or 0 points): only the top 10', () => {
    expect(view(many, 'nobody').rows).toHaveLength(10);
  });
  it('ties share the place; longer streak first, then nickname A-Z', () => {
    expect(
      view(
        [
          p('b', 50, 1, 'Bob'),
          p('a', 50, 1, 'adam'),
          p('c', 50, 4, 'Cyril'),
          p('d', 40),
          p('e', 60),
        ],
        null,
      ).rows,
    ).toEqual(['1:e', '2:Cyril', '2:adam', '2:Bob', '5:d']);
  });
  it('Slovak letters sort as in Slovak (č after c)', () => {
    expect(
      view([p('1', 5, 0, 'Čaba'), p('2', 5, 0, 'Dana'), p('3', 5, 0, 'Cyril')], null).rows,
    ).toEqual(['1:Cyril', '1:Čaba', '1:Dana']);
  });
});

describe('API', () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  let env: Env;
  beforeAll(async () => {
    db = await freshDb();
    env = { DB: db.DB };
  }, 60_000);
  afterAll(() => db?.dispose());
  const api = apiCaller(() => env);
  let n = 0;
  async function player(nickname: string, points: number) {
    n++;
    const response = await api('/api/auth/signup', {
      body: {
        username: `lb${n}xx`,
        key: 'ab'.repeat(32),
        nickname,
        look: OLD_BEARS[(n % 8) + 1],
        parentConfirmed: true,
      },
    });
    expect(response.status, nickname).toBe(201);
    const cookie = `${SESSION_COOKIE}=${/=([0-9a-f]+)/.exec(response.headers.get('set-cookie')!)![1]}`;
    if (points > 0) {
      const start = await read(await api('/api/progress/lessons', { body: { size: 20 }, cookie }));
      await api('/api/progress/lessons/finish', {
        body: { lessonId: start.lessonId, size: 20, points: Math.min(points, 20) },
        cookie,
      });
      await env.DB.prepare(
        'UPDATE progress SET points = ? WHERE account_id = (SELECT id FROM accounts WHERE username = ?)',
      )
        .bind(points, `lb${n}xx`)
        .run();
    }
    return cookie;
  }

  it('needs a signed-in player; sends only place, nickname, bear, streak and points', async () => {
    expect((await api('/api/leaderboard')).status).toBe(401);
    const me = await player('Mia', 30);
    await player('Zero', 0);
    const body = await read(await api('/api/leaderboard', { cookie: me }));
    expect(body.gapBefore).toBeNull();
    expect(body.rows).toEqual([
      {
        place: 1,
        nickname: 'Mia',
        look: OLD_BEARS[2],
        points: 30,
        streak: 1,
        frozen: false,
        me: true,
      },
    ]);
    expect(Object.keys(body.rows[0]).sort()).toEqual([
      'frozen',
      'look',
      'me',
      'nickname',
      'place',
      'points',
      'streak',
    ]);
  });

  it('switch off hides me from others at once, I can still open it; on again shows me', async () => {
    const other = await player('Other', 50);
    const me = await player('Hidden', 40);
    const off = await api('/api/me', { method: 'PATCH', body: { leaderboard: false }, cookie: me });
    expect((await read(off)).account.leaderboard).toBe(false);
    const seen = (await read(await api('/api/leaderboard', { cookie: other }))).rows.map(
      (r: { nickname: string }) => r.nickname,
    );
    expect(seen).not.toContain('Hidden');
    expect((await api('/api/leaderboard', { cookie: me })).status).toBe(200);
    await api('/api/me', { method: 'PATCH', body: { leaderboard: true }, cookie: me });
    expect(
      (await read(await api('/api/leaderboard', { cookie: other }))).rows.map(
        (r: { nickname: string }) => r.nickname,
      ),
    ).toContain('Hidden');
    expect(
      (await api('/api/me', { method: 'PATCH', body: { leaderboard: 'no' }, cookie: me })).status,
    ).toBe(400);
  });

  it('deleted accounts disappear', async () => {
    const watcher = await player('Watcher', 10);
    const gone = await player('Gone', 70);
    expect((await api('/api/me', { method: 'DELETE', body: {}, cookie: gone })).status).toBe(200);
    expect(
      (await read(await api('/api/leaderboard', { cookie: watcher }))).rows.map(
        (r: { nickname: string }) => r.nickname,
      ),
    ).not.toContain('Gone');
  });

  it('rude nicknames are rejected on create and change; old ones are hidden from the board', async () => {
    const response = await api('/api/auth/signup', {
      body: {
        username: 'rudexx',
        key: 'ab'.repeat(32),
        nickname: 'kok0t',
        look: OLD_BEARS[1],
        parentConfirmed: true,
      },
    });
    expect(response.status).toBe(400);
    expect(await read(response)).toEqual({ error: 'not_allowed', field: 'nickname' });
    const me = await player('Nice', 15);
    const change = await api('/api/me', {
      method: 'PATCH',
      body: { nickname: 'Fuck you' },
      cookie: me,
    });
    expect(await read(change)).toEqual({ error: 'not_allowed', field: 'nickname' });
    // A nickname from before the filter: written directly.
    await env.DB.prepare("UPDATE accounts SET nickname = 'kurva' WHERE username = ?")
      .bind(`lb${n}xx`)
      .run();
    const names = (await read(await api('/api/leaderboard', { cookie: me }))).rows.map(
      (r: { nickname: string }) => r.nickname,
    );
    expect(names).not.toContain('kurva');
  });
});
