import { fill, pointsText, type Copy } from '../i18n';
import Icon from '../Icon';
import type { PointsFrame } from './animation';
import BadgeIcon from './BadgeIcon';
import { multiplierName, type Multiplier } from './multipliers';
import { BadgeMeter } from './BadgeButton';

export type LessonSave =
  | { state: 'saving' }
  | { state: 'failed' }
  | {
      state: 'saved';
      added: number;
      before: number;
      after: number;
      /** SCRUM-202: first-try answers and the multiplier applied to them. */
      firstTry: number;
      multiplier: Multiplier;
      /** SCRUM-309: a "Bear picks a game" lesson (x1.5 on top of the multiplier). */
      bearPicks?: boolean;
    };

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
        <button type="button" className="secondary" onClick={onRetry}>
          <Icon name="replay" />
          {t.retry}
        </button>
      </div>
    );
  const table = save.multiplier === 1 ? null : multiplierName(save.multiplier);
  return (
    <div className="summary-points">
      {save.bearPicks ? (
        // SCRUM-309: the mode's x1.5 on its own line, then the calculation with both factors,
        // e.g. "10 × 1/2 × 1.5 = 8 points" (only the x1.5 at table x1).
        <>
          <p className="points-bear-picks" aria-hidden="true">
            {t.bearPicks}
          </p>
          <p className="points-added points-multiplied" role="status">
            <span className="sr-only">
              {table && `${t.multiplierSaid[table]}, `}
              {t.bearPicks}:{' '}
            </span>
            {fill(t.multiplied, {
              firstTry: save.firstTry,
              multiplier: table
                ? `${t.multiplierShown[table]} × ${t.bearPicksFactor}`
                : t.bearPicksFactor,
              points: pointsText(t.units, save.added),
            })}
          </p>
        </>
      ) : save.multiplier === 1 ? (
        <p className="points-added" role="status">
          {fill(t.added, { points: pointsText(t.units, save.added) })}
        </p>
      ) : (
        // SCRUM-202: the calculation, e.g. "9 × 1/2 = 5 points" (nothing extra at x1).
        <p className="points-added points-multiplied" role="status">
          <span className="sr-only">{t.multiplierSaid[multiplierName(save.multiplier)]}: </span>
          {fill(t.multiplied, {
            firstTry: save.firstTry,
            multiplier: t.multiplierShown[multiplierName(save.multiplier)],
            points: pointsText(t.units, save.added),
          })}
        </p>
      )}
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
