// SCRUM-117: points for finished lessons of signed-in players. The app counts the lesson's
// first-try answers; the server only stores one total and checks the limits:
// a lesson must be started while signed in, it counts once, and it gives at most its size.
import { currentSession, type AccountEnv } from './accounts';
import { randomHex } from './crypto';
import { BadRequest, json, readJson } from './http';

export const LESSON_SIZES = [5, 10, 20] as const;
const KEEP_LESSONS_MS = 2 * 24 * 60 * 60 * 1000;
const now = () => Date.now();

const notSignedIn = () => json({ error: 'not_signed_in' }, 401);

async function points(env: AccountEnv, accountId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT points FROM progress WHERE account_id = ?')
    .bind(accountId)
    .first<{ points: number }>();
  return row?.points ?? 0;
}

export async function getProgress(request: Request, env: AccountEnv): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session) return notSignedIn();
  return json({ points: await points(env, session.account.id) }, 200, {
    'set-cookie': session.renew,
  });
}

function lessonSize(value: unknown): number {
  if (!LESSON_SIZES.includes(value as 5)) throw new BadRequest('invalid', 'size');
  return value as number;
}

/** A lesson starts: remember its ID and size for this account (only while signed in). */
export async function startLesson(request: Request, env: AccountEnv): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session) return notSignedIn();
  const body = await readJson(request);
  const size = lessonSize(body.size);
  const id = randomHex(16);
  const time = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM lessons WHERE started_at < ?').bind(time - KEEP_LESSONS_MS),
    env.DB.prepare(
      'INSERT INTO lessons (id, account_id, size, started_at) VALUES (?, ?, ?, ?)',
    ).bind(id, session.account.id, size, time),
  ]);
  return json({ lessonId: id }, 201, { 'set-cookie': session.renew });
}

/** A lesson is finished (including its review round): add its points once. */
export async function finishLesson(request: Request, env: AccountEnv): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session) return notSignedIn();
  const body = await readJson(request);
  const id = body.lessonId;
  if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) {
    throw new BadRequest('invalid', 'lessonId');
  }
  const size = lessonSize(body.size);
  const earned = body.points;
  if (typeof earned !== 'number' || !Number.isInteger(earned) || earned < 0 || earned > size) {
    throw new BadRequest('invalid', 'points');
  }
  const accountId = session.account.id;
  const lesson = await env.DB.prepare(
    'SELECT size, started_at, finished_at FROM lessons WHERE id = ? AND account_id = ?',
  )
    .bind(id, accountId)
    .first<{ size: number; started_at: number; finished_at: number | null }>();
  if (!lesson || lesson.started_at < now() - KEEP_LESSONS_MS) {
    return json({ error: 'unknown_lesson' }, 404);
  }
  if (lesson.size !== size) throw new BadRequest('invalid', 'size');
  // One transaction: claim the lesson (only if not yet finished), then add the points only
  // when this request made the claim. A repeated or parallel save adds nothing.
  const claim = randomHex(16);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE lessons SET finished_at = ?, claim = ?
       WHERE id = ? AND account_id = ? AND finished_at IS NULL`,
    ).bind(now(), claim, id, accountId),
    env.DB.prepare(
      `INSERT INTO progress (account_id, points)
       SELECT ?, ? WHERE EXISTS (SELECT 1 FROM lessons WHERE id = ? AND claim = ?)
       ON CONFLICT (account_id) DO UPDATE SET points = points + excluded.points`,
    ).bind(accountId, earned, id, claim),
  ]);
  const counted = await env.DB.prepare('SELECT 1 AS ok FROM lessons WHERE id = ? AND claim = ?')
    .bind(id, claim)
    .first();
  return json({ points: await points(env, accountId), added: counted ? earned : 0 }, 200, {
    'set-cookie': session.renew,
  });
}
