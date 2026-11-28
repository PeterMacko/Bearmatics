import { describe, expect, test, vi } from 'vitest';
import { ignoreRepeatClick, SCREEN_SETTLE_MS } from './ignoreRepeatClick';

// SCRUM-335 Wave 0 (review RF-05): the settle guard as the screens use it, as one table: click
// `detail` 0 (keyboard), 1 (a tap) and 2 (the repeat click of a double tap), before and after
// SCREEN_SETTLE_MS since the screen appeared, under both keyboard rules found in the app:
// 'pass' (keyboard activation is never too soon: Bear picks, course choice, Pexeso, hint) and
// 'guard' (the keyboard waits too: streak offer, profile grown-up window). A later shared
// tap-guard helper must keep every row.

type KeyboardRule = 'pass' | 'guard';

/** A screen's click handler: ignored while too soon after `shownAt` or a double tap's repeat. */
function guardedClick(detail: number, elapsed: number, keyboard: KeyboardRule) {
  const event = { detail, preventDefault: vi.fn() };
  const tooSoon = (keyboard === 'guard' || detail > 0) && elapsed < SCREEN_SETTLE_MS;
  return { ignored: ignoreRepeatClick(event, tooSoon), prevented: event.preventDefault.mock.calls };
}

// [detail, ms since the screen appeared, keyboard rule, ignored?]
const TABLE: [number, number, KeyboardRule, boolean][] = [
  [0, 0, 'pass', false],
  [0, 599, 'pass', false],
  [0, 600, 'pass', false],
  [0, 5000, 'pass', false],
  [1, 0, 'pass', true],
  [1, 599, 'pass', true],
  [1, 600, 'pass', false],
  [1, 5000, 'pass', false],
  [2, 0, 'pass', true],
  [2, 599, 'pass', true],
  [2, 600, 'pass', true],
  [2, 5000, 'pass', true],
  [0, 0, 'guard', true],
  [0, 599, 'guard', true],
  [0, 600, 'guard', false],
  [0, 5000, 'guard', false],
  [1, 0, 'guard', true],
  [1, 599, 'guard', true],
  [1, 600, 'guard', false],
  [1, 5000, 'guard', false],
  [2, 0, 'guard', true],
  [2, 599, 'guard', true],
  [2, 600, 'guard', true],
  [2, 5000, 'guard', true],
];

describe('ignoreRepeatClick with the screen settle time', () => {
  test('the settle time is 600 ms', () => {
    expect(SCREEN_SETTLE_MS).toBe(600);
  });

  test.each(TABLE)(
    'detail %i, %i ms after the screen appeared, keyboard %s: ignored %s',
    (detail, elapsed, keyboard, ignored) => {
      const result = guardedClick(detail, elapsed, keyboard);
      expect(result.ignored).toBe(ignored);
      // An ignored click is cancelled (no default action, e.g. no form submit); a passing one not.
      expect(result.prevented).toHaveLength(ignored ? 1 : 0);
    },
  );

  test('without a settle time only the repeat click of a double tap is ignored', () => {
    for (const [detail, ignored] of [
      [0, false],
      [1, false],
      [2, true],
      [3, true],
    ] as const) {
      const event = { detail, preventDefault: vi.fn() };
      expect(ignoreRepeatClick(event)).toBe(ignored);
      expect(event.preventDefault).toHaveBeenCalledTimes(ignored ? 1 : 0);
    }
  });
});
