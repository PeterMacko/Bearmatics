// Accounts and login sessions (SCRUM-97). Data kept: see migrations/0002_accounts.sql.
import { passwordVerifier, randomHex, sameHex, sha256Hex } from './crypto';
import { BadRequest, cookie, json, readCookie, readJson } from './http';
import type { Account } from '../shared/api-types';
import { oldBearFor, type BearLook } from '../shared/bearLook';
import { validKey, validUsername } from '../shared/rules';
import * as rules from './rules';
import { DAY_MS, now } from './time';

export interface AccountEnv {
  DB: D1Database;
}

export const SESSION_COOKIE = 'bm_session';
const SESSION_DAYS = 30;
/** Session length: the cookie's Max-Age (seconds) and the stored expiry (milliseconds). */
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;
const SESSION_MS = SESSION_SECONDS * 1000;
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

export interface AccountRow {
  id: string;
  username: string | null;
  google_sub: string | null;
  server_salt: string | null;
  verifier: string | null;
  email: string | null;
  nickname: string;
  /** Before SCRUM-249: one of 8 bears. Still written (closest old bear) for older app versions. */
  bear: number;
  bear_fur: number;
  bear_bg: number;
  bear_head: number;
  bear_neck: number;
  bear_eyes: number;
  leaderboard: number;
}

/** The bear look columns of an account row. */
export type LookColumns = Pick<
  AccountRow,
  'bear_fur' | 'bear_bg' | 'bear_head' | 'bear_neck' | 'bear_eyes'
>;

/** The parts as stored in the account row. */
export const lookOf = (row: LookColumns): BearLook => ({
  fur: row.bear_fur,
  background: row.bear_bg,
  head: row.bear_head,
  neck: row.bear_neck,
  eyes: row.bear_eyes,
});

/** Column values for a look: the old bear number first, then the five parts. */
export const lookColumns = (look: BearLook) =>
  [oldBearFor(look), look.fur, look.background, look.head, look.neck, look.eyes] as const;

/** What the browser may see about the signed-in account. */
export function publicAccount(row: AccountRow): Account {
  return {
    kind: row.google_sub ? 'google' : 'password',
    username: row.username,
    nickname: row.nickname,
    look: lookOf(row),
    email: row.email,
    leaderboard: row.leaderboard !== 0,
  };
}

export async function startSession(env: AccountEnv, accountId: string): Promise<string> {
  const token = randomHex(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(token), accountId, now() + SESSION_MS)
    .run();
  return sessionCookie(token);
}

const sessionCookie = (token: string) => cookie(SESSION_COOKIE, token, SESSION_SECONDS);
const endSessionCookie = () => cookie(SESSION_COOKIE, '', 0);

type Session = { account: AccountRow; tokenHash: string; renew: string };

