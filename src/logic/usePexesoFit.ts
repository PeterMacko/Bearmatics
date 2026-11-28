import { useLayoutEffect, useRef } from 'react';
import { LAYOUT } from '../layoutSelectors';
import { watchResize } from '../watchResize';
import { boardShape, type PexesoPairs } from './pexeso';

/** Cards are never smaller than this (AC 3: 48 px touch targets); then the page may scroll. */
export const MIN_CARD = 48;
/** Largest card: phones (compact lessons) and larger windows. */
export const MAX_CARD = { compact: 96, wide: 128 } as const;

/**
 * The board's shape follows the layout viewport: portrait 3x4 / 4x5 / 5x6, landscape (and wide
 * windows) 4x3 / 5x4 / 6x5. Keyed on `documentElement.clientWidth/clientHeight` (never
 * innerWidth/innerHeight, which grow while a mobile browser zooms out an overflowing page).
 */
export const isLandscape = () => {
  const root = document.documentElement;
  const width = root.clientWidth || window.innerWidth;
  const height = root.clientHeight || window.innerHeight;
  return width > height;
};

/**
 * Sizes the Pexeso board (`--card`, `--cols`, `--rows` on the lesson section) to the room the
 * screen has: the largest card that fits the stage's width, then shrink by however much the
 * page overflows, never below MIN_CARD. Same approach as useBoardFit / usePatternFit.
 */
export default function usePexesoFit(pairs: PexesoPairs, ...keys: unknown[]) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const section = ref.current;
    if (!section || typeof window === 'undefined') return;
    const fit = () => {
      const stage = section.querySelector<HTMLElement>('.pexeso-stage');
      const board = section.querySelector<HTMLElement>('.pexeso-board');
      if (!stage || !board) return;
      const { cols, rows } = boardShape(pairs, isLandscape());
      section.style.setProperty('--cols', String(cols));
      section.style.setProperty('--rows', String(rows));
      section.dataset.shape = `${cols}x${rows}`;
      const gap = parseFloat(getComputedStyle(section).getPropertyValue('--card-gap')) || 6;
      const compact = section.closest(LAYOUT.compactPractice) !== null;
      const max = compact ? MAX_CARD.compact : MAX_CARD.wide;
      const set = (card: number) => section.style.setProperty('--card', `${card}px`);
      set(MIN_CARD);
      const byWidth = Math.floor((stage.clientWidth - 2 - (cols - 1) * gap) / cols);
      if (!(byWidth > 0)) return; // no layout (unit tests)
      let card = Math.min(max, byWidth);
      set(card);
      for (let i = 0; i < 4; i++) {
        // clientHeight is the layout viewport; innerHeight can grow while mobile browsers zoom out.
        const viewport = document.documentElement.clientHeight || window.innerHeight;
        const overflow = Math.max(
          document.documentElement.scrollHeight - viewport,
          section.getBoundingClientRect().bottom + window.scrollY + 8 - viewport,
          0,
        );
        if (overflow < 0.5) break;
        const next = Math.max(Math.min(MIN_CARD, byWidth), Math.floor(card - overflow / rows));
        if (next === card) break;
        card = next;
        set(card);
      }
    };
    fit();
    return watchResize(fit, [section.parentElement], { frame: 'last', fonts: true });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- refit when the caller's keys change
  }, [pairs, ...keys]);
  return ref;
}
