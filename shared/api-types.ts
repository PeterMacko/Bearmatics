// Shapes of /api answers, used by the server that sends them and the app that reads them.
// Types only: nothing here ends up in either build.

/** What the browser may see about the signed-in account. */
export type Account = {
  kind: 'password' | 'google';
  username: string | null;
  nickname: string;
  bear: number;
  email: string | null;
  /** SCRUM-148: shown on the leaderboard (on by default). */
  leaderboard: boolean;
};

/** SCRUM-118: today's offer to unlock a frozen streak. */
export type Offer = { streak: number; missed: number; cost: number };

/** SCRUM-148: leaderboard rows (only nickname, bear, streak and points of other players). */
export type LeaderboardRow = {
  place: number;
  nickname: string;
  bear: number;
  points: number;
  streak: number;
  frozen: boolean;
  me: boolean;
};

/** `gapBefore` = index in `rows` where a gap is shown, or null. */
export type Leaderboard = { rows: LeaderboardRow[]; gapBefore: number | null };
