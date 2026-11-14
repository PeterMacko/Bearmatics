// Accounts and login sessions (SCRUM-97). Data kept: see migrations/0002_accounts.sql.
import { passwordVerifier, randomHex, sameHex, sha256Hex } from './crypto';
import { BadRequest, cookie, json, readCookie, readJson } from './http';
import * as rules from './rules';

export interface AccountEnv {
  DB: D1Database;
}

export const SESSION_COOKIE = 'bm_session';
export const SESSION_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

interface AccountRow {
  id: string;
  username: string | null;
  google_sub: string | null;
  server_salt: string | null;
  verifier: string | null;
  email: string | null;
  nickname: string;
  bear: number;
}

/** What the browser may see about the signed-in account. */
function publicAccount(row: AccountRow) {
  return {
    kind: row.google_sub ? 'google' : 'password',
    username: row.username,
    nickname: row.nickname,
    bear: row.bear,
    email: row.email,
  };
}

const now = () => Date.now();

async function startSession(env: AccountEnv, accountId: string): Promise<string> {
  const token = randomHex(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(token), accountId, now() + SESSION_DAYS * DAY)
    .run();
  return cookie(SESSION_COOKIE, token, SESSION_DAYS * 24 * 60 * 60);
}

const endSessionCookie = () => cookie(SESSION_COOKIE, '', 0);

/** Finds the signed-in account and restarts its 30-day window. */
export async function currentSession(
  request: Request,
  env: AccountEnv,
): Promise<{ account: AccountRow; tokenHash: string; renew: string } | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const account = await env.DB.prepare(
    `SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(tokenHash, now())
    .first<AccountRow>();
  if (!account) return null;
  await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
    .bind(now() + SESSION_DAYS * DAY, tokenHash)
    .run();
  return { account, tokenHash, renew: cookie(SESSION_COOKIE, token, SESSION_DAYS * 24 * 60 * 60) };
}

const signedOut = () => json({ account: null });
const unauthorized = () =>
  json({ error: 'not_signed_in' }, 401, { 'set-cookie': endSessionCookie() });

// ---------- Password accounts ----------

export async function signUp(request: Request, env: AccountEnv): Promise<Response> {
  const body = await readJson(request);
  const username = rules.username(body.username);
  const key = rules.passwordKey(body.key);
  const nickname = rules.nickname(body.nickname);
  const bear = rules.bear(body.bear);
  const email = rules.email(body.email);
  rules.parentConfirmed(body.parentConfirmed);
  const id = randomHex(16);
  const serverSalt = randomHex(16);
  try {
    await env.DB.prepare(
      `INSERT INTO accounts (id, username, username_key, server_salt, verifier, email, nickname, bear,
        parent_confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        username,
        username.toLowerCase(),
        serverSalt,
        await passwordVerifier(serverSalt, key),
        email,
        nickname,
        bear,
        now(),
      )
      .run();
  } catch (error) {
    if (String(error).includes('UNIQUE')) return json({ error: 'username_taken' }, 409);
    throw error;
  }
  const account = await env.DB.prepare('SELECT * FROM accounts WHERE id = ?')
    .bind(id)
    .first<AccountRow>();
  return json({ account: publicAccount(account!) }, 201, {
    'set-cookie': await startSession(env, id),
  });
}

async function attemptKey(username: string) {
  return sha256Hex(`login:${username.toLowerCase()}`);
}

