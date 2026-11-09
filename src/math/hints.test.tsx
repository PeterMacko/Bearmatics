import { expect, test } from 'vitest';
import * as hints from './hints';
import { generateSession, type Exercise, type Fact, type Level, type Operation } from './engine';

test('provides three localized stages for every operator and blank without revealing early answers', () => {
  const create = (hints as Record<string, unknown>).createHint as (e: Exercise, stage: number, language: string) => { title: string; body: string; model?: { values: (number | null)[] }; formula?: { left: number; operation: Operation; right: number; result: number }; completed?: Fact };
  expect(create).toBeTypeOf('function');
  const facts: [Level, Operation, Fact][] = [[1, '+', [0, 10, 10]], [2, '-', [0, 0, 0]], [3, '+', [8, 12, 20]], [4, '-', [100, 47, 53]], [5, '*', [5, 4, 20]], [6, '/', [72, 8, 9]]];
  for (const [level, operation, values] of facts) for (const blank of [0, 1, 2] as const) {
    const exercise = { level, operation, values, blank };
    for (const language of ['en', 'sk']) {
      const first = create(exercise, 1, language);
      const second = create(exercise, 2, language);
      const third = create(exercise, 3, language);
      expect(first.title.length).toBeGreaterThan(0); expect(first.body.length).toBeGreaterThan(0);
      expect(second.title.length).toBeGreaterThan(0); expect(second.body.length).toBeGreaterThan(0);
      expect(first.formula).toBeUndefined(); expect(second.formula).toBeUndefined();
      expect(first.completed).toBeUndefined(); expect(second.completed).toBeUndefined();
      expect(first.model).toBeUndefined();
      expect(second.model!.values.filter(v => v === null)).toHaveLength(1);
      expect(second.model!.values.filter(v => v !== null).sort((a, b) => a! - b!)).toEqual(values.filter((_, i) => i !== blank).sort((a, b) => a - b));
      const f = third.formula!;
      const result = f.operation === '+' ? f.left + f.right : f.operation === '-' ? f.left - f.right : f.operation === '*' ? f.left * f.right : f.left / f.right;
      expect(result).toBe(values[blank]); expect(f.result).toBe(result);
      expect(third.completed).toEqual(values);
    }
    expect(create(exercise, 1, 'en').body).not.toBe(create(exercise, 1, 'sk').body);
  }
});

test.each([1, 2, 3, 4, 5, 6] as const)('validates sampled hint formulas and decomposition on level %i', level => {
  for (const exercise of generateSession(level, 20, () => 0.31415)) for (const language of ['en', 'sk'] as const) {
    const result = hints.createHint(exercise, 3, language);
    const f = result.formula!;
    const evaluate = (f: hints.CountingStep) => f.operation === '+' ? f.left + f.right : f.operation === '-' ? f.left - f.right : f.operation === '*' ? f.left * f.right : f.left / f.right;
    expect(evaluate(f)).toBe(exercise.values[exercise.blank]);
    const known = exercise.values.filter((_, i) => i !== exercise.blank);
    expect(known).toContain(f.left); expect(known).toContain(f.right);
    if (result.steps) {
      let running = f.left;
      for (const step of result.steps) {
        expect(step.left).toBe(running); expect(evaluate(step)).toBe(step.result);
        expect(step.result).toBeGreaterThanOrEqual(0); running = step.result;
      }
      expect(running).toBe(f.result);
    }
    for (const stage of [1, 2]) {
      const early = hints.createHint(exercise, stage, language);
      expect(early.formula).toBeUndefined(); expect(early.steps).toBeUndefined(); expect(early.completed).toBeUndefined();
    }
  }
});

test('worked solutions teach bridging tens and splitting larger numbers', () => {
  const create = (hints as Record<string, unknown>).createHint as (e: Exercise, stage: number, language: string) => { steps?: { left: number; operation: Operation; right: number; result: number }[] };
  const addition: Exercise = { level: 3, operation: '+', values: [8, 5, 13], blank: 2 };
  expect(create(addition, 1, 'en').steps).toBeUndefined();
  expect(create(addition, 2, 'en').steps).toBeUndefined();
  expect(create(addition, 3, 'en').steps).toEqual([{ left: 8, operation: '+', right: 2, result: 10 }, { left: 10, operation: '+', right: 3, result: 13 }]);
  expect(create({ level: 3, operation: '-', values: [13, 7, 6], blank: 2 }, 3, 'sk').steps).toEqual([{ left: 13, operation: '-', right: 3, result: 10 }, { left: 10, operation: '-', right: 4, result: 6 }]);
  expect(create({ level: 4, operation: '+', values: [45, 37, 82], blank: 2 }, 3, 'en').steps).toEqual([{ left: 45, operation: '+', right: 30, result: 75 }, { left: 75, operation: '+', right: 7, result: 82 }]);
  expect(create({ level: 4, operation: '+', values: [47, 53, 100], blank: 1 }, 3, 'en').steps).toEqual([{ left: 100, operation: '-', right: 40, result: 60 }, { left: 60, operation: '-', right: 7, result: 53 }]);
});

test('rejects malformed facts and unsupported hint stages', () => {
  const create = (hints as Record<string, unknown>).createHint as (e: Exercise, stage: number, language: string) => unknown;
  expect(create).toBeTypeOf('function');
  const exercise: Exercise = { level: 1, operation: '+', values: [1, 2, 3], blank: 2 };
  for (const stage of [0, 4, -1, 1.5, NaN]) expect(() => create(exercise, stage, 'en')).toThrow();
  expect(() => create({ ...exercise, values: [1, 2, 9] }, 1, 'en')).toThrow();
  expect(() => create(exercise, 1, 'xx')).toThrow();
});
