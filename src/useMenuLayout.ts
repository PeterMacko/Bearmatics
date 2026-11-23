import { useLayoutEffect, useRef } from 'react';
import { PHONE_QUERY } from './breakpoints';
import { LAYOUT } from './layoutSelectors';
import { watchResize } from './watchResize';

/** Menu-only intrinsic feasibility check. No application/selection state lives here. */
export function useMenuLayout(active: boolean, language: string, level: number, view = '') {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!active || !menu || typeof ResizeObserver === 'undefined') return;
    const list = menu.querySelector<HTMLElement>(LAYOUT.levelList)!;
    const heading = menu.querySelector<HTMLElement>(LAYOUT.heading)!;
    const controls = menu.querySelector<HTMLElement>(LAYOUT.controls);
    const bear = menu.querySelector<HTMLElement>(LAYOUT.bear)!;
    const cards = [...list.querySelectorAll<HTMLElement>(LAYOUT.levelCard)];
    const reveal = (card: HTMLElement | null) => {
      if (!card || menu.dataset.menuMode === 'flow') return;
      const bounds = list.getBoundingClientRect(),
        box = card.getBoundingClientRect();
      if (box.top < bounds.top + 8) list.scrollTop -= bounds.top + 8 - box.top;
      else if (box.bottom > bounds.bottom - 8) list.scrollTop += box.bottom - bounds.bottom + 8;
    };
    const measure = () => {
      // Always measure the SAME constrained geometry. Temporarily probing it in
      // this synchronous task prevents scrollbar-width/fallback hysteresis. RO
      // sees only the final sizes, never the intermediate probe (no RO writes).
      menu.dataset.menuMode = 'contained';
      delete menu.dataset.menuCompact;
      delete menu.dataset.menuTight;
      const style = getComputedStyle(menu);
      const card = Math.max(...cards.map((item) => item.getBoundingClientRect().height));
      const required = (visibleCards: number) =>
        Math.max(
          heading.getBoundingClientRect().height,
          matchMedia(PHONE_QUERY).matches ? bear.getBoundingClientRect().height : 0,
        ) +
        (controls?.getBoundingClientRect().height ?? 0) +
        Math.min(visibleCards, cards.length) * card +
        16 +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        2 * parseFloat(style.rowGap);
      // The estimate plus a check of the real layout: heading, list and controls must end
      // inside the menu (the decorative bear may overflow on very short wide windows).
      // A fully visible list always fits.
      const contentInside = () => {
        const bottom = menu.getBoundingClientRect().bottom - parseFloat(style.paddingBottom) + 1;
        return [heading, list, controls].every(
          (part) => !part || part.getBoundingClientRect().bottom <= bottom,
        );
      };
      const fits = (visibleCards: number) =>
        (list.scrollHeight <= list.clientHeight + 1 ||
          required(visibleCards) <= menu.getBoundingClientRect().height + 0.5) &&
        contentInside();
      // Short window: if the list could not show two whole levels, give it more room
      // with a compact heading (smaller title, intro hidden). Page scrolling is the
      // last resort, when even one level does not fit. The course choice (SCRUM-262: four
      // courses) compacts as soon as any course card would be cut off.
      const allCards = () => list.scrollHeight <= list.clientHeight + 1 && contentInside();
      if (view === 'choice' ? !allCards() : !fits(2)) {
        menu.dataset.menuCompact = '';
        if (!fits(1)) {
          // Last try before page flow (QA271-02): tighter padding in Start and the exercise
          // counts (same text size, 48 px targets), kept only when the whole menu then fits
          // with no scrolling at all. Menus whose list would still scroll fall to flow as before.
          menu.dataset.menuTight = '';
          if (!allCards()) {
            delete menu.dataset.menuTight;
            menu.dataset.menuMode = 'flow';
          }
        }
      }
      reveal(
        list.querySelector<HTMLElement>(':focus')?.closest(LAYOUT.levelCard) ??
          list.querySelector<HTMLInputElement>('input:checked')?.closest(LAYOUT.levelCard) ??
          null,
      );
    };
    const focus = (event: FocusEvent) =>
      reveal(
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(LAYOUT.levelCard)
          : null,
      );
    measure();
    const stopWatching = watchResize(measure, [heading, controls, bear, ...cards], {
      frame: 'next',
      visualViewport: true,
      fonts: true,
    });
    list.addEventListener('focusin', focus);
    return () => {
      stopWatching();
      list.removeEventListener('focusin', focus);
      delete menu.dataset.menuMode;
      delete menu.dataset.menuCompact;
      delete menu.dataset.menuTight;
    };
  }, [active, language, level, view]);
  return ref;
}
