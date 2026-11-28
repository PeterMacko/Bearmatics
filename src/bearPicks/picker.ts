// SCRUM-309 "Bear picks a game": the bear picks a random game that suits the child's age.
// Pure functions; the random source is passed in (seeded in tests).

import { pickOne } from '../../shared/random';
import { LEVEL_AGES, type AgeRow } from '../levelAges';
import type { PointsCourse } from '../progress/multipliers';

/** One game = one course level as shown in that course's menu. */
export type Game = { course: PointsCourse; shown: number };

export const sameGame = (a: Game | null | undefined, b: Game | null | undefined) =>
  !!a && !!b && a.course === b.course && a.shown === b.shown;

/** Every game whose age range contains `age` (9 = "9 and older"), in table order. */
export function gamesForAge(age: number, rows: readonly AgeRow[] = LEVEL_AGES): Game[] {
  return rows
    .filter((r) => age >= r.from && age <= r.to)
    .map((r) => ({ course: r.course, shown: r.shown }));
}

/**
 * The next game: the pool is the age's games minus `exclude` (the last played game and the one
 * just turned down with "Choose another"). Removed BEFORE the course is chosen: a course whose
 * only game is excluded has no chance at all. Then one course with equal chance among the
 * courses left, then one of its levels with equal chance. Null only when nothing is left.
 */
export function pickGame(
  age: number,
  exclude: readonly (Game | null | undefined)[],
  rng: () => number,
  rows: readonly AgeRow[] = LEVEL_AGES,
): Game | null {
  const pool = gamesForAge(age, rows).filter((g) => !exclude.some((x) => sameGame(g, x)));
  if (pool.length === 0) return null;
  const courses = [...new Set(pool.map((g) => g.course))];
  const course = pickOne(courses, rng);
  const levels = pool.filter((g) => g.course === course);
  return pickOne(levels, rng);
}

/**
 * "Choose another": never the game on screen; the last played game stays out too, unless
 * that leaves nothing (then only the game on screen is excluded).
 */
export function pickAnother(
  age: number,
  shownGame: Game,
  lastPlayed: Game | null,
  rng: () => number,
  rows: readonly AgeRow[] = LEVEL_AGES,
): Game | null {
  return pickGame(age, [shownGame, lastPlayed], rng, rows) ?? pickGame(age, [shownGame], rng, rows);
}
