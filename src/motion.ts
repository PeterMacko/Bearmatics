/** The media query for the player's reduced-motion wish (CSS uses the same). */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The player asked for reduced motion (false outside a browser). */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_MOTION_QUERY).matches;
