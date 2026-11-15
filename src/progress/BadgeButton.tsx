import { useRef, useState } from 'react';
import HintDialog from '../HintDialog';
import { fill, pointsText, type Copy } from '../i18n';
import BadgeIcon from './BadgeIcon';
import { badgeFor, badgeThreshold } from './badges';

/** Badge and points in the app bar (signed in only); a tap opens the details panel. */
export default function BadgeButton({ t, points }: { t: Copy['points']; points: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const progress = badgeFor(points);
  const amount = pointsText(t.units, progress.points);
  const label = progress.badge
    ? fill(t.badge, { badge: progress.badge, points: amount })
    : fill(t.noBadge, { points: amount });
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="badge-button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <BadgeIcon badge={progress.badge} size={36} />
        <span className="badge-points" aria-hidden="true">
          {progress.points}
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
    </>
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
      <BadgeMeter t={t} points={points} />
      <p className="badge-how">{t.how}</p>
    </div>
  );
}

/** Progress to the next badge: a bar plus the same information as text. */
export function BadgeMeter({ t, points }: { t: Copy['points']; points: number }) {
  const progress = badgeFor(points);
  // Share of the way from the current badge to the next one.
  const from = badgeThreshold(progress.badge);
  const share = (progress.points - from) / (progress.nextAt - from);
  return (
    <div className="badge-meter">
      <div className="badge-meter-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
      <p>
        {fill(t.toNext, { points: pointsText(t.units, progress.toNext), next: progress.badge + 1 })}
      </p>
    </div>
  );
}
