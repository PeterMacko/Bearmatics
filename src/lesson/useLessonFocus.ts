import { useEffect, type RefObject } from 'react';

/**
 * A new exercise (mount) and the end of the demo put focus on the exercise (`targetRef`); a
 * solved one focuses Next. Never scrolls.
 */
export function useLessonFocus(
  solved: boolean,
  demo: boolean,
  nextRef: RefObject<HTMLButtonElement | null>,
  targetRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (solved) nextRef.current?.focus({ preventScroll: true });
    else if (!demo) targetRef.current?.focus({ preventScroll: true });
    // Both refs are stable objects: only `solved` and `demo` move the focus.
  }, [solved, demo, nextRef, targetRef]);
}
