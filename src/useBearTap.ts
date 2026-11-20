import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';

/** How long the bubble and the happy face stay after a tap (the hop takes 1 s of it). */
const BEAR_TAP_MS = 1500;
/** The summary's cheer (and a lesson's think) animation: taps wait until it has run. */
const BEAR_REACTION_MS = 700;

/**
 * SCRUM-172 easter egg: tapping the bear. Pointer only and secret (the bear stays aria-hidden and
 * out of the tab order), one tap reaction at a time, never during an answer reaction
 * (`reacting`) or while the mood animation of a freshly shown happy/sad bear still runs. The
 * press never moves focus (pointer/mouse down defaults are prevented), so an answer field keeps
 * focus and its keyboard. Reduced motion: no hop.
 */
export function useBearTap({
  reacting,
  moodAnimates,
  onTap,
}: {
  reacting: boolean;
  /** Mounted with a happy/sad mood: its animation runs for BEAR_REACTION_MS. */
  moodAnimates: boolean;
  onTap?: () => void;
}) {
  const [tap, setTap] = useState<{ hop: boolean } | null>(null);
  const running = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = performance.now();
    return () => {
      clearTimeout(timer.current);
      running.current = false;
    };
  }, []);
  const keepFocus = (event: PointerEvent | MouseEvent) => event.preventDefault();
  const onClick = () => {
    if (running.current || reacting) return;
    if (moodAnimates && performance.now() - mountedAt.current < BEAR_REACTION_MS) return;
    running.current = true;
    const reduce =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTap({ hop: !reduce });
    onTap?.();
    timer.current = setTimeout(() => {
      running.current = false;
      setTap(null);
    }, BEAR_TAP_MS);
  };
  return {
    tapped: tap !== null,
    hop: tap?.hop ?? false,
    handlers: { onPointerDown: keepFocus, onMouseDown: keepFocus, onClick },
  };
}
