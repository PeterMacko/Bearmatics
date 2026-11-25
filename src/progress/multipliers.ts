// SCRUM-202: daily points multipliers per level. Playing the same easy level again and again
// on one day gives fewer points; the first play of the day of the harder levels (Maths 4-7,
// level 3 of Small maths and English) gives more. The rows below are the whole configuration
// (code only, no settings screen).

/** The courses as the app names them (CourseChoice). */
export type PointsCourse = 'small' | 'logic' | 'math' | 'english' | 'wordsearch';

/** Allowed multipliers: whole points, half, quarter, one and a half. */
export type Multiplier = 1 | 0.5 | 0.25 | 1.5;

export type MultiplierRow = {
  course: PointsCourse;
  /** Levels as SHOWN to children in that course's menu, both ends included. */
  levels: readonly [from: number, to: number];
  /** Play of the day (1 = first), both ends included; `to` null = no end. */
  plays: readonly [from: number, to: number | null];
  multiplier: Multiplier;
};

/** Plays 3-4 give half points, play 5 and later a quarter (the easy levels of a course). */
const repeated = (course: PointsCourse, from: number, to: number): MultiplierRow[] => [
  { course, levels: [from, to], plays: [3, 4], multiplier: 0.5 },
  { course, levels: [from, to], plays: [5, null], multiplier: 0.25 },
];

/** Harder levels: the first play of the day gives one and a half times the points, then x1. */
const bonus = (course: PointsCourse, from: number, to: number): MultiplierRow => ({
  course,
  levels: [from, to],
  plays: [1, 1],
  multiplier: 1.5,
});

/**
 * The table (Jira SCRUM-202; Peter's revision: Maths levels 4-7 all get the first-play bonus
 * and are never reduced). Anything without a row is x1 (Logic has no row, SCRUM-262; Word
 * search neither, SCRUM-241).
 */
export const MULTIPLIER_ROWS: readonly MultiplierRow[] = [
  ...repeated('small', 1, 2),
  ...repeated('math', 1, 3),
  ...repeated('english', 1, 2),
  bonus('small', 3, 3),
  bonus('math', 4, 7),
  bonus('english', 3, 3),
];

/**
 * The multiplier for one play: `play` is its number that day (1 for the first), i.e. the
 * count of earlier saved plays of this course and level today plus one.
 */
export function multiplierFor(
  course: PointsCourse,
  level: number,
  play: number,
  rows: readonly MultiplierRow[] = MULTIPLIER_ROWS,
): Multiplier {
  const row = rows.find(
    (r) =>
      r.course === course &&
      level >= r.levels[0] &&
      level <= r.levels[1] &&
      play >= r.plays[0] &&
      (r.plays[1] === null || play <= r.plays[1]),
  );
  return row ? row.multiplier : 1;
}

/**
 * The lesson's points: first-try answers times the multiplier, rounded up, in whole numbers
 * (multipliers as quarters, so no floating point: ceil(firstTry * q / 4)). 0 stays 0.
 */
export function multipliedPoints(firstTry: number, multiplier: Multiplier): number {
  const quarters = Math.round(multiplier * 4);
  return Math.ceil((firstTry * quarters) / 4);
}

/** Names of the multipliers other than x1, for copy keys and CSS classes. */
export type MultiplierName = 'half' | 'quarter' | 'bonus';

export function multiplierName(multiplier: Exclude<Multiplier, 1>): MultiplierName {
  return multiplier === 0.5 ? 'half' : multiplier === 0.25 ? 'quarter' : 'bonus';
}
