import { useEffect, useState } from 'react';

/**
 * SCRUM-80: on-screen keyboard awareness for the write screen.
 *
 * Android usually shrinks the page when the keyboard opens; iPhone/iPad Safari usually keeps the
 * page and covers its lower part (only the visual viewport shrinks). Both show up as the visual
 * viewport becoming clearly shorter than the tallest height seen at this width while the text
 * input has focus. Only touch devices are watched: a PC window resized by the user (or docked
 * developer tools) must never switch the layout. Pinch zoom is ignored.
 */
export type KeyboardViewport = { open: boolean; height: number; top: number };

const CLOSED: KeyboardViewport = { open: false, height: 0, top: 0 };
const KEYBOARD_MIN = 120; // px a keyboard takes at least; smaller changes are browser bars
const KEYBOARD_SHARE = 0.25; // ...or at least this share of a short screen (small phone landscape)
const BROWSER_BARS = 40; // allowance when a rotated height is estimated
const tallest = new Map<number, number>();
let lastWidth = 0;
let keyboardWasOpen = false;

/** Layout width (not the zoomed visual width), so pinch zoom keeps the same baseline. */
const layoutWidth = () => Math.round(document.documentElement.clientWidth || window.innerWidth);

function measure() {
  const vv = window.visualViewport;
  const height = vv ? vv.height : window.innerHeight;
  const width = layoutWidth();
  // Layout height counts too: on iPhone it keeps the full height while the keyboard covers.
  const full = Math.max(height, window.innerHeight);
  // A width never seen before starts from its real height. Only when the phone was rotated
  // while the keyboard was open is that height already shrunk: then the new full height is
  // about the previous width (the other side of the screen). Never from window.screen: in split
  // screen or a smaller window that would report a keyboard that is not there (QA94-02).
  const seed = !tallest.has(width) && keyboardWasOpen && lastWidth ? lastWidth - BROWSER_BARS : 0;
  tallest.set(width, Math.max(tallest.get(width) ?? seed, full));
  lastWidth = width;
  return {
    height,
    top: vv ? vv.offsetTop : 0,
    base: tallest.get(width)!,
    zoomed: vv ? vv.scale > 1.01 : false,
  };
}

const isTouch = () =>
  (navigator.maxTouchPoints ?? 0) > 0 ||
  (typeof matchMedia === 'function' && matchMedia('(any-pointer: coarse)').matches);

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
    if (!enabled || typeof window === 'undefined' || !isTouch()) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { height, top, base, zoomed } = measure();
        const focused = input.current !== null && document.activeElement === input.current;
        const open =
          focused && !zoomed && base - height >= Math.min(KEYBOARD_MIN, base * KEYBOARD_SHARE);
        keyboardWasOpen = open;
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
      // A new session must not start with the previous keyboard state.
      setState(CLOSED);
    };
  }, [enabled, input]);
  return enabled ? state : CLOSED;
}
