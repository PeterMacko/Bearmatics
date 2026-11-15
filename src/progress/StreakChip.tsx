import { fill, pointsText, type Copy } from '../i18n';
import type { Streak } from './api';
import StreakIcon from './StreakIcon';

/** Look and accessible name of a streak (bar and summary). */
export function streakLook(t: Copy['points'], streak: Streak) {
  const days = pointsText(t.dayUnits, streak.streak);
  if (streak.frozen) return { look: 'ice' as const, label: fill(t.streakFrozen, { days }) };
  if (streak.streak < 1) return { look: 'shadow' as const, label: t.noStreak };
  if (!streak.today) return { look: 'shadow' as const, label: fill(t.streakWaiting, { days }) };
  return { look: 'flame' as const, label: fill(t.streak, { days }) };
}

/**
 * Streak next to the badge in the app bar (SCRUM-118 + Peter's review): lit flame only when a
 * lesson already counted today; otherwise a shadow flame (also with no streak yet); frozen: ice,
 * on wider screens with "Finish one lesson to warm up your streak", on phones the ice only.
 * Not a button; the whole meaning is in the accessible name.
 */
export default function StreakChip({
  t,
  streak,
  warming,
}: {
  t: Copy['points'];
  streak: Streak;
  /** Just unlocked: a short warm-up pop. */
  warming?: boolean;
}) {
  const { look, label } = streakLook(t, streak);
  return (
    <span
      className={`streak-chip ${look}${streak.frozen ? ' frozen' : ''}${warming ? ' warming' : ''}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <StreakIcon look={look} />
      {streak.streak >= 1 && (
        <span className="streak-days" aria-hidden="true">
          {streak.streak}
        </span>
      )}
      {streak.frozen && (
        <span className="streak-warm-up" aria-hidden="true">
          {t.warmUp}
        </span>
      )}
    </span>
  );
}
