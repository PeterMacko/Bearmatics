import { afterEach, expect, test, vi } from 'vitest';
import { ignoreSettlingTap, SCREEN_SETTLE_MS, TAP_GAP_MS, tooSoonAfter } from './tapGuard';

// SCRUM-335 W2a (review RF-05): the shared tap guard, every keyboard rule as each screen has it.

afterEach(() => vi.restoreAllMocks());
const at = (now: number) => vi.spyOn(performance, 'now').mockReturnValue(now);
const click = (detail: number) => ({ detail, preventDefault: vi.fn() });

test('the named times', () => {
  expect(SCREEN_SETTLE_MS).toBe(600);
  expect(TAP_GAP_MS).toEqual({ basket: 350, card: 300, letter: 500 });
});

test('tooSoonAfter: before and after the time, the caller clock and an unknown start', () => {
  at(1599);
  expect(tooSoonAfter(1000)).toBe(true);
  at(1600);
  expect(tooSoonAfter(1000)).toBe(false);
  expect(tooSoonAfter(1000, { ms: 601 })).toBe(true);
  expect(tooSoonAfter(1000, { now: 1100, ms: 300 })).toBe(true);
  expect(tooSoonAfter(1000, { now: 1300, ms: 300 })).toBe(false);
  expect(tooSoonAfter(null)).toBe(true);
  expect(tooSoonAfter(null, { unknown: false })).toBe(false);
});

test.each([
  // [keyboard rule, detail, ms since shown, ignored]
  ['pass', 0, 100, false],
  ['pass', 1, 100, true],
  ['pass', 2, 100, true],
  ['pass', 0, 700, false],
  ['pass', 1, 700, false],
  ['pass', 2, 700, true],
  ['wait', 0, 100, true],
  ['wait', 1, 100, true],
  ['wait', 2, 100, true],
  ['wait', 0, 700, false],
  ['wait', 1, 700, false],
  ['wait', 2, 700, true],
] as const)('keyboard %s, detail %s, %s ms after: ignored %s', (rule, detail, after, ignored) => {
  at(1000 + after);
  const event = click(detail);
  expect(ignoreSettlingTap(event, 1000, rule)).toBe(ignored);
  expect(event.preventDefault).toHaveBeenCalledTimes(ignored ? 1 : 0);
});

test('an unknown start counts as too soon for a pointer tap; keyboard passes or waits', () => {
  at(5000);
  expect(ignoreSettlingTap(click(1), null, 'pass')).toBe(true);
  expect(ignoreSettlingTap(click(0), null, 'pass')).toBe(false);
  expect(ignoreSettlingTap(click(0), null, 'wait')).toBe(true);
});
