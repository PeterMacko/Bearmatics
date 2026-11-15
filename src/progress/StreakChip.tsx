import { fill, pointsText, type Copy } from '../i18n';
import type { Streak } from './api';
import StreakIcon from './StreakIcon';

/**
 * Streak next to the badge in the app bar (SCRUM-118): flame + days; frozen: ice, and on wider
 * screens "Finish one lesson to warm up your streak". Phones: the ice icon only. Not a button;
 * the whole meaning is in the accessible name.
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
  if (!(streak.streak >= 1)) return null;
  const days = pointsText(t.dayUnits, streak.streak);
  const label = fill(streak.frozen ? t.streakFrozen : t.streak, { days });
  return (
    <span
      className={`streak-chip${streak.frozen ? ' frozen' : ''}${warming ? ' warming' : ''}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <StreakIcon frozen={streak.frozen} />
      <span className="streak-days" aria-hidden="true">
        {streak.streak}
      </span>
      {streak.frozen && (
        <span className="streak-warm-up" aria-hidden="true">
          {t.warmUp}
        </span>
      )}
    </span>
  );
}
