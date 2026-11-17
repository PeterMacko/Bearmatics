// Media queries used from JavaScript (matchMedia). The CSS spells the same breakpoints
// itself; the table at the top of src/styles.css names every one of them.

/** Phone width: the menus' bear sits beside the heading (styles.css `phone`). */
export const PHONE_QUERY = '(max-width: 620px)';

/**
 * Compact practice layout: phones plus short landscape-ish windows. Not the same as either
 * CSS short-landscape spelling: it has no 480px minimum width and no orientation test.
 */
export const COMPACT_PRACTICE_QUERY =
  '(max-width: 620px), (max-height: 500px) and (max-width: 950px)';
