import { useEffect } from 'react';
import { fill, pointsText, type Copy } from '../i18n';
import BadgeIcon from './BadgeIcon';
import { BadgeMeter } from './BadgeButton';
import { badgeFor } from './badges';

export type LessonSave =
  | { state: 'saving' }
  | { state: 'failed' }
  | { state: 'saved'; added: number; before: number; after: number };

/** Points on the summary (SCRUM-117). Signed out: only the sign-in hint. */
export default function SummaryPoints({
  t,
  signedIn,
  save,
  onRetry,
  onNewBadge,
}: {
  t: Copy['points'];
  signedIn: boolean;
  save: LessonSave | null;
  onRetry: () => void;
  onNewBadge: () => void;
}) {
  const newBadge =
    save?.state === 'saved' && badgeFor(save.after).badge > badgeFor(save.before).badge
      ? badgeFor(save.after).badge
      : 0;
  useEffect(() => {
    // After the completion fanfare (about 2 s), so the two sounds do not cut each other.
    if (!newBadge) return;
    const timer = window.setTimeout(onNewBadge, 2200);
    return () => window.clearTimeout(timer);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per new badge
  }, [newBadge]);
  if (!signedIn) return <p className="points-hint">{t.signIn}</p>;
  if (!save) return null;
  if (save.state === 'saving')
    return (
      <p className="points-saving" role="status">
        {t.saving}
      </p>
    );
  if (save.state === 'failed')
    return (
      <div className="points-failed" role="alert">
        <p>{t.failed}</p>
        <button type="button" className="text-button" onClick={onRetry}>
          {t.retry}
        </button>
      </div>
    );
  return (
    <div className="summary-points">
      <p className="points-added" role="status">
        {fill(t.added, { points: pointsText(t.units, save.added) })}
      </p>
      {newBadge ? (
        <div
          className="new-badge"
          role="status"
          aria-label={fill(t.newBadgeSaid, { badge: newBadge })}
        >
          <BadgeIcon badge={newBadge} size={44} />
          <span aria-hidden="true">{t.newBadge}</span>
        </div>
      ) : null}
      <BadgeMeter t={t} points={save.after} />
    </div>
  );
}
