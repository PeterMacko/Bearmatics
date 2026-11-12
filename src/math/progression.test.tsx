import { expect, test } from 'vitest';
import { generateSession, solveBlank, checkAnswer, isValidFact, type Exercise, type Level } from './engine';
import { createHint } from './hints';

test('later levels retain their former arithmetic domains under IDs 5 6 7', () => {
  const oracle = (old: number, a: number, b: number, c: number, op: string) => old === 4
    ? a <= 100 && b <= 100 && c <= 100 && (op === '+' ? a + b === c : op === '-' && a - b === c)
    : op === '*' ? a >= 1 && a <= (old === 5 ? 5 : 10) && b >= 1 && b <= (old === 5 ? 5 : 10) && a * b === c
    : old === 6 && op === '/' && b >= 1 && b <= 10 && c >= 1 && c <= 10 && a === b * c;
  for (const [old, level] of [[4, 5], [5, 6], [6, 7]] as const) {
    for (const op of ['+', '-', '*', '/']) for (let a = 0; a <= 101; a++) for (let b = 0; b <= 101; b++) {
      const c = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : b ? a / b : NaN;
      expect(isValidFact(level, [a, b, c], op)).toBe(Number.isSafeInteger(c) && c >= 0 && oracle(old, a, b, c, op));
    }
    for (const size of [5, 10, 20]) expect(generateSession(level as Level, size, () => 0)).toHaveLength(size);
  }
});

test('level 3 rejects operand blanks throughout solver checker and hints', () => {
  for (const blank of [0, 1] as const) {
    const e: Exercise = { level: 3, operation: '-', values: [20, 7, 13], blank };
    expect(() => solveBlank(e)).toThrow(RangeError);
    expect(() => checkAnswer(e, String(e.values[blank]))).toThrow(RangeError);
    for (const language of ['en', 'sk'] as const) for (const stage of [1, 2, 3]) expect(() => createHint(e, stage, language)).toThrow(RangeError);
  }
});

test('level 4 rejects result blanks throughout solver checker and hints', () => {
  const e: Exercise = { level: 4, operation: '-', values: [20, 7, 13], blank: 2 };
  expect(() => solveBlank(e)).toThrow(RangeError);
  expect(() => checkAnswer(e, '13')).toThrow(RangeError);
  for (const language of ['en', 'sk'] as const) for (const stage of [1, 2, 3]) expect(() => createHint(e, stage, language)).toThrow(RangeError);
});

test('level 4 sessions cover both operand positions and both operations within 20', () => {
  for (const size of [5, 10, 20]) {
    const session = generateSession(4, size, () => 0);
    expect(session).toHaveLength(size);
    expect(new Set(session.map(e => e.blank))).toEqual(new Set([0, 1]));
    expect(new Set(session.map(e => e.operation))).toEqual(new Set(['+', '-']));
    expect(session.every(e => e.values.every(n => n <= 20))).toBe(true);
  }
});

test('level 3 sessions ask only for results with both operations', () => {
  for (const size of [5, 10, 20]) {
    const session = generateSession(3, size, () => 0);
    expect(session).toHaveLength(size);
    expect(session.every(e => e.blank === 2)).toBe(true);
    expect(new Set(session.map(e => e.operation))).toEqual(new Set(['+', '-']));
  }
});