/** Finds the signed-in account and restarts its 30-day window. */
async function currentSession(request: Request, env: AccountEnv): Promise<Session | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !validKey(token)) return null;
  const tokenHash = await sha256Hex(token);
  const account = await env.DB.prepare(
    `SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(tokenHash, now())
    .first<AccountRow>();
  if (!account) return null;
  await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
    .bind(now() + SESSION_MS, tokenHash)
    .run();
  return { account, tokenHash, renew: sessionCookie(token) };
}

const signedOut = () => json({ account: null });
/** No valid session: the account routes also clear the cookie, the points routes keep it. */
const unauthorized = () =>
  json({ error: 'not_signed_in' }, 401, { 'set-cookie': endSessionCookie() });
export const notSignedIn = () => json({ error: 'not_signed_in' }, 401);

/** A signed-in route's success: answered as JSON together with the renewed session cookie. */
export class Renewed {
  constructor(
    readonly body: unknown,
    readonly status = 200,
  ) {}
}

export type SessionHandler = (
  request: Request,
  env: AccountEnv,
  session: Session,
) => Promise<Response | Renewed>;

/**
 * Runs a route that needs a signed-in player. Without a valid session it answers 401, clearing
 * the cookie for `auth: 'clear'`; a `Renewed` success gets the renewed cookie, any other
 * answer (errors, sign-out) goes out as the handler built it.
 */
export async function withSession(
  request: Request,
  env: AccountEnv,
  auth: 'clear' | 'keep',
  handler: SessionHandler,
): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session) return auth === 'clear' ? unauthorized() : notSignedIn();
  const answer = await handler(request, env, session);
  return answer instanceof Renewed
    ? json(answer.body, answer.status, { 'set-cookie': session.renew })
    : answer;
}

const tooManyAttempts = () => json({ error: 'too_many_attempts' }, 429);

/**
 * A password check under the attempt limit. The try is taken BEFORE checking, in one atomic
 * statement (QA114-01); over the limit the key is not even checked, and the wrong try that
 * reaches the limit already answers 429. `check` returns what was found, or null when wrong.
 */
async function limited<T extends object>(
  env: AccountEnv,
  keyHash: string,
  time: number,
  check: () => Promise<T | null>,
  wrong: () => Response,
): Promise<T | Response> {
  const attempt = await takeTry(env, keyHash, time);
  if (attempt > MAX_FAILURES) return tooManyAttempts();
  const found = await check();
  if (found) return found;
  return attempt >= MAX_FAILURES ? tooManyAttempts() : wrong();
}

// ---------- Password accounts ----------

export async function signUp(request: Request, env: AccountEnv): Promise<Response> {
  const body = await readJson(request);
  const username = rules.username(body.username);
  const key = rules.passwordKey(body.key);
  const nickname = rules.nickname(body.nickname);
  const look = rules.look(body.look);
  const email = rules.email(body.email);
  rules.parentConfirmed(body.parentConfirmed);
  const id = randomHex(16);
  const serverSalt = randomHex(16);
  try {
    await env.DB.prepare(
      `INSERT INTO accounts (id, username, username_key, server_salt, verifier, email, nickname, bear,
        bear_fur, bear_bg, bear_head, bear_neck, bear_eyes, parent_confirmed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        username,
        username.toLowerCase(),
        serverSalt,
        await passwordVerifier(serverSalt, key),
        email,
        nickname,
        ...lookColumns(look),
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

/**
 * Takes one try from the limit in a single atomic statement, BEFORE the password is checked, so
 * parallel requests cannot all read the same old count (QA114-01). Returns the try number; a lock
 * that has run out starts a fresh count. The MAX_FAILURES-th try arms the 15-minute lock.
 */
async function takeTry(env: AccountEnv, keyHash: string, time: number) {
  const lockUntil = time + LOCK_MINUTES * 60 * 1000;
  const row = await env.DB.prepare(
    `INSERT INTO login_attempts (key_hash, failures, locked_until, updated_at) VALUES (?1, 1, 0, ?2)
     ON CONFLICT (key_hash) DO UPDATE SET
       failures = CASE WHEN locked_until > 0 AND locked_until <= ?2 THEN 1 ELSE failures + 1 END,
       locked_until = CASE
         WHEN locked_until > 0 AND locked_until <= ?2 THEN 0
         WHEN locked_until = 0 AND failures + 1 >= ?3 THEN ?4
         ELSE locked_until END,
       updated_at = ?2
     RETURNING failures`,
  )
    .bind(keyHash, time, MAX_FAILURES, lockUntil)
    .first<{ failures: number }>();
  return row!.failures;
}

export async function signIn(request: Request, env: AccountEnv): Promise<Response> {
  const body = await readJson(request);
  // Malformed usernames get the same answer as wrong passwords.
  const rawUsername = typeof body.username === 'string' ? body.username : '';
  const key = rules.passwordKey(body.key);
  const keyHash = await attemptKey(rawUsername);
  const time = now();
  await env.DB.prepare('DELETE FROM login_attempts WHERE updated_at < ?')
    .bind(time - DAY_MS)
    .run();
  const account = await limited(
    env,
    keyHash,
    time,
    async () => {
      const row = validUsername(rawUsername)
        ? await env.DB.prepare('SELECT * FROM accounts WHERE username_key = ?')
            .bind(rawUsername.toLowerCase())
            .first<AccountRow>()
        : null;
      const ok =
        !!row?.server_salt &&
        !!row.verifier &&
        sameHex(await passwordVerifier(row.server_salt, key), row.verifier);
      return ok ? row : null;
    },
    () => json({ error: 'wrong_username_or_password' }, 401),
  );
  if (account instanceof Response) return account;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_attempts WHERE key_hash = ?').bind(keyHash),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(time),
  ]);
  return json({ account: publicAccount(account) }, 200, {
    'set-cookie': await startSession(env, account.id),
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

export const updateProfile: SessionHandler = async (request, env, session) => {
  const body = await readJson(request);
  const { account } = session;
  const nickname = 'nickname' in body ? rules.nickname(body.nickname) : account.nickname;
  // SCRUM-249: the look replaces the old bear number; an old-style `bear` alone is refused.
  if ('bear' in body && !('look' in body)) throw new BadRequest('invalid', 'look');
  const look = 'look' in body ? rules.look(body.look) : lookOf(account);
  let email = account.email;
  if ('email' in body) {
    if (account.google_sub) throw new BadRequest('invalid', 'email');
    email = rules.email(body.email);
  }
  // SCRUM-148: show me on the leaderboard (on by default).
  let leaderboard = account.leaderboard;
  if ('leaderboard' in body) {
    if (typeof body.leaderboard !== 'boolean') throw new BadRequest('invalid', 'leaderboard');
    leaderboard = body.leaderboard ? 1 : 0;
  }
  const [bear, furPart, bgPart, headPart, neckPart, eyesPart] = lookColumns(look);
  await env.DB.prepare(
    `UPDATE accounts SET nickname = ?, bear = ?, bear_fur = ?, bear_bg = ?, bear_head = ?,
      bear_neck = ?, bear_eyes = ?, email = ?, leaderboard = ? WHERE id = ?`,
  )
    .bind(
      nickname,
      bear,
      furPart,
      bgPart,
      headPart,
      neckPart,
      eyesPart,
      email,
      leaderboard,
      account.id,
    )
    .run();
  return new Renewed({
    account: { ...publicAccount({ ...account, nickname, email, leaderboard }), look },
  });
};

export const changePassword: SessionHandler = async (request, env, session) => {
  const body = await readJson(request);
  const currentKey = rules.passwordKey(body.currentKey, 'currentKey');
  const newKey = rules.passwordKey(body.newKey, 'newKey');
  const { account } = session;
  const { server_salt: salt, verifier } = account;
  if (!salt || !verifier) throw new BadRequest('invalid', 'currentKey');
  // Same limit as sign-in for guessing the current password with a stolen session.
  const limitKey = await sha256Hex(`password:${account.id}`);
  const checked = await limited(
    env,
    limitKey,
    now(),
    async () => (sameHex(await passwordVerifier(salt, currentKey), verifier) ? account : null),
    () => json({ error: 'wrong_password' }, 403),
  );
  if (checked instanceof Response) return checked;
  await env.DB.prepare('DELETE FROM login_attempts WHERE key_hash = ?').bind(limitKey).run();
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
  return new Renewed({ ok: true });
};

export const deleteAccount: SessionHandler = async (_request, env, session) => {
  const { account } = session;
  const limitKeys = [await sha256Hex(`password:${account.id}`)];
  if (account.username) limitKeys.push(await attemptKey(account.username));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(account.id),
    env.DB.prepare('DELETE FROM lessons WHERE account_id = ?').bind(account.id),
    env.DB.prepare('DELETE FROM progress WHERE account_id = ?').bind(account.id),
    env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(account.id),
    ...limitKeys.map((key) =>
      env.DB.prepare('DELETE FROM login_attempts WHERE key_hash = ?').bind(key),
    ),
  ]);
  return json({ account: null }, 200, { 'set-cookie': endSessionCookie() });
};
