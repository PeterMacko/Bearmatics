import { useLayoutEffect, useRef } from 'react';
import { LAYOUT } from '../layoutSelectors';
import { watchResize } from '../watchResize';
import { GRID } from './grid';

/** Letter cells are never smaller than this (scope: 48 px targets, 6 cells fit 320 px). */
export const MIN_CELL = 48;
/** Largest cell: phones (compact lessons) and larger windows. */
export const MAX_CELL = { compact: 56, wide: 64 } as const;
/** In the two-column layouts the words' column keeps at least this width. */
const SIDE_MIN = 170;

/**
 * Sizes the word search grid (`--cell` on the lesson section) like the logic board
 * (useBoardFit): the largest cell that fits the stage's width, then smaller by however much the
 * page overflows (the grid is 6 cells high), never below MIN_CELL (then the page may scroll,
 * e.g. very large text). Refits when the caller's keys change (found words can wrap the list).
 */
export default function useSearchFit(...keys: unknown[]) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const section = ref.current;
    if (!section || typeof window === 'undefined') return;
    const fit = () => {
      const stage = section.querySelector<HTMLElement>('.ws-stage');
      const play = section.querySelector<HTMLElement>('.ws-play');
      if (!stage || !play) return;
      const style = getComputedStyle(section);
      const gap = parseFloat(style.getPropertyValue('--cell-gap')) || 0;
      const pad = parseFloat(style.getPropertyValue('--board-pad')) || 0;
      const compact = section.closest(LAYOUT.compactPractice) !== null;
      const max = compact ? MAX_CELL.compact : MAX_CELL.wide;
      const set = (cell: number) => section.style.setProperty('--cell', `${cell}px`);
      set(MIN_CELL);
      // Two columns (grid beside the words): the grid may take the row minus the words' column.
      const playStyle = getComputedStyle(play);
      const twoColumns = playStyle.gridTemplateColumns.trim().split(/\s+/).length > 1;
      const room = twoColumns
        ? play.clientWidth - (parseFloat(playStyle.columnGap) || 0) - SIDE_MIN
        : stage.clientWidth;
      const byWidth = Math.floor((room - 2 * pad - 4 - (GRID - 1) * gap) / GRID);
      if (!(byWidth > 0)) return; // no layout (unit tests)
      let cell = Math.max(MIN_CELL, Math.min(max, byWidth));
      set(cell);
      for (let i = 0; i < 3; i++) {
        // clientHeight is the layout viewport; innerHeight can grow while mobile browsers zoom out.
        const viewport = document.documentElement.clientHeight || window.innerHeight;
        const bottoms = Array.from(play.querySelectorAll('.ws-board, .ws-side > *')).map(
          (child) => child.getBoundingClientRect().bottom + window.scrollY,
        );
        const overflow = Math.max(
          document.documentElement.scrollHeight - viewport,
          Math.max(...bottoms) + 8 - viewport,
          0,
        );
        if (overflow < 0.5) break;
        const next = Math.max(MIN_CELL, Math.floor(cell - overflow / GRID));
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
