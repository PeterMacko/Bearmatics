import { afterEach, describe, expect, it } from 'vitest';
import {
  MULTIPLIER_ROWS,
  multipliedPoints,
  multiplierFor,
  type MultiplierRow,
} from './multipliers';
import {
  PLAYS_KEY,
  addPlay,
  dayShift,
  deviceSlovakDay,
  playDay,
  playsAccountKey,
  playsToday,
} from './playCounts';

describe('multiplier rows (SCRUM-202)', () => {
  const rows: MultiplierRow[] = [
    { course: 'math', levels: [2, 4], plays: [2, 3], multiplier: 0.5 },
    { course: 'math', levels: [2, 4], plays: [4, null], multiplier: 0.25 },
  ];
  it('matches from-to ranges with both ends included', () => {
    expect(multiplierFor('math', 2, 2, rows)).toBe(0.5);
    expect(multiplierFor('math', 4, 3, rows)).toBe(0.5);
    expect(multiplierFor('math', 3, 4, rows)).toBe(0.25);
  });
  it('null = no end', () => {
    expect(multiplierFor('math', 3, 99, rows)).toBe(0.25);
    expect(multiplierFor('math', 3, 10_000, rows)).toBe(0.25);
  });
  it('no matching row = x1 (other level, play, course)', () => {
    expect(multiplierFor('math', 3, 1, rows)).toBe(1);
    expect(multiplierFor('math', 1, 5, rows)).toBe(1);
    expect(multiplierFor('math', 5, 5, rows)).toBe(1);
    expect(multiplierFor('english', 3, 5, rows)).toBe(1);
    expect(multiplierFor('math', 3, 5, [])).toBe(1);
  });

  it('the initial table: easy levels 1, 1, 1/2, 1/2, then 1/4 for every later play', () => {
    const easy = [
      ['small', [1, 2]],
      ['math', [1, 2, 3, 4, 5, 6]],
      ['english', [1, 2]],
    ] as const;
    for (const [course, levels] of easy)
      for (const level of levels)
        expect(
          [1, 2, 3, 4, 5, 6, 20].map((play) => multiplierFor(course, level, play)),
          `${course} ${level}`,
        ).toEqual([1, 1, 0.5, 0.5, 0.25, 0.25, 0.25]);
  });
  it('the initial table: top levels x1.5 for the first play, then x1, never lower', () => {
    for (const [course, level] of [
      ['small', 3],
      ['math', 7],
      ['english', 3],
    ] as const)
      expect(
        [1, 2, 3, 4, 5, 6, 50].map((play) => multiplierFor(course, level, play)),
        `${course} ${level}`,
      ).toEqual([1.5, 1, 1, 1, 1, 1, 1]);
    expect(MULTIPLIER_ROWS).toHaveLength(9);
  });
  it('levels outside the table stay x1', () => {
    expect(multiplierFor('small', 4, 9)).toBe(1);
    expect(multiplierFor('math', 8, 1)).toBe(1);
    expect(multiplierFor('english', 4, 1)).toBe(1);
  });
});

describe('multiplied points', () => {
  it('9 first-try: 9 / 5 / 3 / 14 for x1 / x1/2 / x1/4 / x1.5', () => {
    expect(multipliedPoints(9, 1)).toBe(9);
    expect(multipliedPoints(9, 0.5)).toBe(5);
    expect(multipliedPoints(9, 0.25)).toBe(3);
    expect(multipliedPoints(9, 1.5)).toBe(14);
  });
  it('rounds up: 1 x 1/4 = 1; 0 stays 0; whole numbers stay exact up to 20 x 1.5', () => {
    expect(multipliedPoints(1, 0.25)).toBe(1);
    for (const m of [1, 0.5, 0.25, 1.5] as const) expect(multipliedPoints(0, m)).toBe(0);
    for (let n = 0; n <= 20; n++) {
      expect(multipliedPoints(n, 1.5)).toBe(Math.floor((n * 6 + 3) / 4));
      expect(multipliedPoints(n, 0.25)).toBe(Math.floor((n + 3) / 4));
    }
    expect(multipliedPoints(20, 1.5)).toBe(30);
  });
});

describe('play counts on the device', () => {
  afterEach(() => localStorage.clear());
  const day = '2026-11-20';
  it('counts per account, course, level and day', () => {
    addPlay('password:kid', day, 'math', 3);
    addPlay('password:kid', day, 'math', 3);
    addPlay('password:kid', day, 'small', 3);
    addPlay('google:Cub', day, 'math', 3);
    expect(playsToday('password:kid', day, 'math', 3)).toBe(2);
    expect(playsToday('password:kid', day, 'small', 3)).toBe(1);
    expect(playsToday('password:kid', day, 'math', 2)).toBe(0);
    expect(playsToday('google:Cub', day, 'math', 3)).toBe(1);
    expect(playsToday('password:other', day, 'math', 3)).toBe(0);
  });
  it('a new day starts at 0 and removes older days of every account', () => {
    addPlay('password:kid', day, 'math', 3);
    addPlay('google:Cub', day, 'math', 1);
    expect(playsToday('password:kid', '2026-11-21', 'math', 3)).toBe(0);
    addPlay('password:kid', '2026-11-21', 'math', 3);
    expect(playsToday('password:kid', '2026-11-21', 'math', 3)).toBe(1);
    expect(JSON.parse(localStorage.getItem(PLAYS_KEY)!)).toEqual({
      'password:kid': { day: '2026-11-21', counts: { 'math:3': 1 } },
    });
  });
  it('broken stored data counts as nothing', () => {
    localStorage.setItem(PLAYS_KEY, '{nope');
    expect(playsToday('password:kid', day, 'math', 3)).toBe(0);
    addPlay('password:kid', day, 'math', 3);
    expect(playsToday('password:kid', day, 'math', 3)).toBe(1);
  });
  it('account keys: username for password accounts, nickname for Google', () => {
    expect(playsAccountKey({ kind: 'password', username: 'kid', nickname: 'Cub' })).toBe(
      'password:kid',
    );
    expect(playsAccountKey({ kind: 'google', username: null, nickname: 'Cub' })).toBe('google:Cub');
  });
});

describe('the Slovak day', () => {
  it('changes at midnight in Bratislava (winter and summer time)', () => {
    expect(deviceSlovakDay(Date.parse('2026-11-20T22:59:59Z'))).toBe('2026-11-20');
    expect(deviceSlovakDay(Date.parse('2026-11-20T23:00:00Z'))).toBe('2026-11-21');
    expect(deviceSlovakDay(Date.parse('2026-06-15T21:59:59Z'))).toBe('2026-06-15');
    expect(deviceSlovakDay(Date.parse('2026-06-15T22:00:00Z'))).toBe('2026-06-16');
  });
  it("follows the server's day when the device clock is off, and still turns at midnight", () => {
    const now = Date.parse('2026-11-20T10:00:00Z');
    expect(playDay(now, 0)).toBe('2026-11-20');
    const shift = dayShift(now, '2026-11-21'); // device clock one day behind
    expect(shift).toBe(1);
    expect(playDay(now, shift)).toBe('2026-11-21');
    expect(playDay(Date.parse('2026-11-20T23:30:00Z'), shift)).toBe('2026-11-22');
    expect(dayShift(now, 'garbage')).toBe(0);
  });
});
