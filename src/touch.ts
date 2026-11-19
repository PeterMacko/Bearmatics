/** Any coarse pointer (finger), whether or not it is the primary or most recent one. */
export const ANY_COARSE_POINTER = '(any-pointer: coarse)';

/** Touch capability, independent of the viewport and of the pointer used last. */
export function hasTouch(): boolean {
  return (
    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0) ||
    (typeof matchMedia === 'function' && matchMedia(ANY_COARSE_POINTER).matches)
  );
}
