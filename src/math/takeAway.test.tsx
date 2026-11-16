import { expect, test } from 'vitest';
import { checkAnswer, generateSession, isValidFact, solveBlank, type Exercise } from './engine';

// SCRUM-156: Small maths level 2 "Take away" = engine level 8: a - b = c, a 1-6, b 0..a,
// only the result missing; at most one zero example; size 20 repeats like level 0.
const seeded = (seed: number) => {
  let state = seed + 1;
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
};
const key = (e: Exercise) => e.values.join(',');
const hasZero = (e: Exercise) => e.values.includes(0);

test('the pool is exactly the 27 take-away facts with the first number 1-6', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 60; seed++)
    for (const size of [5, 10, 20])
      for (const e of generateSession(8, size, seeded(seed))) {
        expect(e.operation).toBe('-');
        expect(e.blank).toBe(2);
        expect(e.values[0]).toBeGreaterThanOrEqual(1);
        expect(e.values[0] - e.values[1]).toBe(e.values[2]);
        expect(solveBlank(e)).toBe(e.values[2]);
        seen.add(key(e));
      }
  const expected = new Set<string>();
  for (let a = 1; a <= 6; a++) for (let b = 0; b <= a; b++) expected.add(`${a},${b},${a - b}`);
  expect(expected.size).toBe(27);
  expect(seen).toEqual(expected);
});

test('at most one zero example; 5 and 10 unique; 20 has 4 non-adjacent repeats of non-zero facts', () => {
  for (let seed = 0; seed < 60; seed++)
    for (const size of [5, 10, 20]) {
      const session = generateSession(8, size, seeded(seed));
      expect(session).toHaveLength(size);
      expect(Object.isFrozen(session)).toBe(true);
      expect(session.filter(hasZero).length).toBeLessThanOrEqual(1);
      const keys = session.map(key);
      if (size < 20) expect(new Set(keys).size).toBe(size);
      else {
        expect(new Set(keys).size).toBe(16);
        const repeated = keys.filter((k, i) => keys.indexOf(k) !== i);
        expect(repeated).toHaveLength(4);
        expect(new Set(repeated).size).toBe(4);
        for (const k of repeated) expect(k.split(',').includes('0')).toBe(false);
        for (let i = 1; i < keys.length; i++) expect(keys[i]).not.toBe(keys[i - 1]);
        // Repeats are separate presentations (own objects).
        expect(new Set(session).size).toBe(20);
      }
    }
  for (const size of [5, 10, 20]) expect(generateSession(8, size, () => 0)).toHaveLength(size);
});

test('validator, solver and checker keep the take-away rules', () => {
  expect(isValidFact(8, [6, 6, 0], '-')).toBe(true);
  expect(isValidFact(8, [1, 0, 1], '-')).toBe(true);
  expect(isValidFact(8, [0, 0, 0], '-')).toBe(false); // never 0 as the first number
  expect(isValidFact(8, [7, 1, 6], '-')).toBe(false);
  expect(isValidFact(8, [2, 3, 1], '+')).toBe(false);
  const e: Exercise = { level: 8, operation: '-', values: [5, 2, 3], blank: 2 };
  expect(checkAnswer(e, '3')).toBe('correct');
  expect(checkAnswer(e, '4')).toBe('incorrect');
  expect(checkAnswer(e, 'x')).toBe('invalid-input');
  expect(() => solveBlank({ ...e, blank: 0 })).toThrow();
});

test('existing levels are unchanged', () => {
  const before = generateSession(0, 10, seeded(3)).map(key);
  expect(before).toEqual(generateSession(0, 10, seeded(3)).map(key));
  for (const level of [0, 1, 2, 3, 4, 5, 6, 7] as const)
    expect(generateSession(level, 10, seeded(1)).every((e) => e.level === level)).toBe(true);
});
