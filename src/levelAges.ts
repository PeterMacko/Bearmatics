// SCRUM-308: the suggested age range of every game (course level), from-to in years. The menus
// show it as a small badge; the later mode "Bear picks a game" (SCRUM-309) picks games by it.
// Ages are information only: they never hide a level, change points or the saved level choice.

import type { PointsCourse } from './progress/multipliers';

/** The app's youngest and oldest age; 9 means "9 and older". */
export const MIN_AGE = 5;
export const MAX_AGE = 9;

export type AgeRow = {
  course: PointsCourse;
  /** The level as SHOWN in that course's menu (same key as the multiplier rows). */
  shown: number;
  from: number;
  to: number;
};

export type AgeRange = { from: number; to: number };

const row = (course: PointsCourse, shown: number, from: number, to: number): AgeRow => ({
  course,
  shown,
  from,
  to,
});

/** The approved table (Jira SCRUM-308): one row per menu level, 24 rows (SCRUM-324: Logic 6-8). */
export const LEVEL_AGES: readonly AgeRow[] = [
  row('small', 1, 5, 6), // Count the pictures
  row('small', 2, 5, 7), // Take away
  row('small', 3, 5, 7), // Up to 12
  row('math', 1, 6, 7), // Hello, addition!
  row('math', 2, 6, 8), // First steps
  row('math', 3, 7, 8), // Find the result
  row('math', 4, 7, 9), // Find the missing number
  row('math', 5, 8, 9), // Big number adventure
  row('math', 6, 8, 9), // Equal groups
  row('math', 7, 8, 9), // Multiply & share
  row('logic', 1, 5, 7), // Bear goes to the honey
  row('logic', 2, 5, 9), // Around the stones
  row('logic', 3, 5, 6), // What comes next?
  row('logic', 4, 5, 7), // What is missing?
  row('logic', 5, 5, 8), // Growing and turning
  row('logic', 6, 5, 9), // Pexeso / Matching pairs, 6 pictures (SCRUM-324)
  row('logic', 7, 5, 9), // Pexeso / Matching pairs, 10 pictures
  row('logic', 8, 5, 9), // Pexeso / Matching pairs, 15 pictures
  row('english', 1, 5, 9), // Listen and choose
  row('english', 2, 5, 9), // Listen and choose: similar-sounding words
  row('english', 3, 8, 9), // Listen and write
  row('wordsearch', 1, 5, 9), // Find the words
  row('wordsearch', 2, 7, 9), // Listen and find
  row('wordsearch', 3, 8, 9), // All directions
];

/** The age range of a level as shown in a course's menu; undefined when the table has no row. */
export function ageRange(
  course: PointsCourse,
  shown: number,
  rows: readonly AgeRow[] = LEVEL_AGES,
): AgeRange | undefined {
  const found = rows.find((r) => r.course === course && r.shown === shown);
  return found && { from: found.from, to: found.to };
}
