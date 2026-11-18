/** The click event fields the guard reads (React and DOM mouse events both have them). */
type Click = { detail: number; preventDefault: () => void };

/**
 * Double-tap guard for buttons that appear under the finger (a screen or dialog step changes):
 * cancels the click and returns true when it is the repeat click of a double tap
 * (`detail > 1`) or when `tooSoon` (e.g. a fresh tap right after a step change). Keyboard
 * activation (detail 0) and a deliberate single click pass.
 */
export function ignoreRepeatClick(event: Click, tooSoon = false): boolean {
  if (event.detail > 1 || tooSoon) {
    event.preventDefault();
    return true;
  }
  return false;
}
