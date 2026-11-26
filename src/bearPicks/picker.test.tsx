import { describe, expect, it } from 'vitest';
import { LEVEL_AGES, MAX_AGE, MIN_AGE } from '../levelAges';
import type { PointsCourse } from '../progress/multipliers';
import { seeded } from '../testing/seeded';
import { gamesForAge, pickAnother, pickGame, sameGame, type Game } from './picker';

const AGES = [5, 6, 7, 8, 9] as const;
const key = (g: Game) => `${g.course}:${g.shown}`;
const fitsAge = (g: Game, age: number) =>
  LEVEL_AGES.some(
    (r) => r.course === g.course && r.shown === g.shown && age >= r.from && age <= r.to,
  );

describe('games per age (SCRUM-308 table)', () => {
  it('pins the pool sizes 11 / 13 / 14 / 14 / 11 and age 9 = maths 4, logic 1, english 3, word search 3', () => {
    expect(AGES.map((age) => gamesForAge(age).length)).toEqual([11, 13, 14, 14, 11]);
    expect([MIN_AGE, MAX_AGE]).toEqual([5, 9]);
    const per = (age: number) => {
      const out: Partial<Record<PointsCourse, number>> = {};
      for (const g of gamesForAge(age)) out[g.course] = (out[g.course] ?? 0) + 1;
      return out;
    };
    expect(per(9)).toEqual({ math: 4, logic: 1, english: 3, wordsearch: 3 });
  });
});

// AC1: with a fixed seed, 10,000 picks per age only return games of that age, never the
// previous game, never the game just turned down; course shares equal within +-3 points.
describe('10,000 picks per age (fixed seed)', () => {
  for (const age of AGES)
    it(`age ${age}: right age, never the previous or the turned-down game, equal course shares`, () => {
      const rng = seeded(309_000 + age);
      const choose = seeded(age); // when the child presses "Choose another"
      let previous: Game | null = null; // the last played game of this run
      const chosen: Partial<Record<PointsCourse, number>> = {};
      const expected: Partial<Record<PointsCourse, number>> = {};
      let picks = 0;
      const count = (pick: Game, exclude: (Game | null)[]) => {
        // The courses the pick could choose from (after the exclusions): 1/k each.
        const courses = new Set(
          gamesForAge(age)
            .filter((g) => !exclude.some((x) => sameGame(g, x)))
            .map((g) => g.course),
        );
        for (const c of courses) expected[c] = (expected[c] ?? 0) + 1 / courses.size;
        chosen[pick.course] = (chosen[pick.course] ?? 0) + 1;
        picks++;
      };
      while (picks < 10_000) {
        let shown: Game = pickGame(age, [previous], rng)!;
        count(shown, [previous]);
        expect(fitsAge(shown, age)).toBe(true);
        expect(sameGame(shown, previous)).toBe(false);
        // Sometimes "Choose another" (up to 3 times in a row), then the shown game is played.
        while (choose() < 0.4 && picks < 10_000) {
          const another = pickAnother(age, shown, previous, rng)!;
          count(another, [shown, previous]);
          expect(fitsAge(another, age)).toBe(true);
          expect(sameGame(another, shown)).toBe(false);
          expect(sameGame(another, previous)).toBe(false);
          shown = another;
        }
        previous = shown;
      }
      const deviations = Object.keys(expected).map((c) => {
        const course = c as PointsCourse;
        return Math.abs(((chosen[course] ?? 0) - expected[course]!) / picks) * 100;
      });
      expect(Math.max(...deviations)).toBeLessThanOrEqual(3);
    });

  for (const age of AGES)
    it(`age ${age}: a fresh mode start (nothing excluded) gives every course the same share`, () => {
      const rng = seeded(4242 + age);
      const tally: Record<string, number> = {};
      const levels: Record<string, number> = {};
      for (let i = 0; i < 10_000; i++) {
        const g = pickGame(age, [], rng)!;
        tally[g.course] = (tally[g.course] ?? 0) + 1;
        levels[key(g)] = (levels[key(g)] ?? 0) + 1;
      }
      const courses = Object.keys(tally);
      expect(courses.sort()).toEqual([...new Set(gamesForAge(age).map((g) => g.course))].sort());
      for (const c of courses)
        expect(Math.abs((tally[c] / 10_000) * 100 - 100 / courses.length)).toBeLessThanOrEqual(3);
      // Every game of the age comes up.
      expect(Object.keys(levels).sort()).toEqual(gamesForAge(age).map(key).sort());
    });
});

describe('excluded games are removed before the course is chosen', () => {
  it('age 9: with its only Logic level excluded, Logic never comes and the 3 others share equally', () => {
    const rng = seeded(9);
    const logic: Game = { course: 'logic', shown: 2 };
    const tally: Record<string, number> = {};
    for (let i = 0; i < 9_000; i++) {
      const g = pickGame(9, [logic], rng)!;
      tally[g.course] = (tally[g.course] ?? 0) + 1;
    }
    expect(tally.logic).toBeUndefined();
    for (const c of ['math', 'english', 'wordsearch'])
      expect(Math.abs(tally[c] / 9_000 - 1 / 3)).toBeLessThan(0.03);
  });
  it('Choose another always shows a different game, also pressed many times in a row', () => {
    for (const age of AGES) {
      const rng = seeded(age * 7);
      let shown = pickGame(age, [], rng)!;
      const last = pickGame(age, [shown], rng)!;
      for (let i = 0; i < 500; i++) {
        const another = pickAnother(age, shown, last, rng)!;
        expect(another).not.toBeNull();
        expect(sameGame(another, shown)).toBe(false);
        shown = another;
      }
    }
  });
  it('a pool of two: Choose another keeps the last game out until only it is left', () => {
    const rows = [
      { course: 'math' as const, shown: 1, from: 5, to: 5 },
      { course: 'math' as const, shown: 2, from: 5, to: 5 },
    ];
    const one: Game = { course: 'math', shown: 1 };
    const two: Game = { course: 'math', shown: 2 };
    expect(pickGame(5, [one, two], Math.random, rows)).toBeNull();
    // Everything else excluded: the last played game comes back rather than nothing.
    expect(pickAnother(5, two, one, Math.random, rows)).toEqual(one);
    expect(pickGame(5, [one], () => 0.99, rows)).toEqual(two);
    expect(pickGame(6, [], Math.random, rows)).toBeNull();
  });
  it('an rng that returns exactly 1 stays in range', () => {
    expect(
      fitsAge(
        pickGame(7, [], () => 1)!,
        7,
      ),
    ).toBe(true);
    expect(
      fitsAge(
        pickGame(7, [], () => 0)!,
        7,
      ),
    ).toBe(true);
  });
});
