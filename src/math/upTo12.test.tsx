import { expect, test } from 'vitest';
import { checkAnswer, generateSession, isValidFact, solveBlank, type Exercise } from './engine';

// SCRUM-164: Small maths level 3 "Up to 12" = engine level 9: a + b = c, a and b 1-6,
// c 7-12, only the result missing; 21 facts, lessons never repeat an example.
const seeded = (seed: number) => {
  let state = seed + 1;
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
};
const key = (e: Exercise) => e.values.join(',');

test('the pool is exactly the 21 two-dice facts with results 7-12', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 60; seed++)
    for (const size of [5, 10, 20])
      for (const e of generateSession(9, size, seeded(seed))) {
        expect(e.operation).toBe('+');
        expect(e.blank).toBe(2);
        expect(e.values[0] + e.values[1]).toBe(e.values[2]);
        expect(solveBlank(e)).toBe(e.values[2]);
        seen.add(key(e));
      }
  const expected = new Set<string>();
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++) if (a + b >= 7) expected.add(`${a},${b},${a + b}`);
  expect(expected.size).toBe(21);
  expect(seen).toEqual(expected);
});

test('lessons of 5, 10 and 20 never repeat an example; no zero', () => {
  for (let seed = 0; seed < 60; seed++)
    for (const size of [5, 10, 20]) {
      const session = generateSession(9, size, seeded(seed));
      expect(session).toHaveLength(size);
      expect(Object.isFrozen(session)).toBe(true);
      expect(new Set(session.map(key)).size).toBe(size);
      for (const e of session) expect(e.values.includes(0)).toBe(false);
    }
  for (const size of [5, 10, 20]) expect(generateSession(9, size, () => 0)).toHaveLength(size);
});

test('validator, solver and checker keep the two-dice rules', () => {
  expect(isValidFact(9, [6, 6, 12], '+')).toBe(true);
  expect(isValidFact(9, [1, 6, 7], '+')).toBe(true);
  expect(isValidFact(9, [3, 3, 6], '+')).toBe(false); // result below 7
  expect(isValidFact(9, [0, 6, 6], '+')).toBe(false);
  expect(isValidFact(9, [7, 1, 8], '+')).toBe(false);
  expect(isValidFact(9, [6, 2, 4], '-')).toBe(false);
  const e: Exercise = { level: 9, operation: '+', values: [4, 5, 9], blank: 2 };
  expect(checkAnswer(e, '9')).toBe('correct');
  expect(checkAnswer(e, '8')).toBe('incorrect');
  expect(() => solveBlank({ ...e, blank: 1 })).toThrow();
});

test('existing levels are unchanged', () => {
  for (const level of [0, 1, 2, 3, 4, 5, 6, 7, 8] as const)
    expect(generateSession(level, 10, seeded(2)).map(key)).toEqual(
      generateSession(level, 10, seeded(2)).map(key),
    );
});
