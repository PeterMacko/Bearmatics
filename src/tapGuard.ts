import { ignoreRepeatClick, SCREEN_SETTLE_MS } from './ignoreRepeatClick';

// SCRUM-335 (review RF-05): one home for the tap guards. Each screen keeps its own rule: the
// settle time after a screen change (SCREEN_SETTLE_MS), its own gap between lesson taps, and
// whether keyboard activation (click detail 0) passes or waits like a pointer tap. Making the
// rules the same is a product decision, not part of this refactor.
export { ignoreRepeatClick, SCREEN_SETTLE_MS };

/** Gaps between accepted taps inside a lesson: take-away basket, Pexeso card, Word search letter. */
export const TAP_GAP_MS = { basket: 350, card: 300, letter: 500 } as const;

/**
 * True while less than `ms` (default SCREEN_SETTLE_MS) has passed since `since`, a
 * `performance.now()` time (`now` if the caller has read the clock already). `since` null = not
 * known yet: `unknown` decides (default: too soon).
 */
export function tooSoonAfter(
  since: number | null,
  {
    ms = SCREEN_SETTLE_MS,
    now,
    unknown = true,
  }: { ms?: number; now?: number; unknown?: boolean } = {},
): boolean {
  if (since === null) return unknown;
  return (now ?? performance.now()) - since < ms;
}

/**
 * Guard for a button that appeared under the finger at `since`: cancels the click and returns
 * true for the repeat click of a double tap (detail > 1) and for a tap in the settle time.
 * `keyboard`: 'pass' = keyboard activation (detail 0) is never too soon; 'wait' = it waits too.
 */
export function ignoreSettlingTap(
  event: { detail: number; preventDefault: () => void },
  since: number | null,
  keyboard: 'pass' | 'wait',
): boolean {
  return ignoreRepeatClick(event, (keyboard === 'wait' || event.detail > 0) && tooSoonAfter(since));
}
