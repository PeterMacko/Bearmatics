import { useEffect, useState } from 'react';
import type { Copy } from '../i18n';
import type { Streak } from './api';
import { streakLook } from './StreakChip';
import StreakIcon from './StreakIcon';

/**
 * Streak beside the summary check mark (Peter's review of SCRUM-118): the streak from before
 * the lesson stays 1 second, then switches to the new number with a pop; the flame burns.
 * The accessible name always says the current streak.
 */
export default function SummaryStreak({
  t,
  before,
  streak,
}: {
  t: Copy['points'];
  /** The streak shown before this lesson was saved; null = no change to show. */
  before: number | null;
  streak: Streak;
}) {
  const changes = before !== null && before !== streak.streak;
  // The new number this summary has already switched to (after the 1 second).
  const [switchedTo, setSwitchedTo] = useState<number | null>(null);
  useEffect(() => {
    if (!changes) return;
    const timer = window.setTimeout(() => setSwitchedTo(streak.streak), 1000);
    return () => window.clearTimeout(timer);
  }, [changes, streak.streak]);
  const switched = !changes || switchedTo === streak.streak;
  const shown = switched ? streak.streak : (before ?? streak.streak);
  const { look, label } = streakLook(t, streak);
  return (
    <span className={`summary-streak ${look}`} role="img" aria-label={label}>
      <StreakIcon look={look} size={44} flicker={look === 'flame'} />
      <span
        className={`summary-streak-days${switched && changes ? ' switched' : ''}`}
        key={shown}
        aria-hidden="true"
      >
        {shown}
      </span>
    </span>
  );
}
