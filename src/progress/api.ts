// Browser side of the points and streak API (SCRUM-117/118). Only for signed-in players.
import type { FinishReply, Leaderboard, Progress } from '../../shared/api-types';
import { call } from '../account/api';

export type { LeaderboardRow, Offer, Progress, Streak } from '../../shared/api-types';

export const loadProgress = () => call<Progress>('/api/progress');
export const startLesson = (size: number) =>
  call<{ lessonId: string }>('/api/progress/lessons', 'POST', { size }).then((r) => r.lessonId);
export const finishLesson = (lessonId: string, size: number, points: number) =>
  call<FinishReply>('/api/progress/lessons/finish', 'POST', {
    lessonId,
    size,
    points,
  });
/** Answer today's unlock offer; `cost` is the price the child agreed to. */
export const answerStreak = (unlock: boolean, cost: number) =>
  call<Progress>('/api/progress/streak', 'POST', { unlock, cost });

/** SCRUM-148: leaderboard rows (only nickname, bear look, streak and points of other players). */
export const loadLeaderboard = () => call<Leaderboard>('/api/leaderboard');
