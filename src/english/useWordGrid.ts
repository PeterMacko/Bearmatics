import { useLayoutEffect, useRef } from 'react';

/**
 * Sizes the square word buttons to the space the screen really has: start at the largest size,
 * then shrink by however much the page overflows (one row of 4 shrinks 4x slower in height).
 * The word font follows the square so the longest word stays on one line.
 * CSS keeps a size for the first paint and for environments without layout. `refit` changes when
 * something below the grid changes height without resizing the screen (the playback failure line
 * with its Try again button, SCRUM-172).
 */
export default function useWordGrid(key: unknown, refit?: unknown) {
  const grid = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el || typeof window === 'undefined') return;
    const fit = () => {
      const style = getComputedStyle(el);
      const cols = style.gridTemplateColumns.split(' ').filter(Boolean).length || 2;
      const gap = parseFloat(style.columnGap) || 10;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // Phones (compact layout) up to 340 px; tablets and desktops may use up to 440 px.
      const compact = el.closest('.compact-practice') !== null;
      const max = cols === 4 ? 560 : compact ? 340 : 440;
      const min = cols === 4 ? 4 * 6.5 * rem + 3 * gap : 2 * 6.5 * rem + gap;
      el.style.width = `${max}px`;
      el.style.minWidth = '0';
      const form = el.closest('form');
      // Page coordinates (add scrollY) so a scrolled page (200% text) is measured correctly.
      const bottoms = [el, ...(form ? Array.from(form.children) : [])].map(
        (child) => child.getBoundingClientRect().bottom + window.scrollY,
      );
      // clientHeight is the layout viewport; innerHeight can grow while mobile browsers zoom out.
      const viewport = document.documentElement.clientHeight || window.innerHeight;
      const overflow = Math.max(
        document.documentElement.scrollHeight - viewport,
        Math.max(...bottoms) + 8 - viewport,
        0,
      );
      let width = Math.min(max, el.getBoundingClientRect().width);
      width -= overflow * (cols === 4 ? 4 : 1);
      width = Math.floor(Math.max(Math.min(min, el.parentElement?.clientWidth ?? min), width));
      el.style.width = `${width}px`;
      // Never past the right edge (8px margin): on short landscape phones the height can allow
      // bigger squares than the width does (SCRUM-133 moved the top row away).
      for (let i = 0; i < 3; i++) {
        const over = el.getBoundingClientRect().right - (document.documentElement.clientWidth - 8);
        if (!(over > 0.5)) break;
        width = Math.floor(width - over);
        el.style.width = `${width}px`;
      }
      // Check and the word block share one width on phones.
      form?.style.setProperty('--word-block', `${width}px`);
      const square = (width - (cols - 1) * gap) / cols;
      // First guess from the square, then measure the widest of the four words on one line
      // and shrink the font until it fits the button's inner width. Never below 1rem, so
      // enlarged text still grows (very long words may then wrap at 200% text).
      let font = Math.max(rem, Math.min(1.75 * rem, square / 6));
      el.style.setProperty('--word-font', `${font}px`);
      const buttons = Array.from(el.querySelectorAll<HTMLElement>('.word-option'));
      if (buttons.length) {
        const button = getComputedStyle(buttons[0]);
        const inner =
          buttons[0].clientWidth - parseFloat(button.paddingLeft) - parseFloat(button.paddingRight);
        const widest = Math.max(
          ...buttons.map((b) => {
            const range = document.createRange();
            range.selectNodeContents(b);
            if (typeof range.getClientRects !== 'function') return 0; // no layout (tests)
            // Width of the text if it were on one line: sum of its line boxes.
            return Array.from(range.getClientRects()).reduce((sum, r) => sum + r.width, 0);
          }),
        );
        if (widest > inner - 2 && widest > 0) {
          font = Math.max(rem, Math.floor(font * ((inner - 2) / widest) * 10) / 10);
          el.style.setProperty('--word-font', `${font}px`);
        }
      }
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    // Refit when anything around the grid changes size (bear, header, fonts, rotation).
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    const section = el.closest('section');
    if (observer && section?.parentElement) observer.observe(section.parentElement);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [key, refit]);
  return grid;
}
