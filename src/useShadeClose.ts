import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

/** How long a stray second tap is swallowed after closing (and ignored after opening). */
export const STRAY_TAP_MS = 600;

/**
 * Closing uncovers the page under the finger: the second tap of a double tap must not press a
 * button there, so presses are swallowed for a moment (mousedown too, or the second press moves
 * focus away from the trigger). Keyboard activation (click detail 0) is never a stray tap.
 */
const releases = new Set<() => void>();

export function swallowStrayTaps(ms = STRAY_TAP_MS) {
  const swallow = (press: Event) => {
    if (press.type === 'click' && (press as MouseEvent).detail === 0) return;
    press.preventDefault();
    press.stopPropagation();
  };
  const kinds = ['mousedown', 'click', 'dblclick'];
  for (const kind of kinds) document.addEventListener(kind, swallow, true);
  const release = () => {
    window.clearTimeout(timer);
    releases.delete(release);
    for (const kind of kinds) document.removeEventListener(kind, swallow, true);
  };
  const timer = window.setTimeout(release, ms);
  releases.add(release);
}

/** Ends every swallow at once (unit tests: the next test starts with a fresh page). */
export function releaseStrayTaps() {
  for (const release of releases) release();
}

/**
 * Close a modal with a tap on its shade (shared by HintDialog and the full-screen bear).
 * - Only a tap that starts AND ends on the shade closes: a drag (text selection, scrolling a
 *   table) that starts inside the window and ends outside must not, and a press released inside
 *   still gets its click on the shade, the common ancestor (QA265-01).
 * - `anywhere`: the whole layer is the shade (a full-screen picture closes on any tap).
 * - `settleMs`: taps this soon after opening, and second presses (click detail > 1), are
 *   ignored, so the second tap of a double tap on the opener does not close what it just opened
 *   (until the open time is known: too soon).
 * Returns the shade's event props, `close(event?)`, which closes like a shade tap (stray-tap
 * swallow for pointer clicks, the settle guard too) for an own close button, and `settling()`,
 * true while taps are still too soon.
 */
export function useShadeClose(
  onClose: () => void,
  {
    enabled = true,
    anywhere = false,
    settleMs = 0,
  }: { enabled?: boolean; anywhere?: boolean; settleMs?: number } = {},
) {
  const downOnShade = useRef(false);
  const upOnShade = useRef(false);
  const openedAt = useRef<number | null>(null);
  useEffect(() => {
    openedAt.current = performance.now();
  }, []);
  const onShade = (event: { target: EventTarget; currentTarget: EventTarget }) =>
    anywhere || event.target === event.currentTarget;
  /** A second press (detail > 1) or one in the first `settleMs`: part of a double tap. */
  const repeat = (event: ReactMouseEvent) => settleMs > 0 && event.detail > 1;
  const tooSoon = () => {
    if (settleMs <= 0) return false;
    const opened = openedAt.current;
    return opened === null || performance.now() - opened < settleMs;
  };
  const close = (event?: ReactMouseEvent) => {
    const pointer = !!event && event.detail > 0;
    if (pointer && (repeat(event) || tooSoon())) return;
    if (pointer) swallowStrayTaps();
    onClose();
  };
  const shadeProps = enabled
    ? {
        onPointerDown: (event: ReactPointerEvent) => {
          downOnShade.current = onShade(event);
        },
        onPointerUp: (event: ReactPointerEvent) => {
          upOnShade.current = onShade(event);
        },
        // Keep focus in the window until it closes, so it returns to the trigger.
        onMouseDown: (event: ReactMouseEvent) => {
          if (onShade(event)) event.preventDefault();
        },
        onClick: (event: ReactMouseEvent) => {
          if (!onShade(event) || !downOnShade.current || !upOnShade.current) return;
          downOnShade.current = false;
          if (repeat(event) || tooSoon()) return;
          swallowStrayTaps();
          onClose();
        },
      }
    : {};
  return { shadeProps, close, settling: tooSoon };
}
