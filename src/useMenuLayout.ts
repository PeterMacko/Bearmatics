import { useLayoutEffect, useRef } from 'react';

/** Menu-only intrinsic feasibility check. No application/selection state lives here. */
export function useMenuLayout(active: boolean, language: string, level: number, view = '') {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!active || !menu || typeof ResizeObserver === 'undefined') return;
    const list = menu.querySelector<HTMLElement>('.level-options')!;
    const heading = menu.querySelector<HTMLElement>('.menu-heading')!;
    const controls = menu.querySelector<HTMLElement>('.menu-controls');
    const bear = menu.querySelector<HTMLElement>('.companion')!;
    const cards = [...list.querySelectorAll<HTMLElement>('.level-option')];
    let frame = 0;
    let disposed = false;
    const reveal = (card: HTMLElement | null) => {
      if (!card || menu.dataset.menuMode === 'flow') return;
      const bounds = list.getBoundingClientRect(),
        box = card.getBoundingClientRect();
      if (box.top < bounds.top + 8) list.scrollTop -= bounds.top + 8 - box.top;
      else if (box.bottom > bounds.bottom - 8) list.scrollTop += box.bottom - bounds.bottom + 8;
    };
    const measure = () => {
      frame = 0;
      // Always measure the SAME constrained geometry. Temporarily probing it in
      // this synchronous task prevents scrollbar-width/fallback hysteresis. RO
      // sees only the final sizes, never the intermediate probe (no RO writes).
      menu.dataset.menuMode = 'contained';
      delete menu.dataset.menuCompact;
      const style = getComputedStyle(menu);
      const card = Math.max(...cards.map((item) => item.getBoundingClientRect().height));
      const required = (visibleCards: number) =>
        Math.max(
          heading.getBoundingClientRect().height,
          matchMedia('(max-width: 620px)').matches ? bear.getBoundingClientRect().height : 0,
        ) +
        (controls?.getBoundingClientRect().height ?? 0) +
        Math.min(visibleCards, cards.length) * card +
        16 +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        2 * parseFloat(style.rowGap);
      const fits = (visibleCards: number) =>
        required(visibleCards) <= menu.getBoundingClientRect().height + 0.5;
      // Short window: if the list could not show two whole levels, give it more room
      // with a compact heading (smaller title, intro hidden). Page scrolling is the
      // last resort, when even one level does not fit.
      if (!fits(2)) {
        menu.dataset.menuCompact = '';
        if (!fits(1)) menu.dataset.menuMode = 'flow';
      }
      reveal(
        list.querySelector<HTMLElement>(':focus')?.closest('.level-option') ??
          list.querySelector<HTMLInputElement>('input:checked')?.closest('.level-option') ??
          null,
      );
    };
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(measure);
    };
    const focus = (event: FocusEvent) =>
      reveal((event.target as HTMLElement).closest('.level-option'));
    measure();
    const observer = new ResizeObserver(schedule);
    [heading, controls, bear, ...cards].forEach((element) => element && observer.observe(element));
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    document.fonts?.addEventListener('loadingdone', schedule);
    list.addEventListener('focusin', focus);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      document.fonts?.removeEventListener('loadingdone', schedule);
      list.removeEventListener('focusin', focus);
      delete menu.dataset.menuMode;
      delete menu.dataset.menuCompact;
    };
  }, [active, language, level, view]);
  return ref;
}
