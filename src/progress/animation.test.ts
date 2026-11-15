import { expect, test } from 'vitest';
import { pointsFrames, staticFrame } from './animation';

const view = (before: number, after: number) =>
  pointsFrames(before, after).map((f) => [
    f.points,
    f.badge,
    Number(f.share.toFixed(3)),
    !!f.levelUp,
  ]);

test('fills point by point inside one badge', () => {
  expect(view(10, 13)).toEqual([
    [10, 0, 0.333, false],
    [11, 0, 0.367, false],
    [12, 0, 0.4, false],
    [13, 0, 0.433, false],
  ]);
});

test('crossing a badge: full bar first, then the level change at 0, then the rest from zero', () => {
  // Badge 1 at 30, badge 2 at 62 (32 points apart).
  expect(view(28, 32)).toEqual([
    [28, 0, 0.933, false],
    [29, 0, 0.967, false],
    [30, 0, 1, false],
    [30, 1, 0, true],
    [31, 1, 0.031, false],
    [32, 1, 0.063, false],
  ]);
  const change = pointsFrames(28, 32)[3];
  expect(change).toMatchObject({ levelUp: 1, jump: true });
  expect(change.hold).toBeGreaterThanOrEqual(1000);
});

test('ending exactly on a badge ends on its empty bar after the change', () => {
  expect(view(26, 30).slice(-2)).toEqual([
    [30, 0, 1, false],
    [30, 1, 0, true],
  ]);
});

test('two badges in one lesson show two level changes', () => {
  const frames = pointsFrames(25, 70);
  expect(frames.filter((f) => f.levelUp).map((f) => f.levelUp)).toEqual([1, 2]);
  expect(frames.at(-1)).toMatchObject({ points: 70, badge: 2, hold: 0 });
});

test('no points: the static state; whole run stays about 1.5 s plus level pauses', () => {
  expect(pointsFrames(12, 12)).toEqual([{ ...staticFrame(12), hold: 0 }]);
  const total = pointsFrames(0, 20).reduce((sum, f) => sum + f.hold, 0);
  expect(total).toBeLessThanOrEqual(1700);
});
