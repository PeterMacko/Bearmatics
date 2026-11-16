import { useRef, useState } from 'react';
import HintDialog from '../HintDialog';
import { fill, pointsText, type Copy } from '../i18n';
import { staticFrame, type PointsFrame } from './animation';
import BadgeIcon from './BadgeIcon';
import { badgeFor, badgeThreshold } from './badges';

/**
 * Badge in the app bar (signed in only): the bear badge, and next to it, outside any border,
 * the current points over a bar showing the way to the next badge. One button; a tap opens the
 * details panel. `frame` is what is shown right now (it moves during the summary animation);
 * the accessible name always says the saved total.
 */
export default function BadgeButton({
  t,
  points,
  frame,
  onLeaderboard,
}: {
  t: Copy['points'];
  points: number;
  frame: PointsFrame;
  /** SCRUM-148: points and bar open the leaderboard. */
  onLeaderboard: (button: HTMLButtonElement) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const progress = badgeFor(points);
  const amount = pointsText(t.units, progress.points);
  const label = progress.badge
    ? fill(t.badge, { badge: progress.badge, points: amount })
    : fill(t.noBadge, { points: amount });
  const boardLabel = fill(t.leaderboardButton, { points: amount });
  return (
    <span className="badge-button">
      {/* SCRUM-148: two buttons. The badge opens the badge details, points + bar the leaderboard. */}
      <button
        ref={ref}
        type="button"
        className="badge-medal-button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className={`badge-medal${frame.levelUp ? ' level-up' : ''}`} key={frame.badge}>
          <BadgeIcon badge={frame.badge} size={40} />
        </span>
      </button>
      <button
        type="button"
        className="bar-progress"
        aria-label={boardLabel}
        title={boardLabel}
        aria-haspopup="dialog"
        onClick={(event) => onLeaderboard(event.currentTarget)}
      >
        <ProgressTrack frame={frame} />
        <span className="bar-progress-points" aria-hidden="true">
          {frame.points}
        </span>
      </button>
      {open && (
        <HintDialog
          titleId="badge-title"
          title={t.title}
          closeLabel={t.close}
          onClose={() => setOpen(false)}
          triggerRef={ref}
        >
          <BadgeDetails t={t} points={points} />
        </HintDialog>
      )}
    </span>
  );
}

/** The bar to the next badge. It jumps (no transition) when it starts again from zero. */
export function ProgressTrack({ frame }: { frame: PointsFrame }) {
  return (
    <span className="progress-track" aria-hidden="true">
      <span
        className={`progress-fill${frame.jump ? ' jump' : ''}`}
        style={{ width: `${Math.round(frame.share * 1000) / 10}%` }}
      />
    </span>
  );
}

export function BadgeDetails({ t, points }: { t: Copy['points']; points: number }) {
  const progress = badgeFor(points);
  return (
    <div className="badge-details">
      <BadgeIcon badge={progress.badge} size={96} />
      <p className="badge-name">
        {progress.badge ? fill(t.badgeName, { badge: progress.badge }) : t.noBadgeName}
      </p>
      <p className="badge-total">{pointsText(t.units, progress.points)}</p>
      <BadgeMeter t={t} frame={staticFrame(points)} />
      <p className="badge-how">{t.how}</p>
    </div>
  );
}

/** Progress to the next badge: the bar plus the same information as text. */
export function BadgeMeter({ t, frame }: { t: Copy['points']; frame: PointsFrame }) {
  // The badge being filled right now (during the animation it can lag one step behind).
  const next = frame.badge + 1;
  const toNext = Math.max(0, badgeThreshold(next) - frame.points);
  return (
    <div className="badge-meter">
      <ProgressTrack frame={frame} />
      <p>
        {fill(t.toNext, {
          points: pointsText(t.units, toNext),
          next,
        })}
      </p>
    </div>
  );
}
