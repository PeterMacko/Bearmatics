import { useLayoutEffect, useRef } from 'react';
import { LAYOUT } from '../layoutSelectors';
import { watchResize } from '../watchResize';

/** Grid cells are never smaller than this (scope 7: at least 56 px). */
export const MIN_CELL = 56;
/** Largest cell: phones (compact lessons) and larger windows. */
export const MAX_CELL = { compact: 76, wide: 96 } as const;

/**
 * Sizes the logic board (`--cell` on the lesson section) to the room the screen really has:
 * start at the largest cell that fits the stage's width, then shrink by however much the page
 * overflows (the board is 4 cells high), never below MIN_CELL (then the page may scroll, e.g.
 * very large text). Same approach as the English word squares (useWordGrid).
 */
export default function useBoardFit(...keys: unknown[]) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const section = ref.current;
    if (!section || typeof window === 'undefined') return;
    const fit = () => {
      const stage = section.querySelector<HTMLElement>('.logic-stage');
      const play = section.querySelector<HTMLElement>('.logic-play');
      if (!stage || !play) return;
      const style = getComputedStyle(section);
      const gap = parseFloat(style.getPropertyValue('--cell-gap')) || 4;
      const pad = parseFloat(style.getPropertyValue('--board-pad')) || 6;
      const compact = section.closest(LAYOUT.compactPractice) !== null;
      const max = compact ? MAX_CELL.compact : MAX_CELL.wide;
      const set = (cell: number) => section.style.setProperty('--cell', `${cell}px`);
      set(MIN_CELL);
      const byWidth = Math.floor((stage.clientWidth - 2 * pad - 4 - 3 * gap) / 4);
      if (!(byWidth > 0)) return; // no layout (unit tests)
      let cell = Math.min(max, byWidth);
      set(cell);
      for (let i = 0; i < 3; i++) {
        // clientHeight is the layout viewport; innerHeight can grow while mobile browsers zoom out.
        const viewport = document.documentElement.clientHeight || window.innerHeight;
        const bottoms = Array.from(play.children).map(
          (child) => child.getBoundingClientRect().bottom + window.scrollY,
        );
        const overflow = Math.max(
          document.documentElement.scrollHeight - viewport,
          Math.max(...bottoms) + 8 - viewport,
          0,
        );
        if (overflow < 0.5) break;
        const next = Math.max(Math.min(MIN_CELL, byWidth), Math.floor(cell - overflow / 4));
        if (next === cell) break;
        cell = next;
        set(cell);
      }
    };
    fit();
    return watchResize(fit, [section.parentElement], { frame: 'last', fonts: true });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- refit when the caller's keys change
  }, keys);
  return ref;
}
