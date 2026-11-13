import { describe, expect, test } from 'vitest';
import type { Exercise } from './math/engine';
import {
  advance,
  bearMood,
  clearFeedback,
  createSession,
  currentExercise,
  hasProgress,
  nextAction,
  nextHintStage,
  openHintStage,
  progressValue,
  submitAnswer,
  type Session,
} from './session';

const ex = (a: number, b: number): Exercise => ({
  level: 1,
  operation: '+',
  values: [a, b, a + b],
  blank: 2,
});
const A = ex(1, 1);
const B = ex(2, 1);
const C = ex(3, 1);
const fresh = () => createSession([A, B, C]);
const solveWith = (s: Session, wrongFirst = 0) => {
  let next = s;
  for (let i = 0; i < wrongFirst; i++) next = submitAnswer(next, '99');
  const target = currentExercise(next)!;
  return submitAnswer(next, String(target.values[2]));
};

describe('session steps', () => {
  test('createSession starts at the first original with nothing scored', () => {
    const s = fresh();
    expect(s).toMatchObject({ index: 0, firstTry: 0, attempts: 0, hintStage: 0, done: false });
    expect(s.reviewing).toBe(false);
    expect(s.reviewQueue).toEqual([]);
    expect(currentExercise(s)).toBe(A);
  });

  test('invalid input only sets feedback and does not count as an attempt', () => {
    const s = submitAnswer(fresh(), 'x');
    expect(s).toMatchObject({ feedback: 'invalid', attempts: 0, solved: false });
  });

  test('a wrong answer counts an attempt; a later correct answer earns no first-try point', () => {
    const wrong = submitAnswer(fresh(), '5');
    expect(wrong).toMatchObject({ feedback: 'incorrect', attempts: 1, solved: false });
    const right = submitAnswer(wrong, '2');
    expect(right).toMatchObject({ feedback: 'correct', attempts: 2, solved: true, firstTry: 0 });
  });

  test('first-try point needs first attempt and no hint', () => {
    expect(solveWith(fresh()).firstTry).toBe(1);
    expect(solveWith(openHintStage(fresh())).firstTry).toBe(0);
  });

  test('submitting again after solving changes nothing', () => {
    const solved = solveWith(fresh());
    expect(submitAnswer(solved, '7')).toBe(solved);
  });

  test('clearFeedback resets feedback before solving only', () => {
    expect(clearFeedback(submitAnswer(fresh(), '5')).feedback).toBe('ready');
    const solved = solveWith(fresh());
    expect(clearFeedback(solved)).toBe(solved);
  });

  test('advance does nothing until solved, then resets per-exercise state', () => {
    const s = fresh();
    expect(advance(s)).toBe(s);
    const moved = advance(solveWith(openHintStage(s)));
    expect(moved).toMatchObject({ index: 1, attempts: 0, hintStage: 0, solved: false });
    expect(moved.feedback).toBe('ready');
  });

  test('originals needing more than one attempt join the review round', () => {
    let s = advance(solveWith(fresh(), 1)); // A needed two attempts
    expect(s.reviewQueue).toEqual([A]);
    s = advance(solveWith(s)); // B
    expect(nextAction(solveWith(s))).toBe('reviewStart');
    s = advance(solveWith(s)); // C, last original
    expect(s).toMatchObject({ reviewing: true, done: false });
    expect(currentExercise(s)).toBe(A);
    expect(progressValue(s)).toBe(3);
  });

  test('a review item leaves the queue only when solved first time without hints', () => {
    let s: Session = { ...fresh(), reviewing: true, reviewQueue: [A, B] };
    s = advance(solveWith(s, 1)); // A missed again -> back of queue
    expect(s.reviewQueue).toEqual([B, A]);
    expect(nextAction(solveWith(s, 1))).toBe('next'); // B missed with 2 left: not finish
    s = advance(solveWith(openHintStage(s))); // B with hint -> back of queue
    expect(s.reviewQueue).toEqual([A, B]);
    s = advance(solveWith(s));
    expect(s.reviewQueue).toEqual([B]);
    expect(nextAction(solveWith(s))).toBe('finish');
    s = advance(solveWith(s));
    expect(s).toMatchObject({ done: true, reviewQueue: [] });
  });

  test('review solves never add first-try points', () => {
    const s: Session = { ...fresh(), reviewing: true, reviewQueue: [A] };
    expect(solveWith(s).firstTry).toBe(0);
  });

  test('a clean last original finishes the session', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) {
      s = solveWith(s);
      expect(nextAction(s)).toBe(i < 2 ? 'next' : 'finish');
      s = advance(s);
    }
    expect(s).toMatchObject({ done: true, reviewing: false, firstTry: 3 });
    expect(advance(s)).toBe(s);
  });

  test('hint stages open at 1 and stop at 3; not after solving', () => {
    let s = openHintStage(fresh());
    expect(s.hintStage).toBe(1);
    expect(openHintStage(s)).toBe(s);
    s = nextHintStage(nextHintStage(nextHintStage(s)));
    expect(s.hintStage).toBe(3);
    const solved = solveWith(fresh());
    expect(openHintStage(solved)).toBe(solved);
    expect(nextHintStage(solved)).toBe(solved);
  });

  test('hasProgress detects any progress or a typed answer', () => {
    expect(hasProgress(fresh(), '')).toBe(false);
    expect(hasProgress(fresh(), '  ')).toBe(false);
    expect(hasProgress(fresh(), '4')).toBe(true);
    expect(hasProgress(submitAnswer(fresh(), '9'), '')).toBe(true);
    expect(hasProgress(openHintStage(fresh()), '')).toBe(true);
    expect(hasProgress(advance(solveWith(fresh())), '')).toBe(true);
  });

  test('progress counts the solved current exercise', () => {
    expect(progressValue(fresh())).toBe(0);
    expect(progressValue(solveWith(fresh()))).toBe(1);
  });

  test('bear mood follows feedback and completion', () => {
    expect(bearMood(null)).toBe('neutral');
    expect(bearMood(fresh())).toBe('neutral');
    expect(bearMood(submitAnswer(fresh(), '9'))).toBe('sad');
    expect(bearMood(solveWith(fresh()))).toBe('happy');
    expect(bearMood({ ...fresh(), done: true })).toBe('happy');
  });
});
