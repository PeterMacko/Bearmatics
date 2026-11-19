// Accounts against a real local D1 (SQLite): sign-up, sign-in, limits, sessions, profile, delete.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOCK_MINUTES, MAX_FAILURES, SESSION_COOKIE } from './accounts';
import { handleApi, type Env } from './api';
import { apiCaller, ORIGIN, read } from './testApi';
import { freshDb } from './testDb';

let db: Awaited<ReturnType<typeof freshDb>>;
let env: Env;

beforeAll(async () => {
  db = await freshDb();
  env = { DB: db.DB };
}, 60_000);
afterAll(() => db?.dispose());

const key = (n: number) => n.toString(16).padStart(2, '0').repeat(32);

const api = apiCaller(() => env);

function sessionCookie(response: Response): string {
  const header = response.headers.get('set-cookie') ?? '';
  const match = new RegExp(`${SESSION_COOKIE}=([0-9a-f]*)`).exec(header);
  expect(match, header).not.toBeNull();
  return `${SESSION_COOKIE}=${match![1]}`;
}

const signup = (username: string, extra: Record<string, unknown> = {}) =>
  api('/api/auth/signup', {
    body: {
      username,
      key: key(1),
      nickname: 'Little Bear',
      bear: 3,
      parentConfirmed: true,
      ...extra,
    },
  });

const signin = (username: string, k = key(1)) =>
  api('/api/auth/signin', { body: { username, key: k } });

describe('sign-up', () => {
  it('creates an account, signs in and stores only the scoped data', async () => {
    const response = await signup('Mia2019', { email: ' parent@example.com ' });
    expect(response.status).toBe(201);
    expect(await read(response)).toEqual({
      account: {
        kind: 'password',
        username: 'Mia2019',
        nickname: 'Little Bear',
        bear: 3,
        email: 'parent@example.com',
        leaderboard: true,
      },
    });
    const setCookie = response.headers.get('set-cookie')!;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Max-Age=2592000/);
    const me = await api('/api/me', { cookie: sessionCookie(response) });
    expect((await read(me)).account.username).toBe('Mia2019');

    const row = await env.DB.prepare('SELECT * FROM accounts WHERE username_key = ?')
      .bind('mia2019')
      .first<Record<string, unknown>>();
    expect(Object.keys(row!).sort()).toEqual([
      'bear',
      'email',
      'google_sub',
      'id',
      'leaderboard',
      'nickname',
      'parent_confirmed_at',
      'server_salt',
      'username',
      'username_key',
      'verifier',
    ]);
    expect(row!.verifier).not.toBe(key(1)); // the browser key is never stored as is
    expect(row!.google_sub).toBeNull();
    expect(typeof row!.parent_confirmed_at).toBe('number');
    const token = sessionCookie(response).split('=')[1];
    const sessions = await env.DB.prepare('SELECT token_hash FROM sessions WHERE account_id = ?')
      .bind(row!.id)
      .all();
    expect(sessions.results).toHaveLength(1);
    expect(sessions.results[0].token_hash).not.toBe(token); // only a hash of the cookie token
  });

  it('works without an email', async () => {
    const response = await signup('NoMail1', { email: '' });
    expect(response.status).toBe(201);
    expect((await read(response)).account.email).toBeNull();
  });

  it('rejects a username that differs only in capital letters', async () => {
    const response = await signup('MIA2019');
    expect(response.status).toBe(409);
    expect(await read(response)).toEqual({ error: 'username_taken' });
  });

  it.each([
    [{ username: 'ab' }, 'username'],
    [{ username: 'abcdefghijklmnopqrstu' }, 'username'],
    [{ username: 'bad name' }, 'username'],
    [{ username: 'zoé123' }, 'username'],
    [{ key: 'my secret password' }, 'key'],
    [{ key: key(10).toUpperCase() }, 'key'],
    [{ nickname: '   ' }, 'nickname'],
    [{ nickname: 'x'.repeat(21) }, 'nickname'],
    [{ nickname: '<b>hi</b>' }, 'nickname'],
    [{ bear: 0 }, 'bear'],
    [{ bear: 9 }, 'bear'],
    [{ bear: '3' }, 'bear'],
    [{ email: 'not-an-email' }, 'email'],
    [{ parentConfirmed: false }, 'parentConfirmed'],
    [{ parentConfirmed: 'yes' }, 'parentConfirmed'],
  ])('rejects %j', async (change, field) => {
    const response = await signup('Valid99', change);
    expect(response.status).toBe(400);
    expect(await read(response)).toEqual({ error: 'invalid', field });
  });

  it('accepts Slovak letters in nicknames', async () => {
    const response = await signup('Slovak1', { nickname: 'Ľubka Čučoriedka' });
    expect(response.status).toBe(201);
  });
});

