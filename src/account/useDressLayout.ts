import { useLayoutEffect, useRef } from 'react';
import { watchResize } from '../watchResize';

/** Classes the dress-screen layout looks up inside its section (see DressView). */
export const DRESS = {
  heading: '.menu-heading',
  preview: '.dress-preview',
  pane: '.dress-choices',
  actions: '.dress-actions',
  choice: '.look-option',
  bar: '.app-bar',
} as const;

/**
 * SCRUM-273: "Dress your bear" keeps the heading, the big bear and Save | Cancel in view while
 * only the choices pane scrolls ('contained'), like the menus (useMenuLayout): the screen is
 * one viewport high (CSS: 100dvh minus `--dress-top`, measured here), checked against the
 * layout viewport (`document.documentElement.clientHeight`). When that cannot work (very large
 * text) it falls back to one ordinary scrolling page ('flow') with the buttons after the
 * choices: the pane must be at least `minPaneRem` root-font units high (160 px at normal text
 * size, about two rows of choices with their part names), so twice-larger text, whose names and
 * buttons need twice the room, does not leave a sliver of choices between them.
 */
export function useDressLayout(key: string, minPaneRem = 10) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const screen = ref.current;
    if (!screen || typeof ResizeObserver === 'undefined') return;
    const pane = screen.querySelector<HTMLElement>(DRESS.pane)!;
    const reveal = (choice: HTMLElement | null) => {
      if (!choice || screen.dataset.dressMode !== 'contained') return;
      const bounds = pane.getBoundingClientRect();
      const box = choice.getBoundingClientRect();
      // 8 px keeps the focus ring (3 px + 2 px offset) inside the pane.
      if (box.top < bounds.top + 8) pane.scrollTop -= bounds.top + 8 - box.top;
      else if (box.bottom > bounds.bottom - 8) pane.scrollTop += box.bottom - bounds.bottom + 8;
    };
    const measure = () => {
      // Always probe the contained geometry first in this synchronous task (no flicker, no
      // hysteresis): its top, then whether everything ends inside the window.
      screen.dataset.dressMode = 'contained';
      const top = screen.getBoundingClientRect().top + window.scrollY;
      screen.style.setProperty('--dress-top', `${Math.max(0, Math.round(top))}px`);
      const root = document.documentElement;
      const rem = parseFloat(getComputedStyle(root).fontSize) || 16;
      const allShown = pane.scrollHeight <= pane.clientHeight + 1;
      // Heading, bear and buttons end inside the window (document coordinates).
      const inside = [DRESS.heading, DRESS.preview, DRESS.actions].every(
        (selector) =>
          (screen.querySelector(selector)?.getBoundingClientRect().bottom ?? 0) + window.scrollY <=
          root.clientHeight + 1,
      );
      const fits =
        inside &&
        root.scrollHeight <= root.clientHeight + 1 &&
        (allShown || pane.clientHeight >= minPaneRem * rem);
      if (!fits) screen.dataset.dressMode = 'flow';
      reveal(
        screen.querySelector<HTMLElement>(`${DRESS.pane} :focus`)?.closest(DRESS.choice) ?? null,
      );
    };
    const focus = (event: FocusEvent) =>
      reveal(
        event.target instanceof Element ? event.target.closest<HTMLElement>(DRESS.choice) : null,
      );
    measure();
    const stopWatching = watchResize(
      measure,
      [
        ...[DRESS.heading, DRESS.preview, DRESS.actions].map((s) => screen.querySelector(s)),
        document.querySelector(DRESS.bar),
      ],
      { frame: 'next', visualViewport: true, fonts: true },
    );
    pane.addEventListener('focusin', focus);
    return () => {
      stopWatching();
      pane.removeEventListener('focusin', focus);
      delete screen.dataset.dressMode;
      screen.style.removeProperty('--dress-top');
    };
  }, [key, minPaneRem]);
  return ref;
}
