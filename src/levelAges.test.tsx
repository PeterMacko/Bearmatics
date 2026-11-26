import { expect, test } from 'vitest';
import { MATH_LEVELS, SMALL_MATH_LEVELS } from './courses';
import { ENGLISH_LEVELS } from './EnglishHome';
import { LEVEL_AGES, MAX_AGE, MIN_AGE, ageRange } from './levelAges';
import { LOGIC_LEVELS } from './logic/bearPath';
import { PATTERN_LEVELS } from './logic/patterns';
import type { PointsCourse } from './progress/multipliers';
import { SEARCH_LEVELS } from './wordsearch/grid';

// SCRUM-308: one age row per menu level. The menu levels come from the menus' own sources
// (not a copy of the table), so a new level without an age fails here.
const MENU_LEVELS: Record<PointsCourse, readonly number[]> = {
  small: SMALL_MATH_LEVELS.map((l) => l.shown),
  math: MATH_LEVELS.map((l) => l.shown),
  logic: [...LOGIC_LEVELS, ...PATTERN_LEVELS],
  english: ENGLISH_LEVELS,
  wordsearch: SEARCH_LEVELS,
};
const menu = Object.entries(MENU_LEVELS).flatMap(([course, levels]) =>
  levels.map((shown) => ({ course: course as PointsCourse, shown })),
);

test('all 21 menu levels have exactly one age row, from <= to, both within 5-9', () => {
  expect(menu).toHaveLength(21);
  for (const { course, shown } of menu) {
    const rows = LEVEL_AGES.filter((r) => r.course === course && r.shown === shown);
    expect(rows, `${course} ${shown}`).toHaveLength(1);
    const [{ from, to }] = rows;
    expect(from).toBeLessThanOrEqual(to);
    expect(from).toBeGreaterThanOrEqual(MIN_AGE);
    expect(to).toBeLessThanOrEqual(MAX_AGE);
  }
  // No row for a level that is not in a menu.
  expect(LEVEL_AGES).toHaveLength(menu.length);
  expect([MIN_AGE, MAX_AGE]).toEqual([5, 9]);
});

test('the table is the approved one (Jira SCRUM-308)', () => {
  const text = LEVEL_AGES.map((r) => `${r.course} ${r.shown}: ${r.from}-${r.to}`);
  expect(text).toEqual([
    'small 1: 5-6',
    'small 2: 5-7',
    'small 3: 5-7',
    'math 1: 6-7',
    'math 2: 6-8',
    'math 3: 7-8',
    'math 4: 7-9',
    'math 5: 8-9',
    'math 6: 8-9',
    'math 7: 8-9',
    'logic 1: 5-7',
    'logic 2: 5-9',
    'logic 3: 5-6',
    'logic 4: 5-7',
    'logic 5: 5-8',
    'english 1: 5-9',
    'english 2: 5-9',
    'english 3: 8-9',
    'wordsearch 1: 5-9',
    'wordsearch 2: 7-9',
    'wordsearch 3: 8-9',
  ]);
});

test('games per age: 5 -> 11, 6 -> 13, 7 -> 14, 8 -> 14, 9 -> 11', () => {
  const perAge = Object.fromEntries(
    [5, 6, 7, 8, 9].map((age) => [
      age,
      LEVEL_AGES.filter((r) => r.from <= age && age <= r.to).length,
    ]),
  );
  expect(perAge).toEqual({ 5: 11, 6: 13, 7: 14, 8: 14, 9: 11 });
});

test('ageRange looks a level up by course and level as shown', () => {
  expect(ageRange('math', 4)).toEqual({ from: 7, to: 9 });
  expect(ageRange('small', 1)).toEqual({ from: 5, to: 6 });
  expect(ageRange('english', 3)).toEqual({ from: 8, to: 9 });
  expect(ageRange('math', 8)).toBeUndefined();
  expect(ageRange('logic', 0)).toBeUndefined();
});
