/**
 * The app ignores presses for 600 ms after a screen, window or board appears and after a tap
 * that starts something (QA287-01, QA321-01, QA321-04): a deliberate tap waits 600 ms + 50 ms.
 */
export const SETTLE_WAIT_MS = 650;

/** Pexeso accepts a card turn 300 ms after the previous one: a deliberate next turn waits +20 ms. */
export const TURN_WAIT_MS = 320;