export async function signIn(request: Request, env: AccountEnv): Promise<Response> {
  const body = await readJson(request);
  // Malformed usernames get the same answer as wrong passwords.
  const rawUsername = typeof body.username === 'string' ? body.username : '';
  const key = rules.passwordKey(body.key);
  const keyHash = await attemptKey(rawUsername);
  const time = now();
  await env.DB.prepare('DELETE FROM login_attempts WHERE updated_at < ?')
    .bind(time - DAY)
    .run();
  const attempt = await env.DB.prepare(
    'SELECT failures, locked_until FROM login_attempts WHERE key_hash = ?',
  )
    .bind(keyHash)
    .first<{ failures: number; locked_until: number }>();
  if (attempt && attempt.locked_until > time) return json({ error: 'too_many_attempts' }, 429);

  const account = /^[A-Za-z0-9]{3,20}$/.test(rawUsername)
    ? await env.DB.prepare('SELECT * FROM accounts WHERE username_key = ?')
        .bind(rawUsername.toLowerCase())
        .first<AccountRow>()
    : null;
  const ok =
    !!account?.server_salt &&
    !!account.verifier &&
    sameHex(await passwordVerifier(account.server_salt, key), account.verifier);
  if (!ok) {
    // A lock that has run out starts a fresh count.
    const previous = attempt && attempt.locked_until === 0 ? attempt.failures : 0;
    const failures = previous + 1;
    const lockedUntil = failures >= MAX_FAILURES ? time + LOCK_MINUTES * 60 * 1000 : 0;
    await env.DB.prepare(
      `INSERT INTO login_attempts (key_hash, failures, locked_until, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (key_hash) DO UPDATE SET failures = excluded.failures,
         locked_until = excluded.locked_until, updated_at = excluded.updated_at`,
    )
      .bind(keyHash, failures, lockedUntil, time)
      .run();
    return lockedUntil
      ? json({ error: 'too_many_attempts' }, 429)
      : json({ error: 'wrong_username_or_password' }, 401);
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_attempts WHERE key_hash = ?').bind(keyHash),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(time),
  ]);
  return json({ account: publicAccount(account!) }, 200, {
    'set-cookie': await startSession(env, account!.id),
  });
}

// ---------- Signed-in account ----------

export async function me(request: Request, env: AccountEnv): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session) {
    return readCookie(request, SESSION_COOKIE)
      ? json({ account: null }, 200, { 'set-cookie': endSessionCookie() })
      : signedOut();
  }
  return json({ account: publicAccount(session.account) }, 200, { 'set-cookie': session.renew });
}

export async function signOut(request: Request, env: AccountEnv): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await sha256Hex(token))
      .run();
  }
  return json({ account: null }, 200, { 'set-cookie': endSessionCookie() });
}

export async function updateProfile(request: Request, env: AccountEnv): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session) return unauthorized();
  const body = await readJson(request);
  const { account } = session;
  const nickname = 'nickname' in body ? rules.nickname(body.nickname) : account.nickname;
  const bear = 'bear' in body ? rules.bear(body.bear) : account.bear;
  let email = account.email;
  if ('email' in body) {
    if (account.google_sub) throw new BadRequest('invalid', 'email');
    email = rules.email(body.email);
  }
  await env.DB.prepare('UPDATE accounts SET nickname = ?, bear = ?, email = ? WHERE id = ?')
    .bind(nickname, bear, email, account.id)
    .run();
  return json({ account: publicAccount({ ...account, nickname, bear, email }) }, 200, {
    'set-cookie': session.renew,
  });
}

export async function changePassword(request: Request, env: AccountEnv): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session) return unauthorized();
  const body = await readJson(request);
  const currentKey = rules.passwordKey(body.currentKey, 'currentKey');
  const newKey = rules.passwordKey(body.newKey, 'newKey');
  const { account } = session;
  if (!account.server_salt || !account.verifier) throw new BadRequest('invalid', 'currentKey');
  if (!sameHex(await passwordVerifier(account.server_salt, currentKey), account.verifier)) {
    return json({ error: 'wrong_password' }, 403);
  }
  const serverSalt = randomHex(16);
  await env.DB.batch([
    env.DB.prepare('UPDATE accounts SET server_salt = ?, verifier = ? WHERE id = ?').bind(
      serverSalt,
      await passwordVerifier(serverSalt, newKey),
      account.id,
    ),
    // Sign out every other device; this one stays signed in.
    env.DB.prepare('DELETE FROM sessions WHERE account_id = ? AND token_hash <> ?').bind(
      account.id,
      session.tokenHash,
    ),
  ]);
  return json({ ok: true }, 200, { 'set-cookie': session.renew });
}

export async function deleteAccount(request: Request, env: AccountEnv): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session) return unauthorized();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(session.account.id),
    env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(session.account.id),
  ]);
  return json({ account: null }, 200, { 'set-cookie': endSessionCookie() });
}

// Exported for the Google sign-in module.
export { publicAccount, startSession, type AccountRow };
