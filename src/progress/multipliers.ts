// SCRUM-202: daily points multipliers per level. Playing the same easy level again and again
// on one day gives fewer points; the first play of the day of each course's top level gives
// more. The rows below are the whole configuration (code only, no settings screen).

/** The courses as the app names them (CourseChoice). */
export type PointsCourse = 'small' | 'math' | 'english';

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

/** The top level of a course: its first play of the day gives one and a half times the points. */
const top = (course: PointsCourse, level: number): MultiplierRow => ({
  course,
  levels: [level, level],
  plays: [1, 1],
  multiplier: 1.5,
});

/** The initial table (Jira SCRUM-202). Anything without a row is x1. */
export const MULTIPLIER_ROWS: readonly MultiplierRow[] = [
  ...repeated('small', 1, 2),
  ...repeated('math', 1, 6),
  ...repeated('english', 1, 2),
  top('small', 3),
  top('math', 7),
  top('english', 3),
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
