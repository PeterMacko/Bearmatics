// Google sign-in (SCRUM-97): basic `openid` permission only, so Google gives us nothing but a
// stable account ID (`sub`). We store only that ID. Disabled until GOOGLE_CLIENT_ID and the
// GOOGLE_CLIENT_SECRET secret are set (Peter, SCRUM-110).
import { publicAccount, startSession, type AccountEnv, type AccountRow } from './accounts';
import { randomHex, sha256Hex } from './crypto';
import { cookie, json, readCookie, readJson } from './http';
import { validKey } from '../shared/rules';
import * as rules from './rules';

export interface GoogleEnv extends AccountEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Local browser tests only: a fake Google. Ignored unless the app runs on localhost. */
  GOOGLE_TEST_URL?: string;
}

const STATE_COOKIE = 'bm_google_state';
const PENDING_COOKIE = 'bm_google_pending';
const PENDING_MINUTES = 15;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export const googleConfigured = (env: GoogleEnv) =>
  !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;

const local = (request: Request) =>
  ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname);
const authUrl = (request: Request, env: GoogleEnv) =>
  env.GOOGLE_TEST_URL && local(request) ? `${env.GOOGLE_TEST_URL}/auth` : AUTH_URL;
const tokenUrl = (request: Request, env: GoogleEnv) =>
  env.GOOGLE_TEST_URL && local(request) ? `${env.GOOGLE_TEST_URL}/token` : TOKEN_URL;

const callbackUrl = (request: Request) => `${new URL(request.url).origin}/api/auth/google/callback`;

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Back to the app; `result` tells the page what happened (no personal data in the address). */
function backToApp(request: Request, result: string, setCookies: string[] = []): Response {
  const headers = new Headers({ location: `${new URL(request.url).origin}/?account=${result}` });
  headers.set('cache-control', 'no-store');
  for (const value of setCookies) headers.append('set-cookie', value);
  return new Response(null, { status: 303, headers });
}

export async function googleStart(request: Request, env: GoogleEnv): Promise<Response> {
  if (!googleConfigured(env)) return backToApp(request, 'google-unavailable');
  const state = randomHex(16);
  const verifier = randomHex(32);
  const challenge = base64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  );
  const url = new URL(authUrl(request, env));
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(request),
    response_type: 'code',
    scope: 'openid',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  const headers = new Headers({ location: url.toString(), 'cache-control': 'no-store' });
  headers.append('set-cookie', cookie(STATE_COOKIE, `${state}.${verifier}`, 600));
  return new Response(null, { status: 302, headers });
}

/** Reads `sub` from the ID token received directly from Google's token endpoint over TLS. */
function subjectFrom(idToken: string, clientId: string): string | null {
  try {
    const payload = JSON.parse(
      atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as { iss?: string; aud?: string; exp?: number; sub?: string };
    if (!payload.iss || !ISSUERS.has(payload.iss)) return null;
    if (payload.aud !== clientId) return null;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return typeof payload.sub === 'string' && /^[0-9A-Za-z_-]{1,255}$/.test(payload.sub)
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}

export async function googleCallback(
  request: Request,
  env: GoogleEnv,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const clearState = cookie(STATE_COOKIE, '', 0);
  if (!googleConfigured(env)) return backToApp(request, 'google-unavailable', [clearState]);
  const params = new URL(request.url).searchParams;
  const [state, verifier] = (readCookie(request, STATE_COOKIE) ?? '').split('.');
  if (!state || !verifier || params.get('state') !== state) {
    return backToApp(request, 'google-failed', [clearState]);
  }
  const code = params.get('code');
  if (!code) return backToApp(request, 'google-cancelled', [clearState]);
  const tokenResponse = await fetcher(tokenUrl(request, env), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(request),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  const tokens = tokenResponse.ok ? ((await tokenResponse.json()) as { id_token?: string }) : null;
  const sub = tokens?.id_token ? subjectFrom(tokens.id_token, env.GOOGLE_CLIENT_ID!) : null;
  if (!sub) {
    console.error('google: token exchange failed');
    return backToApp(request, 'google-failed', [clearState]);
  }
  const existing = await env.DB.prepare('SELECT id FROM accounts WHERE google_sub = ?')
    .bind(sub)
    .first<{ id: string }>();
  if (existing) {
    return backToApp(request, 'signed-in', [clearState, await startSession(env, existing.id)]);
  }
  // First Google sign-in: the child still has to pick a nickname and bear.
  const pending = randomHex(32);
  const time = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM google_pending WHERE expires_at < ?').bind(time),
    env.DB.prepare(
      'INSERT INTO google_pending (token_hash, google_sub, expires_at) VALUES (?, ?, ?)',
    ).bind(await sha256Hex(pending), sub, time + PENDING_MINUTES * 60 * 1000),
  ]);
  return backToApp(request, 'google-new', [
    clearState,
    cookie(PENDING_COOKIE, pending, PENDING_MINUTES * 60),
  ]);
}

/** Finishes the first Google sign-in with nickname, bear and the parent confirmation. */
export async function googleComplete(request: Request, env: GoogleEnv): Promise<Response> {
  const body = await readJson(request);
  const nickname = rules.nickname(body.nickname);
  const bear = rules.bear(body.bear);
  rules.parentConfirmed(body.parentConfirmed);
  const token = readCookie(request, PENDING_COOKIE);
  const tokenHash = token && validKey(token) ? await sha256Hex(token) : '';
  const pending = tokenHash
    ? await env.DB.prepare(
        'SELECT google_sub FROM google_pending WHERE token_hash = ? AND expires_at > ?',
      )
        .bind(tokenHash, Date.now())
        .first<{ google_sub: string }>()
    : null;
  if (!pending) {
    // No personal data: only which step failed.
    console.error(
      token ? 'google complete: pending entry not found' : 'google complete: no cookie',
    );
    return json({ error: 'google_expired' }, 410);
  }
  const id = randomHex(16);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO accounts (id, google_sub, nickname, bear, parent_confirmed_at)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT (google_sub) DO NOTHING`,
    ).bind(id, pending.google_sub, nickname, bear, Date.now()),
    env.DB.prepare('DELETE FROM google_pending WHERE token_hash = ?').bind(tokenHash),
  ]);
  const account = await env.DB.prepare('SELECT * FROM accounts WHERE google_sub = ?')
    .bind(pending.google_sub)
    .first<AccountRow>();
  const headers = new Headers();
  headers.append('set-cookie', cookie(PENDING_COOKIE, '', 0));
  headers.append('set-cookie', await startSession(env, account!.id));
  return json({ account: publicAccount(account!) }, 201, headers);
}
