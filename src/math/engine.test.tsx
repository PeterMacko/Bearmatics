import { describe, expect, test } from 'vitest';
import * as engine from './engine';

const valid = engine.isValidFact;

describe('level arithmetic rules', () => {
  test('recognizes bounded facts and rejects invalid arithmetic', () => {
    expect(valid, 'math validator must exist').toBeTypeOf('function');
    expect(valid(1, [1, 2, 3], '+')).toBe(true);
    expect(valid(1, [10, 0, 10], '+')).toBe(true);
    expect(valid(1, [10, 1, 11], '+')).toBe(false);
    expect(valid(1, [5, 2, 3], '-')).toBe(false);
    for (const [level, max] of [[2, 10], [3, 20], [4, 100]]) {
      expect(valid!(level!, [0, max!, max!], '+')).toBe(true);
      expect(valid!(level!, [max!, max!, 0], '-')).toBe(true);
      expect(valid!(level!, [max!, 1, max! + 1], '+')).toBe(false);
      expect(valid!(level!, [0, 1, -1], '-')).toBe(false);
      expect(valid!(level!, [1, 2, 4], '+')).toBe(false);
      expect(valid!(level!, [1, 1, 1], '*')).toBe(false);
    }
    expect(valid!(5, [5, 5, 25], '*')).toBe(true);
    expect(valid!(5, [6, 1, 6], '*')).toBe(false);
    expect(valid!(5, [0, 5, 0], '*')).toBe(false);
    expect(valid!(6, [10, 10, 100], '*')).toBe(true);
    expect(valid!(6, [100, 10, 10], '/')).toBe(true);
    expect(valid!(6, [5, 2, 2.5], '/')).toBe(false);
    expect(valid!(6, [1, 0, 1], '/')).toBe(false);
    expect(valid!(6, [11, 1, 11], '/')).toBe(false);
    expect(valid!(0, [1, 1, 2], '+')).toBe(false);
    expect(valid!(1, [NaN, 1, 2], '+')).toBe(false);
  });
});

describe('answer validation', () => {
  const check = engine.checkAnswer;
  const exercise: engine.Exercise = { level: 1, operation: '+', values: [1, 2, 3], blank: 1 };
  test.each(['2', ' 2 ', '002'])('accepts digit-only correct input %j', input => {
    expect(check).toBeTypeOf('function');
    expect(check(exercise, input)).toBe('correct');
  });
  test.each(['', ' ', '-2', '+2', '2.0', '2e0', '2x', 'Infinity', 'NaN', '0x2', '٢', '9007199254740992'])('rejects invalid input %j without scoring it as wrong', input => {
    expect(check).toBeTypeOf('function');
    expect(check(exercise, input)).toBe('invalid-input');
  });
  test('distinguishes valid wrong answers and does not mutate exercises', () => {
    expect(check).toBeTypeOf('function');
    expect(check(exercise, '3')).toBe('incorrect');
    expect(check(exercise, '100')).toBe('incorrect');
    expect(check(exercise, '2')).toBe('correct');
    expect(exercise.values).toEqual([1, 2, 3]);
    expect(check({ level: 2, operation: '-', values: [10, 10, 0], blank: 2 }, '0')).toBe('correct');
    expect(() => check({ ...exercise, values: [1, 2, 8] }, '8')).toThrow();
  });
});

describe('session generation', () => {
  const generate = engine.generateSession;
  function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
  test.each([1, 2, 3, 4, 5, 6] as const)('generates unique valid mixed sessions for level %i', level => {
    expect(generate).toBeTypeOf('function');
    for (const size of [5, 10, 20]) for (const seed of [0, 1, 42, 999]) {
      const exercises = generate(level, size, seeded(seed));
      expect(exercises).toHaveLength(size);
      const displayed = exercises.map(e => `${e.values.map((v, i) => i === e.blank ? '?' : v).join(',')}:${e.operation}`);
      expect(new Set(displayed).size).toBe(size);
      const operations = new Set(exercises.map(e => e.operation));
      expect(operations.size).toBe(level === 1 || level === 5 ? 1 : 2);
      if (level === 1) expect([...operations]).toEqual(['+']);
      expect(exercises.some(e => e.blank === 2)).toBe(true);
      expect(exercises.some(e => e.blank !== 2)).toBe(true);
      for (const e of exercises) {
        expect(e.level).toBe(level);
        expect(engine.isValidFact(level, e.values, e.operation)).toBe(true);
        // Independent arithmetic evaluation over the whole allowed domain.
        const answers = Array.from({ length: 101 }, (_, n) => n).filter(n => {
          const v = [...e.values]; v[e.blank] = n; const [a, b, c] = v;
          const domain = level <= 4 ? v.every(x => x <= [10, 10, 20, 100][level - 1]) : e.operation === '*' ? a >= 1 && a <= (level === 5 ? 5 : 10) && b >= 1 && b <= (level === 5 ? 5 : 10) : b >= 1 && b <= 10 && c >= 1 && c <= 10;
          return domain && (e.operation === '+' ? a + b === c : e.operation === '-' ? a - b === c : e.operation === '*' ? a * b === c : b !== 0 && a === b * c);
        });
        expect(answers).toEqual([e.values[e.blank]]);
      }
      expect(exercises).toEqual(generate(level, size, seeded(seed)));
    }
  });
  test('rejects unsupported settings and broken random sources without hanging', () => {
    expect(generate).toBeTypeOf('function');
    for (const size of [0, 1, 6, 21, NaN]) expect(() => generate(1, size)).toThrow();
    expect(() => generate(7 as engine.Level, 10)).toThrow();
    for (const rng of [() => -1, () => 1, () => NaN]) expect(() => generate(1, 5, rng)).toThrow();
    expect(generate(1, 20, () => 0)).toHaveLength(20);
  });
});

test('finds the unique missing value in every position and rejects invalid facts', () => {
  const solve = engine.solveBlank;
  expect(solve).toBeTypeOf('function');
  const facts: [engine.Level, engine.Operation, engine.Fact][] = [[1, '+', [1, 2, 3]], [3, '-', [20, 7, 13]], [4, '+', [45, 55, 100]], [5, '*', [5, 4, 20]], [6, '/', [72, 8, 9]]];
  for (const [level, operation, values] of facts) {
    for (const blank of [0, 1, 2] as const) expect(solve({ level, operation, values, blank })).toBe(values[blank]);
  }
  expect(() => solve({ level: 5, operation: '*', values: [0, 3, 0], blank: 1 })).toThrow();
  expect(() => solve({ level: 6, operation: '/', values: [0, 2, 0], blank: 1 })).toThrow();
  expect(() => solve({ level: 1, operation: '+', values: [1, 2, 9], blank: 2 })).toThrow();
});
