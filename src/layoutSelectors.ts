/**
 * Class selectors the layout hooks (AppBar, useMenuLayout, useWordGrid) look up in the DOM.
 * A class renamed in the markup must be renamed here too: layoutSelectors.test.tsx renders the
 * screens and checks that every selector still finds its element.
 */
export const LAYOUT = {
  /** AppBar: the warm-up text of a frozen streak in the bar. */
  streakWarmUp: '.streak-warm-up',
  /** AppBar: the menu eyebrow and heading the bar must not cover. */
  menuEyebrow: '.menu-shell .eyebrow',
  menuHeading: '.menu-shell .menu-heading',
  /** useMenuLayout, inside the menu: heading, level list, level cards, controls and bear. */
  heading: '.menu-heading',
  levelList: '.level-options',
  levelCard: '.level-option',
  controls: '.menu-controls',
  bear: '.companion',
  /** useWordGrid: the compact (phone) lesson layout and the word buttons. */
  compactPractice: '.compact-practice',
  wordButton: '.word-option',
} as const;