describe('requests from other sites', () => {
  it.each([null, 'https://evil.example'])('refuses writes with Origin %s', async (origin) => {
    const response = await api('/api/auth/signin', {
      body: { username: 'Mia2019', key: key(1) },
      origin,
    });
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('refuses a body that is not JSON', async () => {
    const response = await handleApi(
      new Request(`${ORIGIN}/api/auth/signin`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'text/plain' },
        body: 'username=Mia2019',
      }),
      env,
    );
    expect(response.status).toBe(400);
  });
});

describe('sign-in', () => {
  it('signs in with the right key, ignoring capital letters in the username', async () => {
    const response = await signin('mia2019');
    expect(response.status).toBe(200);
    expect((await read(response)).account.username).toBe('Mia2019');
    sessionCookie(response);
  });

  it('gives the same answer for a wrong password and an unknown user', async () => {
    const wrong = await signin('Mia2019', key(2));
    const unknown = await signin('Nobody42', key(1));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await read(wrong)).toEqual(await read(unknown));
  });

  it('locks after too many wrong passwords, for existing and unknown users alike', async () => {
    await signup('Locky1');
    for (const name of ['Locky1', 'Ghost77']) {
      const statuses = [];
      for (let i = 0; i < MAX_FAILURES; i++) statuses.push((await signin(name, key(9))).status);
      expect(statuses).toEqual([401, 401, 401, 401, 429]);
      // Even the right password waits while locked.
      expect((await signin(name, key(1))).status).toBe(429);
    }
    // After the lock time the right password works and the count starts again.
    await env.DB.prepare('UPDATE login_attempts SET locked_until = ?')
      .bind(Date.now() - 1)
      .run();
    expect((await signin('Locky1', key(9))).status).toBe(401);
    expect((await signin('Locky1', key(1))).status).toBe(200);
    expect(LOCK_MINUTES).toBe(15);
  });

  it('counts parallel wrong tries atomically (QA114-01)', async () => {
    await signup('Burst1');
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) => signin('Burst1', key(100 + i))),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(MAX_FAILURES - 1);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(30 - MAX_FAILURES);
    expect((await signin('Burst1', key(1))).status).toBe(429);
  });

  it('a deleted account leaves no attempt rows, so a new account with that name is not locked (QA114-03)', async () => {
    const cookie = sessionCookie(await signup('Gone1'));
    for (let i = 0; i < MAX_FAILURES; i++) await signin('Gone1', key(9));
    expect((await signin('Gone1', key(1))).status).toBe(429);
    expect((await api('/api/me', { method: 'DELETE', cookie })).status).toBe(200);
    await signup('Gone1');
    expect((await signin('Gone1', key(1))).status).toBe(200);
  });

  it('stores attempts only as hashes of the username', async () => {
    const rows = await env.DB.prepare('SELECT key_hash FROM login_attempts').all<{
      key_hash: string;
    }>();
    for (const row of rows.results) expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('signed-in account', () => {
  let cookie = '';
  beforeAll(async () => {
    await signup('Profile1');
    cookie = sessionCookie(await signin('Profile1'));
  });

  it('reports signed out without a cookie, and clears an unknown cookie', async () => {
    expect(await read(await api('/api/me'))).toEqual({ account: null });
    const stale = await api('/api/me', { cookie: `${SESSION_COOKIE}=${key(7)}` });
    expect(await read(stale)).toEqual({ account: null });
    expect(stale.headers.get('set-cookie')).toMatch(/Max-Age=0/);
  });

  it('restarts the 30-day window on every visit', async () => {
    await env.DB.prepare('UPDATE sessions SET expires_at = ?')
      .bind(Date.now() + 1000)
      .run();
    const response = await api('/api/me', { cookie });
    expect(response.headers.get('set-cookie')).toMatch(/Max-Age=2592000/);
    const row = await env.DB.prepare('SELECT MAX(expires_at) AS e FROM sessions').first<{
      e: number;
    }>();
    expect(row!.e).toBeGreaterThan(Date.now() + 29.9 * 24 * 3600 * 1000);
  });

  it('changes nickname and bear, adds and removes the email', async () => {
    let response = await api('/api/me', {
      method: 'PATCH',
      cookie,
      body: { nickname: 'Brave Cub', bear: 8, email: 'p@example.org' },
    });
    expect((await read(response)).account).toMatchObject({
      nickname: 'Brave Cub',
      bear: 8,
      email: 'p@example.org',
    });
    response = await api('/api/me', { method: 'PATCH', cookie, body: { email: null } });
    expect((await read(response)).account).toMatchObject({
      nickname: 'Brave Cub',
      bear: 8,
      email: null,
    });
    response = await api('/api/me', { method: 'PATCH', cookie, body: { bear: 12 } });
    expect(response.status).toBe(400);
  });

  it('changes the password with the current one; other devices are signed out', async () => {
    const other = sessionCookie(await signin('Profile1'));
    const wrong = await api('/api/me/password', {
      cookie,
      body: { currentKey: key(2), newKey: key(3) },
    });
    expect(wrong.status).toBe(403);
    const ok = await api('/api/me/password', {
      cookie,
      body: { currentKey: key(1), newKey: key(3) },
    });
    expect(ok.status).toBe(200);
    expect((await signin('Profile1', key(1))).status).toBe(401);
    expect((await signin('Profile1', key(3))).status).toBe(200);
    expect((await read(await api('/api/me', { cookie: other }))).account).toBeNull();
    expect((await read(await api('/api/me', { cookie }))).account.username).toBe('Profile1');
  });

  it('limits guesses of the current password too', async () => {
    await signup('Guess1');
    const own = sessionCookie(await signin('Guess1'));
    const statuses = [];
    for (let i = 0; i < MAX_FAILURES + 1; i++) {
      const r = await api('/api/me/password', {
        cookie: own,
        body: { currentKey: key(40 + i), newKey: key(3) },
      });
      statuses.push(r.status);
    }
    expect(statuses).toEqual([403, 403, 403, 403, 429, 429]);
    const right = await api('/api/me/password', {
      cookie: own,
      body: { currentKey: key(1), newKey: key(3) },
    });
    expect(right.status).toBe(429);
  });

  it('signs out on this device only', async () => {
    const second = sessionCookie(await signin('Profile1', key(3)));
    const out = await api('/api/auth/signout', { cookie: second, body: {} });
    expect(out.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect((await read(await api('/api/me', { cookie: second }))).account).toBeNull();
    expect((await read(await api('/api/me', { cookie }))).account).not.toBeNull();
  });

  it('needs a signed-in session for account changes', async () => {
    for (const [path, method] of [
      ['/api/me', 'PATCH'],
      ['/api/me', 'DELETE'],
      ['/api/me/password', 'POST'],
    ]) {
      const response = await api(path, { method, body: { nickname: 'x' } });
      expect(response.status, `${method} ${path}`).toBe(401);
    }
  });

  it('deletes the account and every stored row at once', async () => {
    const { id } = (await env.DB.prepare('SELECT id FROM accounts WHERE username_key = ?')
      .bind('profile1')
      .first<{ id: string }>())!;
    const response = await api('/api/me', { method: 'DELETE', cookie });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    const left = await env.DB.prepare(
      'SELECT (SELECT COUNT(*) FROM accounts WHERE id = ?1) + (SELECT COUNT(*) FROM sessions WHERE account_id = ?1) AS n',
    )
      .bind(id)
      .first<{ n: number }>();
    expect(left!.n).toBe(0);
    expect((await signin('Profile1', key(3))).status).toBe(401);
    expect((await signup('Profile1')).status).toBe(201); // the username is free again
  });

  it('expired sessions do not sign in', async () => {
    const fresh = sessionCookie(await signin('Mia2019'));
    await env.DB.prepare('UPDATE sessions SET expires_at = ?')
      .bind(Date.now() - 1)
      .run();
    expect((await read(await api('/api/me', { cookie: fresh }))).account).toBeNull();
  });
});
