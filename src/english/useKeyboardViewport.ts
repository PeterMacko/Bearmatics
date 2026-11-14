import { useEffect, useState } from 'react';

/**
 * SCRUM-80: on-screen keyboard awareness for the write screen.
 *
 * Android usually shrinks the page when the keyboard opens; iPhone/iPad Safari usually keeps the
 * page and covers its lower part (only the visual viewport shrinks). Both show up as the visual
 * viewport becoming clearly shorter than the tallest height seen at this width while the text
 * input has focus. PC with a physical keyboard never shrinks, so the normal layout stays.
 */
export type KeyboardViewport = { open: boolean; height: number; top: number };

const CLOSED: KeyboardViewport = { open: false, height: 0, top: 0 };
const KEYBOARD_MIN = 120; // px a keyboard takes at least; smaller changes are browser bars
const tallest = new Map<number, number>();

function measure() {
  const vv = window.visualViewport;
  const height = vv ? vv.height : window.innerHeight;
  const width = Math.round(vv ? vv.width : window.innerWidth);
  // Layout height counts too: on iPhone it keeps the full height while the keyboard covers.
  const full = Math.max(height, window.innerHeight);
  tallest.set(width, Math.max(tallest.get(width) ?? 0, full));
  return { height, top: vv ? vv.offsetTop : 0, base: tallest.get(width)! };
}

if (typeof window !== 'undefined') {
  measure();
  window.visualViewport?.addEventListener('resize', measure);
  window.addEventListener('resize', measure);
}

export function useKeyboardViewport(
  input: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): KeyboardViewport {
  const [state, setState] = useState<KeyboardViewport>(CLOSED);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { height, top, base } = measure();
        const focused = input.current !== null && document.activeElement === input.current;
        const open = focused && base - height >= KEYBOARD_MIN;
        setState((previous) =>
          previous.open === open &&
          Math.abs(previous.height - height) < 1 &&
          Math.abs(previous.top - top) < 1
            ? previous
            : { open, height: Math.round(height), top: Math.round(top) },
        );
      });
    };
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, [enabled, input]);
  return enabled ? state : CLOSED;
}
