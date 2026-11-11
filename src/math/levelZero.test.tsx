import { expect, test } from 'vitest';
import { generateSession, isValidFact, solveBlank, checkAnswer, type Exercise } from './engine';
import { createHint } from './hints';

test('level zero generates finite immutable result-only addition sessions including every ordered fact', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 40; seed++) {
    let state = seed + 1;
    const rng = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (const size of [5, 10, 20]) {
      const session = generateSession(0, size, rng);
      expect(session).toHaveLength(size);
      expect(Object.isFrozen(session)).toBe(true);
      expect(new Set(session.map(e => e.values.join(','))).size).toBe(size);
      for (const e of session) {
        expect(e.operation).toBe('+'); expect(e.blank).toBe(2);
        expect(e.values[0] + e.values[1]).toBe(e.values[2]);
        expect(e.values.every(n => n >= 0 && n <= 6)).toBe(true);
        expect(Object.isFrozen(e) && Object.isFrozen(e.values)).toBe(true);
        expect(solveBlank(e)).toBe(e.values[2]);
        seen.add(e.values.join(','));
      }
    }
  }
  const expected = new Set<string>();
  for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6 - a; b++) expected.add(`${a},${b},${a + b}`);
  expect(seen).toEqual(expected); expect(seen.size).toBe(28);
  for (const size of [5, 10, 20]) expect(generateSession(0, size, () => 0)).toHaveLength(size);
});

test('all eight levels terminate with unique immutable sessions even under constant randomness', () => {
  for (const level of [0, 1, 2, 3, 4, 5, 6, 7] as const) for (const size of [5, 10, 20]) {
    const session = generateSession(level, size, () => 0);
    expect(session).toHaveLength(size);
    expect(Object.isFrozen(session)).toBe(true);
    expect(new Set(session.map(e => `${e.operation}:${e.blank}:${e.values.join(',')}`)).size).toBe(size);
    for (const e of session) expect(Object.isFrozen(e) && Object.isFrozen(e.values)).toBe(true);
  }
});

test('level zero boundaries and policy are enforced by validator solver checker and hints', () => {
  for (const values of [[0, 0, 0], [0, 6, 6], [6, 0, 6], [3, 3, 6]]) {
    const e: Exercise = { level: 0, operation: '+', values: values as unknown as Exercise['values'], blank: 2 };
    expect(isValidFact(0, values, '+')).toBe(true);
    expect(checkAnswer(e, ` 00${values[2]} `)).toBe('correct');
    expect(checkAnswer(e, '99')).toBe('incorrect');
    expect(checkAnswer(e, '2.0')).toBe('invalid-input');
    for (const language of ['sk', 'en'] as const) for (const stage of [1, 2, 3]) expect(() => createHint(e, stage, language)).not.toThrow();
    for (const blank of [0, 1] as const) {
      const invalid = { ...e, blank };
      expect(() => solveBlank(invalid)).toThrow(RangeError);
      expect(() => checkAnswer(invalid, '0')).toThrow(RangeError);
      expect(() => createHint(invalid, 3, 'en')).toThrow(RangeError);
    }
  }
  for (const values of [[4, 3, 7], [-1, 1, 0], [0.5, 0.5, 1], [1, 1, 3]]) expect(isValidFact(0, values, '+')).toBe(false);
  expect(isValidFact(0, [6, 3, 3], '-')).toBe(false);
  for (const level of [-1, 8, 0.5, NaN]) expect(() => generateSession(level as 0, 5)).toThrow(RangeError);
  for (const size of [0, 4, 21, NaN]) expect(() => generateSession(0, size)).toThrow(RangeError);
  for (const value of [-1, 1, NaN, Infinity]) expect(() => generateSession(0, 5, () => value)).toThrow(RangeError);
});
