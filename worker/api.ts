// /api routing and health check. Never log request bodies, URLs or personal data.
import * as accounts from './accounts';
import * as leaderboard from './leaderboard';
import * as progress from './progress';
import {
  googleCallback,
  googleComplete,
  googleConfigured,
  googleStart,
  type GoogleEnv,
} from './google';
import { BadRequest, fromOwnSite, json, methodNotAllowed, notFound, withoutBody } from './http';

export interface Env extends GoogleEnv {
  ASSETS?: Fetcher;
}

/** Schema version the code needs; /api/health reports an error until migrations reach it. */
const EXPECTED_SCHEMA = '6';

export { json };

export async function health(env: Env): Promise<Response> {
  try {
    await env.DB.prepare('SELECT 1').first();
  } catch {
    console.error('health: database unreachable');
    return json({ status: 'error', database: 'unavailable' }, 503);
  }
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM app_meta WHERE key = 'schema_version'",
    ).first<{ value: string }>();
    if (!row) return json({ status: 'error', database: 'ok', schema: 'missing' }, 503);
    if (row.value !== EXPECTED_SCHEMA) {
      return json(
        { status: 'error', database: 'ok', schema: row.value, expected: EXPECTED_SCHEMA },
        503,
      );
    }
    return json({ status: 'ok', database: 'ok', schema: row.value });
  } catch {
    console.error('health: schema not migrated');
    return json({ status: 'error', database: 'ok', schema: 'missing' }, 503);
  }
}

type Handler = (request: Request, env: Env) => Promise<Response>;
/**
 * Route table: path -> method -> handler. `write` routes need our own Origin (anti-forgery).
 * `auth` routes need a signed-in player (see withSession): 'clear' answers 401 and clears the
 * session cookie, 'keep' answers 401 and leaves it.
 */
type Route =
  | { handler: Handler; write?: boolean; auth?: undefined }
  | { handler: accounts.SessionHandler; write?: boolean; auth: 'clear' | 'keep' };
const routes: Record<string, Record<string, Route>> = {
  '/api/health': { GET: { handler: (_r, env) => health(env) } },
  '/api/me': {
    GET: { handler: accounts.me },
    PATCH: { handler: accounts.updateProfile, write: true, auth: 'clear' },
    DELETE: { handler: accounts.deleteAccount, write: true, auth: 'clear' },
  },
  '/api/me/password': {
    POST: { handler: accounts.changePassword, write: true, auth: 'clear' },
  },
  '/api/progress': { GET: { handler: progress.getProgress, auth: 'keep' } },
  '/api/progress/lessons': {
    POST: { handler: progress.startLesson, write: true, auth: 'keep' },
  },
  '/api/progress/lessons/finish': {
    POST: { handler: progress.finishLesson, write: true, auth: 'keep' },
  },
  '/api/progress/streak': {
    POST: { handler: progress.answerStreak, write: true, auth: 'keep' },
  },
  '/api/leaderboard': { GET: { handler: leaderboard.getLeaderboard, auth: 'keep' } },
  '/api/auth/signup': { POST: { handler: accounts.signUp, write: true } },
  '/api/auth/signin': { POST: { handler: accounts.signIn, write: true } },
  '/api/auth/signout': { POST: { handler: accounts.signOut, write: true } },
  '/api/auth/google': {
    GET: { handler: async (_r, env) => json({ available: googleConfigured(env) }) },
  },
  '/api/auth/google/start': { GET: { handler: googleStart } },
  '/api/auth/google/callback': { GET: { handler: (request, env) => googleCallback(request, env) } },
  '/api/auth/google/complete': { POST: { handler: googleComplete, write: true } },
};

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  const route = routes[pathname];
  if (!route) return notFound();
  const method = request.method === 'HEAD' ? 'GET' : request.method;
  const entry = route[method];
  if (!entry) {
    const allow = Object.keys(route);
    if (allow.includes('GET')) allow.push('HEAD');
    return methodNotAllowed(allow.join(', '));
  }
  if (entry.write && !fromOwnSite(request)) return json({ error: 'forbidden' }, 403);
  try {
    const response = entry.auth
      ? await accounts.withSession(request, env, entry.auth, entry.handler)
      : await entry.handler(request, env);
    return request.method === 'HEAD' ? withoutBody(response) : response;
  } catch (error) {
    if (error instanceof BadRequest) {
      return json({ error: error.code, ...(error.field ? { field: error.field } : {}) }, 400);
    }
    // The error name and first line only (no request data), so failures can be told apart.
    const detail = error instanceof Error ? `${error.name}: ${error.message.split('\n')[0]}` : '';
    console.error('api: request failed', detail.slice(0, 200));
    return json({ error: 'server_error' }, 500);
  }
}

export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}
