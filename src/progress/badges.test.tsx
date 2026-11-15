import { expect, test } from 'vitest';
import { badgeFor, badgeLook, badgeThreshold } from './badges';

test('badge thresholds 1-20 match the approved table exactly', () => {
  expect(Array.from({ length: 20 }, (_, i) => badgeThreshold(i + 1))).toEqual([
    30, 62, 95, 130, 166, 205, 245, 287, 331, 378, 427, 478, 532, 588, 648, 710, 776, 844, 917, 992,
  ]);
});

test('boundaries: 29/30 and 61/62; the badge goes down with the points', () => {
  expect(badgeFor(0)).toEqual({ points: 0, badge: 0, nextAt: 30, toNext: 30 });
  expect(badgeFor(29).badge).toBe(0);
  expect(badgeFor(30)).toEqual({ points: 30, badge: 1, nextAt: 62, toNext: 32 });
  expect(badgeFor(61).badge).toBe(1);
  expect(badgeFor(62).badge).toBe(2);
  expect(badgeFor(112)).toMatchObject({ badge: 3, toNext: 18 });
  expect(badgeFor(992).badge).toBe(20);
  // Points can go down (SCRUM-118); the badge is always computed, never stored.
  expect(badgeFor(61).badge).toBeLessThan(badgeFor(62).badge);
});

test('no maximum badge', () => {
  expect(badgeFor(1_000_000).badge).toBeGreaterThan(70);
});

test('look changes every 5 badges: bronze, silver, gold, then with stars', () => {
  expect([0, 1, 5, 6, 10, 11, 15, 16, 31].map(badgeLook)).toEqual([
    { metal: 'none', stars: 0 },
    { metal: 'bronze', stars: 0 },
    { metal: 'bronze', stars: 0 },
    { metal: 'silver', stars: 0 },
    { metal: 'silver', stars: 0 },
    { metal: 'gold', stars: 0 },
    { metal: 'gold', stars: 0 },
    { metal: 'bronze', stars: 1 },
    { metal: 'bronze', stars: 2 },
  ]);
});
