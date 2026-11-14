import { useLayoutEffect, useRef, type ReactNode } from 'react';

export type BarBack = { label: string; onClick: () => void };

/**
 * One app bar on every screen (SCRUM-133): Back (only when there is somewhere to go), then the
 * end group in this order: badge and points, streak (SCRUM-117/118 fill those slots), profile,
 * settings. Top bar everywhere except short landscape phones, where CSS turns it into a narrow
 * bar on the left with the same order from top to bottom. DOM order = visual = keyboard order.
 */
export default function AppBar({
  label,
  back,
  inert,
  layoutKey,
  children,
}: {
  label: string;
  back: BarBack | null;
  inert: boolean;
  /** Changes whenever the screen or its text changes, so the clearance is measured again. */
  layoutKey: string;
  children: ReactNode;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  // Menus: the bar floats over the top corners. Where a menu heading reaches under the end group
  // (foldables, tablets), --bar-clear moves its text away from the buttons. Measured, because the
  // profile button's width follows the nickname.
  useLayoutEffect(() => {
    const end = endRef.current;
    if (!end) return;
    const root = document.documentElement;
    const update = () => {
      const heading = document.querySelector('.menu-shell .menu-heading');
      let clear = 0;
      if (heading) {
        const e = end.getBoundingClientRect();
        const h = heading.getBoundingClientRect();
        if (e.left > h.left && h.top < e.bottom && h.right > e.left - 8)
          clear = Math.ceil(h.right - e.left) + 8;
      }
      root.style.setProperty('--bar-clear', `${clear}px`);
    };
    update();
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(end);
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [layoutKey]);
  return (
    <nav className="site-header app-bar" aria-label={label} inert={inert}>
      {back && (
        <button
          type="button"
          className="corner-button back-button"
          aria-label={back.label}
          title={back.label}
          onClick={back.onClick}
        >
          <span aria-hidden="true">←</span>
        </button>
      )}
      <div className="app-bar-end" ref={endRef}>
        {children}
      </div>
    </nav>
  );
}
