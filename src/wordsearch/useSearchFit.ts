import { useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { LAYOUT } from '../layoutSelectors';
import { watchResize } from '../watchResize';
import { GRID } from './grid';

/** Letter cells are never smaller than this (scope: 48 px targets, 6 cells fit 320 px). */
export const MIN_CELL = 48;
/** Largest cell: phones (compact lessons) and larger windows. */
export const MAX_CELL = { compact: 56, wide: 64 } as const;
/** In the two-column layouts the words' column keeps at least this width. */
const SIDE_MIN = 170;

/** Where Next sits once every word is found: in its place (side column / top-right corner) or
 *  below the whole lesson. `setBelow` must re-render the view with Next in the other place. */
type NextPlace = { below: boolean; setBelow: (below: boolean) => void };

/**
 * True when Next does not fit its usual place: a word of its label sticks out of the button
 * (QA247-01), the button runs out of its column or the window, or it covers the letter grid
 * (QA247-02). Rectangles are 0 in unit tests (never misplaced there).
 */
function nextMisplaced(section: HTMLElement): boolean {
  const button = section.querySelector<HTMLElement>('.ws-actions .answer-button');
  const board = section.querySelector<HTMLElement>('.ws-board');
  if (!button || !board) return false;
  if (button.scrollWidth > button.clientWidth + 0.5) return true;
  const next = button.getBoundingClientRect();
  const width = document.documentElement.clientWidth || window.innerWidth;
  if (next.right > width + 0.5 || next.left < -0.5) return true;
  const holder = button.closest('.ws-side, .wordsearch-practice')!.getBoundingClientRect();
  if (next.right > holder.right + 0.5 || next.left < holder.left - 0.5) return true;
  const grid = board.getBoundingClientRect();
  const across = Math.min(next.right, grid.right) - Math.max(next.left, grid.left);
  const down = Math.min(next.bottom, grid.bottom) - Math.max(next.top, grid.top);
  return across > 0.5 && down > 0.5;
}

/**
 * Sizes the word search grid (`--cell` on the lesson section) like the logic board
 * (useBoardFit): the largest cell that fits the stage's width, then smaller by however much the
 * page overflows (the grid is 6 cells high), never below MIN_CELL (then the page may scroll,
 * e.g. very large text). Refits when the caller's keys change (found words can wrap the list).
 * With `place` (solved grid) it then checks Next: when it does not fit its place it moves below
 * the lesson (and the grid is fitted again); on a resize (window, text size) Next first goes back
 * to its place and is checked again.
 */
export default function useSearchFit(keys: unknown[], place?: NextPlace) {
  const ref = useRef<HTMLElement>(null);
  /** Window size and text size when Next last moved below. */
  const movedAt = useRef('');
  useLayoutEffect(() => {
    const section = ref.current;
    if (!section || typeof window === 'undefined') return;
    const fitCells = () => {
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
        const parts = section.querySelectorAll('.ws-board, .ws-side > *, .ws-actions');
        const bottoms = Array.from(parts).map(
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
    // What can let Next fit its place again: the window and the text size (not the lesson's
    // own height, which changes when Next moves, nor the observer's first call). The layout
    // viewport (clientWidth/clientHeight), not innerWidth/innerHeight: a mobile browser zooms
    // out while Next in its place overflows sideways, so innerWidth grows, then shrinks once
    // Next is below, and Next went back and forth ~40 times a second (QA247-06).
    const room = () => {
      const root = document.documentElement;
      return `${root.clientWidth}x${root.clientHeight} ${getComputedStyle(section).fontSize}`;
    };
    const fit = () => {
      fitCells();
      // Next moves below; this effect runs again (place.below is a key) and refits the grid.
      if (place && !place.below && nextMisplaced(section)) {
        movedAt.current = room();
        place.setBelow(true);
      }
    };
    const resized = () => {
      if (place?.below && room() !== movedAt.current) flushSync(() => place.setBelow(false));
      else fit();
    };
    fit();
    return watchResize(resized, [section.parentElement], { frame: 'last', fonts: true });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- refit when the caller's keys change
  }, [...keys, place?.below]);
  return ref;
}
