import { fill, pointsText, type Copy } from '../i18n';
import type { PointsFrame } from './animation';
import BadgeIcon from './BadgeIcon';
import { BadgeMeter } from './BadgeButton';

export type LessonSave =
  | { state: 'saving' }
  | { state: 'failed' }
  | { state: 'saved'; added: number; before: number; after: number };

/**
 * Points on the summary (SCRUM-117), signed in only. `frame` moves while the points fill the
 * bar; `newBadge` is set from the level change moment on.
 */
export default function SummaryPoints({
  t,
  save,
  frame,
  newBadge,
  onRetry,
}: {
  t: Copy['points'];
  save: LessonSave | null;
  frame: PointsFrame;
  newBadge: number;
  onRetry: () => void;
}) {
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
      <BadgeMeter t={t} frame={frame} />
    </div>
  );
}

/** Signed out: one line inviting to sign in (SCRUM-117 scope 4). */
export function SignInHint({ t }: { t: Copy['points'] }) {
  return <p className="points-hint">{t.signIn}</p>;
}
