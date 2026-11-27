import { describe, expect, it } from 'vitest';
import {
  bearPicksPoints,
  lessonPoints,
  multipliedPoints,
  type Multiplier,
} from '../progress/multipliers';

// SCRUM-309 worked examples, all answers first try: ceil(firstTry x q x 3 / 8), q in quarters.
const WORKED: [size: number, multiplier: Multiplier, points: number][] = [
  [5, 1, 8],
  [5, 1.5, 12],
  [5, 0.5, 4],
  [5, 0.25, 2],
  [10, 1, 15],
  [10, 1.5, 23],
  [10, 0.5, 8],
  [10, 0.25, 4],
  [20, 1, 30],
  [20, 1.5, 45],
  [20, 0.5, 15],
  [20, 0.25, 8],
];

describe('Bear picks a game: x1.5 points (SCRUM-309)', () => {
  for (const [size, multiplier, points] of WORKED)
    it(`size ${size}, table x${multiplier}: ${points} points`, () => {
      expect(bearPicksPoints(size, multiplier)).toBe(points);
      expect(lessonPoints(size, multiplier, true)).toBe(points);
    });
  it('0 first-try answers give 0 at every multiplier', () => {
    for (const m of [1, 1.5, 0.5, 0.25] as const) expect(bearPicksPoints(0, m)).toBe(0);
  });
  it('fewer first-try answers than the size: exact integer rounding up', () => {
    expect(bearPicksPoints(1, 0.25)).toBe(1); // 3/8 -> 1
    expect(bearPicksPoints(3, 1)).toBe(5); // 36/8 = 4.5 -> 5
    expect(bearPicksPoints(7, 1.5)).toBe(16); // 126/8 = 15.75 -> 16
    expect(bearPicksPoints(9, 0.5)).toBe(7); // 54/8 = 6.75 -> 7
    expect(bearPicksPoints(4, 1)).toBe(6); // 48/8 = 6 exactly
    for (const [m, q] of [
      [1, 4],
      [1.5, 6],
      [0.5, 2],
      [0.25, 1],
    ] as const)
      for (let n = 0; n <= 20; n++)
        expect(bearPicksPoints(n, m), `${n} x ${m}`).toBe(Math.floor((n * q * 3 + 7) / 8));
  });
  it('the most a lesson can give is ceil(9/4 x size) = 12 / 23 / 45', () => {
    for (const [size, most] of [
      [5, 12],
      [10, 23],
      [20, 45],
    ] as const) {
      const all = ([1, 1.5, 0.5, 0.25] as const).map((m) => bearPicksPoints(size, m));
      expect(Math.max(...all)).toBe(most);
    }
  });
  it('normal lessons keep the table points unchanged', () => {
    for (const m of [1, 1.5, 0.5, 0.25] as const)
      for (let n = 0; n <= 20; n++) expect(lessonPoints(n, m, false)).toBe(multipliedPoints(n, m));
  });
});
