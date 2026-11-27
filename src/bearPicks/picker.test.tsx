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
  // SCRUM-324: + Logic 6-8 (Pexeso) at every age.
  it('pins the pool sizes 14 / 16 / 17 / 17 / 14 and age 9 = maths 4, logic 4, english 3, word search 3', () => {
    expect(AGES.map((age) => gamesForAge(age).length)).toEqual([14, 16, 17, 17, 14]);
    expect([MIN_AGE, MAX_AGE]).toEqual([5, 9]);
    const per = (age: number) => {
      const out: Partial<Record<PointsCourse, number>> = {};
      for (const g of gamesForAge(age)) out[g.course] = (out[g.course] ?? 0) + 1;
      return out;
    };
    expect(per(9)).toEqual({ math: 4, logic: 4, english: 3, wordsearch: 3 });
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
  // SCRUM-324: age 9 now has 4 Logic levels, so the course with one game is word search at 5.
  it('age 5: with its only Word search level excluded, Word search never comes and the 3 others share equally', () => {
    const rng = seeded(9);
    const search: Game = { course: 'wordsearch', shown: 1 };
    const tally: Record<string, number> = {};
    for (let i = 0; i < 9_000; i++) {
      const g = pickGame(5, [search], rng)!;
      tally[g.course] = (tally[g.course] ?? 0) + 1;
    }
    expect(tally.wordsearch).toBeUndefined();
    for (const c of ['small', 'logic', 'english'])
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

// SCRUM-324: Pexeso (Logic 6-8) shares Logic's course chance: per pick 1/courses x 3/logic levels
// (analysis share.py: 9.4 / 7.5 / 8.6 / 15 / 18.8 %), and every Pexeso level comes up at every age.
describe('Pexeso inside the Logic course share', () => {
  const pexeso = (g: Game) => g.course === 'logic' && g.shown >= 6;
  it('the exact chance per age is 9.375 / 7.5 / 8.57 / 15 / 18.75 %', () => {
    const share = (age: number) => {
      const pool = gamesForAge(age);
      const courses = new Set(pool.map((g) => g.course)).size;
      const logic = pool.filter((g) => g.course === 'logic').length;
      return (1 / courses) * (pool.filter(pexeso).length / logic);
    };
    expect(AGES.map((age) => Math.round(share(age) * 1000) / 10)).toEqual([
      9.4, 7.5, 8.6, 15, 18.8,
    ]);
  });
  it('10,000 seeded picks per age: each Pexeso level comes, the share within 1.5 points', () => {
    const expected = { 5: 9.375, 6: 7.5, 7: 8.571, 8: 15, 9: 18.75 } as const;
    for (const age of AGES) {
      const rng = seeded(324_000 + age);
      const seen = new Set<number>();
      let hits = 0;
      for (let i = 0; i < 10_000; i++) {
        const g = pickGame(age, [], rng)!;
        if (pexeso(g)) {
          hits++;
          seen.add(g.shown);
        }
      }
      expect([...seen].sort(), `age ${age}`).toEqual([6, 7, 8]);
      expect(Math.abs(hits / 100 - expected[age]), `age ${age}`).toBeLessThan(1.5);
    }
  });
});
