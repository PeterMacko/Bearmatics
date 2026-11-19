// Google sign-in with a fake Google token endpoint and a real local D1.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleApi, type Env } from './api';
import { googleCallback } from './google';
import { ORIGIN, read } from './testApi';
import { freshDb } from './testDb';

const CLIENT = 'client-123.apps.googleusercontent.com';
let db: Awaited<ReturnType<typeof freshDb>>;
let env: Env;

beforeAll(async () => {
  db = await freshDb();
  env = { DB: db.DB, GOOGLE_CLIENT_ID: CLIENT, GOOGLE_CLIENT_SECRET: 'test-secret' };
}, 60_000);
afterAll(() => db?.dispose());

const b64 = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
const idToken = (claims: object) =>
  `${b64({ alg: 'RS256' })}.${b64({ iss: 'https://accounts.google.com', aud: CLIENT, exp: Date.now() / 1000 + 600, ...claims })}.sig`;

function cookies(response: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of response.headers.entries()) {
    if (name !== 'set-cookie') continue;
    for (const part of value.split(/,(?=\s*\w+=)/)) {
      const [pair] = part.trim().split(';');
      const [key, val] = pair.split('=');
      out[key] = val;
    }
  }
  return out;
}

async function start(e: Env = env) {
  const response = await handleApi(new Request(`${ORIGIN}/api/auth/google/start`), e);
  const state = new URL(response.headers.get('location')!).searchParams.get('state')!;
  return { response, state, cookie: `bm_google_state=${cookies(response).bm_google_state}` };
}

async function callback(claims: object, override: { state?: string } = {}) {
  const s = await start();
  let seenBody = '';
  const fakeGoogle = (async (_url: string, init: RequestInit) => {
    seenBody = String(init.body);
    return new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 });
  }) as unknown as typeof fetch;
  const url = `${ORIGIN}/api/auth/google/callback?code=abc&state=${override.state ?? s.state}`;
  const response = await googleCallback(
    new Request(url, { headers: { cookie: s.cookie } }),
    env,
    fakeGoogle,
  );
  return {
    response,
    seenBody,
    result: new URL(response.headers.get('location')!).searchParams.get('account'),
  };
}

const complete = (cookie: string, body: object) =>
  handleApi(
    new Request(`${ORIGIN}/api/auth/google/complete`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    }),
    env,
  );

describe('Google sign-in', () => {
  it('is reported unavailable until Peter sets the client ID and secret', async () => {
    const bare = { DB: env.DB };
    expect(await read(await handleApi(new Request(`${ORIGIN}/api/auth/google`), bare))).toEqual({
      available: false,
    });
    const { response } = await start(bare);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/?account=google-unavailable`);
  });

  it('asks Google only for the basic openid permission, with state and PKCE', async () => {
    const { response, cookie } = await start();
    expect(response.status).toBe(302);
    const url = new URL(response.headers.get('location')!);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/google/callback`);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(cookie).toMatch(/^bm_google_state=[0-9a-f]+\.[0-9a-f]+$/);
  });

  it('first sign-in asks for nickname, bear and parent confirmation, then stores only the Google ID', async () => {
    const first = await callback({ sub: '1098765' });
    expect(first.result).toBe('google-new');
    expect(first.seenBody).toContain('code_verifier=');
    const pending = `bm_google_pending=${cookies(first.response).bm_google_pending}`;
    expect(
      (await complete(pending, { nickname: 'Cub', bear: 2, parentConfirmed: false })).status,
    ).toBe(400);
    const done = await complete(pending, { nickname: 'Cub', bear: 2, parentConfirmed: true });
    expect(done.status).toBe(201);
    expect((await read(done)).account).toEqual({
      kind: 'google',
      username: null,
      nickname: 'Cub',
      bear: 2,
      email: null,
      leaderboard: true,
    });
    const row = await env.DB.prepare('SELECT * FROM accounts WHERE google_sub = ?')
      .bind('1098765')
      .first<Record<string, unknown>>();
    expect(row).toMatchObject({
      username: null,
      username_key: null,
      server_salt: null,
      verifier: null,
      email: null,
    });
    // The pending entry is used up.
    expect(
      (await complete(pending, { nickname: 'Cub', bear: 2, parentConfirmed: true })).status,
    ).toBe(410);
  });

  it('later sign-ins go straight in', async () => {
    const again = await callback({ sub: '1098765' });
    expect(again.result).toBe('signed-in');
    expect(cookies(again.response).bm_session).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ['another app', { sub: '1', aud: 'someone-else' }],
    ['a wrong issuer', { sub: '1', iss: 'https://evil.example' }],
    ['an expired token', { sub: '1', exp: 1000 }],
  ])('rejects a token for %s', async (_name, claims) => {
    expect((await callback(claims)).result).toBe('google-failed');
  });

  it('rejects a callback whose state does not match', async () => {
    expect((await callback({ sub: '2' }, { state: 'forged' })).result).toBe('google-failed');
  });

  it('Google accounts cannot add an email', async () => {
    const again = await callback({ sub: '1098765' });
    const cookie = `bm_session=${cookies(again.response).bm_session}`;
    const response = await handleApi(
      new Request(`${ORIGIN}/api/me`, {
        method: 'PATCH',
        headers: { origin: ORIGIN, 'content-type': 'application/json', cookie },
        body: JSON.stringify({ email: 'a@b.cd' }),
      }),
      env,
    );
    expect(response.status).toBe(400);
  });
});
