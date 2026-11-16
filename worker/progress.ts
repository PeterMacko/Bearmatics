// SCRUM-117: points for finished lessons of signed-in players. The app counts the lesson's
// first-try answers; the server only stores one total and checks the limits:
// a lesson must be started while signed in, it counts once, and it gives at most its size.
import { currentSession, type AccountEnv } from './accounts';
import { randomHex } from './crypto';
import { BadRequest, json, readJson } from './http';
import {
  answerOffer,
  finishDay,
  openOffer,
  slovakDay,
  streakView,
  type Offer,
  type StreakState,
} from './streak';

export const LESSON_SIZES = [5, 10, 20] as const;
const KEEP_LESSONS_MS = 2 * 24 * 60 * 60 * 1000;
const now = () => Date.now();

const notSignedIn = () => json({ error: 'not_signed_in' }, 401);

type Row = { points: number; state: StreakState };

async function readRow(env: AccountEnv, accountId: string): Promise<Row> {
  const row = await env.DB.prepare(
    'SELECT points, streak, last_day, offer_day FROM progress WHERE account_id = ?',
  )
    .bind(accountId)
    .first<{ points: number; streak: number; last_day: string | null; offer_day: string | null }>();
  return {
    points: row?.points ?? 0,
    state: {
      streak: row?.streak ?? 0,
      lastDay: row?.last_day ?? null,
      offerDay: row?.offer_day ?? null,
    },
  };
}

/** Points plus the streak as the app shows it (SCRUM-118). */
function progressBody(row: Row, today: string) {
  return { points: row.points, ...streakView(row.state, today, row.points) };
}

/**
 * Writes a new streak state (and points) only if the row is still as read: two lessons
 * finishing at the same moment cannot both add a day. Returns false when the row changed.
 */
async function writeRow(env: AccountEnv, accountId: string, read: Row, next: Row) {
  const result = await env.DB.prepare(
    `UPDATE progress SET points = ?, streak = ?, last_day = ?, offer_day = ?
     WHERE account_id = ? AND points = ? AND streak = ? AND last_day IS ? AND offer_day IS ?`,
  )
    .bind(
      next.points,
      next.state.streak,
      next.state.lastDay,
      next.state.offerDay,
      accountId,
      read.points,
      read.state.streak,
      read.state.lastDay,
      read.state.offerDay,
    )
    .run();
  return result.meta.changes > 0;
}

export async function getProgress(request: Request, env: AccountEnv): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session) return notSignedIn();
  const row = await readRow(env, session.account.id);
  return json(progressBody(row, slovakDay(now())), 200, { 'set-cookie': session.renew });
}

/** The child answers today's unlock offer: {unlock: true|false, cost} (SCRUM-118 rule 5). */
export async function answerStreak(request: Request, env: AccountEnv): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session) return notSignedIn();
  const body = await readJson(request);
  if (typeof body.unlock !== 'boolean') throw new BadRequest('invalid', 'unlock');
  const accountId = session.account.id;
  for (let attempt = 0; attempt < 5; attempt++) {
    const today = slovakDay(now());
    const row = await readRow(env, accountId);
    const offer = openOffer(row.state, today, row.points);
    if (!offer) return json({ error: 'no_offer', ...progressBody(row, today) }, 409);
    // The child agreed to a price; if it changed meanwhile, show the new offer instead.
    if (body.unlock && body.cost !== offer.cost)
      return json({ error: 'offer_changed', offer, ...progressBody(row, today) }, 409);
    const answer = answerOffer(row.state, today, row.points, body.unlock)!;
    const next = { points: answer.points, state: answer.state };
    if (await writeRow(env, accountId, row, next))
      return json(progressBody(next, today), 200, { 'set-cookie': session.renew });
  }
  throw new Error('streak answer kept conflicting');
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
  // Only while the account still exists: it can be deleted (another device) after the session
  // was read. Then nothing is stored and the player is signed out.
  const [, inserted] = await env.DB.batch([
    env.DB.prepare('DELETE FROM lessons WHERE started_at < ?').bind(time - KEEP_LESSONS_MS),
    env.DB.prepare(
      `INSERT INTO lessons (id, account_id, size, started_at)
       SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM accounts WHERE id = ?)`,
    ).bind(id, session.account.id, size, time, session.account.id),
  ]);
  if (!inserted.meta.changes) return notSignedIn();
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
         AND EXISTS (SELECT 1 FROM accounts WHERE id = ?)
       ON CONFLICT (account_id) DO UPDATE SET points = points + excluded.points`,
    ).bind(accountId, earned, id, claim, accountId),
  ]);
  const stillThere = await env.DB.prepare('SELECT 1 AS ok FROM accounts WHERE id = ?')
    .bind(accountId)
    .first();
  if (!stillThere) {
    // Deleted meanwhile: remove anything this request may have written.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM lessons WHERE account_id = ?').bind(accountId),
      env.DB.prepare('DELETE FROM progress WHERE account_id = ?').bind(accountId),
    ]);
    return notSignedIn();
  }
  const counted = await env.DB.prepare('SELECT 1 AS ok FROM lessons WHERE id = ? AND claim = ?')
    .bind(id, claim)
    .first();
  // SCRUM-118: a counted lesson is a played day. A repeated save of the same lesson never
  // reaches this, so it cannot add a day or make a second offer.
  let offer: Offer | null = null;
  let row = await readRow(env, accountId);
  const today = slovakDay(now());
  if (counted) {
    for (let attempt = 0; ; attempt++) {
      const day = finishDay(row.state, today, row.points);
      offer = day.offer;
      const next = { points: row.points, state: day.state };
      const same =
        next.state.streak === row.state.streak &&
        next.state.lastDay === row.state.lastDay &&
        next.state.offerDay === row.state.offerDay;
      if (same || (await writeRow(env, accountId, row, next))) {
        row = next;
        break;
      }
      if (attempt >= 4) throw new Error('streak update kept conflicting');
      row = await readRow(env, accountId);
    }
  } else {
    // A repeated save (e.g. Try again after a lost answer) changes nothing, but still shows
    // today's open offer (QA131-04).
    offer = openOffer(row.state, today, row.points);
  }
  return json({ ...progressBody(row, today), added: counted ? earned : 0, offer }, 200, {
    'set-cookie': session.renew,
  });
}
