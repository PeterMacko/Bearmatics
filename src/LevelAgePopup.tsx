import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** How long the popup stays open by itself (Peter's SCRUM-308 round 2: "small popup"). */
const AGE_POPUP_MS = 3000;
/** Room kept to the window edges and between the badge and the popup, in px. */
const EDGE = 8;
const GAP = 7;

/**
 * SCRUM-308 round 2: the small popup a tap on a level's age badge opens ("Recommended for ages
 * 5–7"). It is a visual duplicate of the row's screen-reader text, so it is aria-hidden. It is
 * rendered into <body> with position: fixed from the badge's box, so the level list's scroll box
 * cannot clip it, and kept inside the window: right-aligned under the badge, shifted left to
 * fit, flipped above it when there is no room below. It follows the badge (list or page scroll,
 * layout changes) and closes when the badge leaves the list's visible part, on a pointerdown
 * anywhere but the badge and the popup, on a tap on the popup, on Escape and after AGE_POPUP_MS
 * (restarted by `openedAt`).
 */
export default function LevelAgePopup({
  anchor,
  text,
  openedAt,
  onClose,
}: {
  anchor: HTMLElement;
  text: string;
  /** Changes on every tap on the badge, restarting the closing time. */
  openedAt: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });

  useLayoutEffect(() => {
    const el = ref.current!;
    const place = (mayClose = true) => {
      const a = anchor.getBoundingClientRect();
      const de = document.documentElement;
      const vw = de.clientWidth;
      const vh = de.clientHeight;
      // Close when the badge is scrolled out of the list's visible part or out of the window.
      const list = anchor.closest('.level-options')?.getBoundingClientRect();
      const cy = (a.top + a.bottom) / 2;
      if (
        mayClose &&
        (!anchor.isConnected || cy < 0 || cy > vh || (list && (cy < list.top || cy > list.bottom)))
      ) {
        close.current();
        return;
      }
      el.style.maxWidth = `${Math.max(0, vw - 2 * EDGE)}px`;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = Math.max(EDGE, Math.min(a.right - w, vw - EDGE - w));
      let top = a.bottom + GAP;
      let side = 'below';
      if (top + h > vh - EDGE) {
        if (a.top - GAP - h >= EDGE) {
          top = a.top - GAP - h;
          side = 'above';
        } else {
          top = Math.max(EDGE, vh - EDGE - h);
          side = 'none';
        }
      }
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.setProperty(
        '--tail-x',
        `${Math.max(12, Math.min(w - 12, (a.left + a.right) / 2 - left))}px`,
      );
      el.dataset.side = side;
    };
    // Not closed from this first placement: it runs in the same commit as the level change,
    // while the menu's layout hook is between its old and new layout (the badge may then seem
    // outside the list). The next frame, before anything is painted, places it again.
    place(false);
    // Follow the badge on every frame too: layout can move it without a scroll event (the menu
    // re-measuring itself, a late font).
    let frame = requestAnimationFrame(function everyFrame() {
      place();
      frame = requestAnimationFrame(everyFrame);
    });
    // A tap on the badge keeps it (its click restarts the time); a tap on the popup closes it on
    // its click, so that click lands on the popup and never chooses the row under it.
    const onPointer = (e: PointerEvent) => {
      if (!(e.target instanceof Node && (anchor.contains(e.target) || el.contains(e.target))))
        close.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    const follow = () => place();
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [anchor, text]);

  useEffect(() => {
    const timer = window.setTimeout(() => close.current(), AGE_POPUP_MS);
    return () => window.clearTimeout(timer);
  }, [openedAt]);

  return createPortal(
    <span ref={ref} className="level-age-popup" aria-hidden="true" onClick={onClose}>
      {text}
    </span>,
    document.body,
  );
}
