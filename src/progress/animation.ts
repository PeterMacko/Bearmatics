import { useEffect, useRef, useState } from 'react';
import { badgeFor, badgeThreshold } from './badges';

/** What the badge progress shows at one moment (top bar and summary). */
export type PointsFrame = {
  points: number;
  badge: number;
  /** 0..1, share of the way from the current badge to the next one. */
  share: number;
  /** Set on the frame where a new badge is reached (the level change moment). */
  levelUp?: number;
  /** The bar jumps (no transition): after a level change it starts again from 0. */
  jump?: boolean;
  /** How long this frame stays before the next one (ms). */
  hold: number;
};

export function staticFrame(points: number): PointsFrame {
  const { badge, nextAt } = badgeFor(points);
  const from = badgeThreshold(badge);
  return { points, badge, share: (points - from) / (nextAt - from), hold: 0 };
}

export const LEVEL_PAUSE_MS = 1400;

/**
 * Frames for the summary animation (SCRUM-117, Peter): the bar fills point by point from the old
 * total to the new one. When a badge is reached, the bar first fills completely, then the level
 * change is shown, then the rest of the points fill the next badge's bar from zero.
 */
export function pointsFrames(before: number, after: number): PointsFrame[] {
  const start = staticFrame(before);
  if (after <= before) return [{ ...staticFrame(after), hold: 0 }];
  const step = Math.max(60, Math.min(250, Math.round(1500 / (after - before))));
  const frames: PointsFrame[] = [{ ...start, hold: step }];
  let badge = start.badge;
  for (let points = before + 1; points <= after; points++) {
    if (points >= badgeThreshold(badge + 1)) {
      // Reached the next badge: full bar of the old badge, then the change, then 0.
      frames.push({ points, badge, share: 1, hold: Math.max(step, 450) });
      badge++;
      frames.push({ points, badge, share: 0, levelUp: badge, jump: true, hold: LEVEL_PAUSE_MS });
      continue;
    }
    const from = badgeThreshold(badge);
    const share = (points - from) / (badgeThreshold(badge + 1) - from);
    frames.push({ points, badge, share, hold: step });
  }
  frames[frames.length - 1] = { ...frames[frames.length - 1], hold: 0 };
  return frames;
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Plays the frames from `before` to `after` once per `runKey`, after `delay` ms.
 * Reduced motion: the end state at once (the new badge is still shown and announced).
 * `onLevelUp` runs at each level change moment.
 */
export function usePointsAnimation(
  run: { key: string; before: number; after: number; delay: number } | null,
  onLevelUp: (badge: number) => void,
): PointsFrame | null {
  const [frame, setFrame] = useState<PointsFrame | null>(null);
  const levelUp = useRef(onLevelUp);
  levelUp.current = onLevelUp;
  const key = run?.key ?? null;
  useEffect(() => {
    if (!run) {
      setFrame(null);
      return;
    }
    const frames = pointsFrames(run.before, run.after);
    const last = frames[frames.length - 1];
    if (reducedMotion()) {
      const newBadge = badgeFor(run.after).badge > badgeFor(run.before).badge;
      setFrame({ ...last, levelUp: newBadge ? last.badge : undefined, jump: true });
      if (newBadge) levelUp.current(last.badge);
      return;
    }
    setFrame({ ...frames[0], jump: true });
    let timer = 0;
    const play = (index: number) => {
      const current = frames[index];
      setFrame(current);
      if (current.levelUp) levelUp.current(current.levelUp);
      if (index + 1 < frames.length) timer = window.setTimeout(() => play(index + 1), current.hold);
    };
    timer = window.setTimeout(() => play(1), run.delay);
    return () => window.clearTimeout(timer);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per run key
  }, [key]);
  return frame;
}
