import { useEffect, useRef, useState } from 'react';
import { GRID_SIZE, type Cell } from './bearPath';

// SCRUM-289 / SCRUM-294: a "?" speech balloon at the board bear's mouth, a quiet reminder that
// the child can plan the way. A picture only (aria-hidden, no sound, no taps).

/** Without any tap or key for this long, the balloon pops in (and again after each further 30 s). */
export const BALLOON_IDLE_MS = 30_000;
/** How long the balloon stays before it fades. */
export const BALLOON_SHOW_MS = 3_000;
/** The fade out (the pop in takes 0.3 s too; reduced motion: neither). */
export const BALLOON_FADE_MS = 300;

type BalloonPhase = 'hidden' | 'shown' | 'fading';

/** Timers the hook uses (fake ones in tests). */
type BalloonClock = {
  setTimeout: (run: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
};
const windowClock: BalloonClock = {
  setTimeout: (run, ms) => window.setTimeout(run, ms),
  clearTimeout: (id) => window.clearTimeout(id),
};

/**
 * When the balloon shows. `active` = the puzzle is on screen and waits for the child (no demo,
 * no walk, not solved): otherwise the balloon is hidden and its timers stop. `first` = the
 * first puzzle of the lesson: there it pops in as soon as the bear appears (once). On every
 * puzzle it pops in after 30 s without any tap or key (pointerdown/keydown anywhere on the
 * page), and again after every further 30 s; a tap or key restarts the 30 s. Mount the caller
 * with a new key per puzzle (a new puzzle starts afresh).
 */
export function useIdleBalloon(
  { active, first }: { active: boolean; first: boolean },
  clock: BalloonClock = windowClock,
): BalloonPhase {
  const [phase, setPhase] = useState<BalloonPhase>('hidden');
  const firstShown = useRef(false);
  useEffect(() => {
    if (!active) return;
    let idle = 0;
    let hide = 0;
    let gone = 0;
    const stopShow = () => {
      clock.clearTimeout(hide);
      clock.clearTimeout(gone);
    };
    const pop = () => {
      stopShow();
      setPhase('shown');
      hide = clock.setTimeout(() => setPhase('fading'), BALLOON_SHOW_MS);
      gone = clock.setTimeout(() => setPhase('hidden'), BALLOON_SHOW_MS + BALLOON_FADE_MS);
    };
    const wait = () => {
      clock.clearTimeout(idle);
      idle = clock.setTimeout(() => {
        pop();
        wait();
      }, BALLOON_IDLE_MS);
    };
    if (first && !firstShown.current) {
      firstShown.current = true;
      pop();
    }
    wait();
    // Any tap or key anywhere restarts the 30 s (capture: also taps that stop propagation).
    document.addEventListener('pointerdown', wait, true);
    document.addEventListener('keydown', wait, true);
    return () => {
      clock.clearTimeout(idle);
      stopShow();
      document.removeEventListener('pointerdown', wait, true);
      document.removeEventListener('keydown', wait, true);
      // Stopped (demo, walk, solved, leaving): the balloon goes at once, timers and all.
      setPhase('hidden');
    };
  }, [active, first, clock]);
  return active ? phase : 'hidden';
}

/**
 * Which side of the bear the balloon goes: right of the mouth, or left in the last column, so
 * it always stays inside the board. It stays in the bear's own row and reaches only into the
 * next cell of that row, which is never the honey (the bear starts 2 or more moves away).
 */
export const balloonSide = (bear: Cell): 'left' | 'right' =>
  bear.col >= GRID_SIZE - 1 ? 'left' : 'right';

/**
 * The balloon's box in cell units relative to the bear's cell (0..1 is the bear's cell; the
 * gap between cells is ignored, so the real box is a little smaller). Pinned by tests and used
 * by the CSS (`.logic-balloon` left/right/top/width/height in % of the bear's box).
 */
export const BALLOON_BOX = { from: 0.68, width: 0.64, top: 0, height: 0.58 } as const;

/** The box on the board in cell units for a bear cell: [left, top, right, bottom]. */
export function balloonBoard(bear: Cell): [number, number, number, number] {
  const top = bear.row + BALLOON_BOX.top;
  const bottom = top + BALLOON_BOX.height;
  if (balloonSide(bear) === 'right') {
    const left = bear.col + BALLOON_BOX.from;
    return [left, top, left + BALLOON_BOX.width, bottom];
  }
  const right = bear.col + 1 - BALLOON_BOX.from;
  return [right - BALLOON_BOX.width, top, right, bottom];
}
