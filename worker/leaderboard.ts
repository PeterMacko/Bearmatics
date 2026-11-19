// SCRUM-148: leaderboard of all players who have it on and at least 1 point.
// Only nickname, bear, streak and points of other players are sent (no ids, no usernames).
import type { Leaderboard, LeaderboardRow } from '../shared/api-types';
import { isRudeNickname } from '../shared/rules';
import { Renewed, type SessionHandler } from './accounts';
import { slovakDay, streakView } from './streak';

export const TOP = 10;

export type Player = {
  id: string;
  nickname: string;
  bear: number;
  points: number;
  streak: number;
  frozen: boolean;
};

/**
 * Order and rows (scope 1-2): more points first; equal points share the place; within a tie a
 * longer streak first, then nickname A-Z. Top 10; if I am lower: a gap, the player before me,
 * me and the player after me.
 */
export function leaderboardRows(players: Player[], meId: string | null): Leaderboard {
  const sorted = [...players].sort(
    (a, b) =>
      b.points - a.points ||
      b.streak - a.streak ||
      a.nickname.localeCompare(b.nickname, 'sk', { sensitivity: 'base' }) ||
      a.nickname.localeCompare(b.nickname),
  );
  let place = 0;
  const all: LeaderboardRow[] = sorted.map((player, index) => {
    if (index === 0 || player.points !== sorted[index - 1].points) place = index + 1;
    return {
      place,
      nickname: player.nickname,
      bear: player.bear,
      points: player.points,
      streak: player.streak,
      frozen: player.frozen,
      me: player.id === meId,
    };
  });
  const mine = all.findIndex((row) => row.me);
  if (mine < TOP) return { rows: all.slice(0, TOP), gapBefore: null };
  // Me with one before and one after; at place 11 the one before is already in the top 10, so
  // the rows simply continue without a gap. `gapBefore` = index in `rows` where the gap is.
  const start = Math.max(mine - 1, TOP);
  const around = all.slice(start, mine + 2);
  return { rows: [...all.slice(0, TOP), ...around], gapBefore: start > TOP ? TOP : null };
}

export const getLeaderboard: SessionHandler = async (_request, env, session) => {
  const today = slovakDay(Date.now());
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.nickname, a.bear, p.points, p.streak, p.last_day, p.offer_day
     FROM progress p JOIN accounts a ON a.id = p.account_id
     WHERE p.points >= 1 AND a.leaderboard = 1`,
  ).all<{
    id: string;
    nickname: string;
    bear: number;
    points: number;
    streak: number;
    last_day: string | null;
    offer_day: string | null;
  }>();
  const players: Player[] = results
    // Nicknames from before the filter that fail it stay hidden until changed (scope 4).
    .filter((row) => !isRudeNickname(row.nickname))
    .map((row) => ({
      id: row.id,
      nickname: row.nickname,
      bear: row.bear,
      points: row.points,
      ...streakView(
        { streak: row.streak, lastDay: row.last_day, offerDay: row.offer_day },
        today,
        row.points,
      ),
    }));
  return new Renewed(leaderboardRows(players, session.account.id));
};
