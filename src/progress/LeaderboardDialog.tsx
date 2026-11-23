import { Fragment, useEffect, useRef, useState, type RefObject } from 'react';
import BearIcon from '../account/BearIcon';
import HintDialog from '../HintDialog';
import Icon from '../Icon';
import { fill, pointsText, type Copy } from '../i18n';
import { loadLeaderboard, type LeaderboardRow } from './api';
import BadgeIcon from './BadgeIcon';
import { badgeFor } from './badges';
import StreakIcon from './StreakIcon';

type State =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; rows: LeaderboardRow[]; gapBefore: number | null };

/**
 * Leaderboard window (SCRUM-148): place, bear, nickname, bear badge (SCRUM-258), streak and
 * points; my row highlighted;
 * top 10, and if I am lower a gap line, the player before me, me and the player after me.
 * A table with column headers for screen readers.
 */
export default function LeaderboardDialog({
  t,
  hidden,
  triggerRef,
  onClose,
}: {
  t: Copy['points'];
  /** I switched the leaderboard off in my profile. */
  hidden: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Try again removes its own button: keep focus in the window (QA154-01), and on a new failure
  // put it on the new Try again.
  const box = useRef<HTMLDivElement>(null);
  const retried = useRef(false);
  useEffect(() => {
    if (!retried.current || state.kind !== 'failed') return;
    box.current?.querySelector<HTMLElement>('.leaderboard-state button')?.focus();
  }, [state]);
  useEffect(() => {
    let live = true;
    loadLeaderboard().then(
      (board) => live && setState({ kind: 'ready', ...board }),
      () => live && setState({ kind: 'failed' }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  return (
    <HintDialog
      titleId="leaderboard-title"
      title={t.leaderboard}
      closeLabel={t.closeLeaderboard}
      onClose={onClose}
      triggerRef={triggerRef}
    >
      <div className="leaderboard" aria-busy={state.kind === 'loading'} ref={box} tabIndex={-1}>
        {state.kind === 'loading' && (
          <p className="leaderboard-state" role="status">
            {t.loading}
          </p>
        )}
        {state.kind === 'failed' && (
          <div className="leaderboard-state" role="alert">
            <p>{t.loadFailed}</p>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                retried.current = true;
                box.current?.focus();
                setState({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
              <Icon name="replay" />
              {t.retry}
            </button>
          </div>
        )}
        {state.kind === 'ready' && state.rows.length === 0 && (
          <p className="leaderboard-state">{t.empty}</p>
        )}
        {state.kind === 'ready' && state.rows.length > 0 && (
          <table className="leaderboard-table" aria-labelledby="leaderboard-title">
            <thead>
              <tr>
                <th scope="col">
                  {/* Narrow windows show "#" (the Slovak "Poradie" is too wide, QA154-02b). */}
                  <span className="th-long">{t.place}</span>
                  <span className="th-short" aria-hidden="true">
                    #
                  </span>
                </th>
                <th scope="col">{t.player}</th>
                <th scope="col" className="mid">
                  {/* Narrow windows show a plain medal instead of the word (SCRUM-258 fit). */}
                  <span className="th-long">{t.badgeColumn}</span>
                  <span className="th-short" aria-hidden="true">
                    <BadgeIcon badge={0} size={18} plain />
                  </span>
                </th>
                <th scope="col" className="num">
                  {t.streakColumn}
                </th>
                <th scope="col" className="num">
                  {t.pointsColumn}
                </th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row, index) => (
                <Fragment key={`${row.place}:${row.nickname}:${index}`}>
                  {state.gapBefore === index && (
                    <tr className="leaderboard-gap">
                      <td colSpan={5}>
                        <span aria-hidden="true">…</span>
                        <span className="sr-only">{t.gap}</span>
                      </td>
                    </tr>
                  )}
                  <tr
                    className={row.me ? 'me' : undefined}
                    aria-current={row.me ? 'true' : undefined}
                  >
                    <td className="num" aria-label={fill(t.placeLabel, { place: row.place })}>
                      {row.place}.
                    </td>
                    <td>
                      <span className="leaderboard-player">
                        <BearIcon look={row.look} size={28} />
                        <span>
                          {row.nickname}
                          {row.me && <span className="sr-only"> ({t.you})</span>}
                        </span>
                      </span>
                    </td>
                    <td className="mid">
                      <LeaderboardBadge t={t} points={row.points} />
                    </td>
                    <td className="num">
                      {row.streak > 0 ? (
                        <span
                          className="leaderboard-streak"
                          aria-label={fill(row.frozen ? t.streakFrozenShort : t.streak, {
                            days: pointsText(t.dayUnits, row.streak),
                          })}
                        >
                          <StreakIcon look={row.frozen ? 'ice' : 'flame'} size={20} />
                          <span aria-hidden="true">{row.streak}</span>
                        </span>
                      ) : (
                        <span aria-label={fill(t.streak, { days: pointsText(t.dayUnits, 0) })}>
                          –
                        </span>
                      )}
                    </td>
                    <td className="num">{row.points}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
        {hidden && <p className="leaderboard-note">{t.hiddenNote}</p>}
      </div>
    </HintDialog>
  );
}

/** The bear badge follows the points (never stored); below 30 points a dash (SCRUM-258). */
function LeaderboardBadge({ t, points }: { t: Copy['points']; points: number }) {
  const { badge } = badgeFor(points);
  if (badge === 0)
    return (
      <span role="img" aria-label={t.noBadgeName}>
        –
      </span>
    );
  return (
    <span className="leaderboard-badge" role="img" aria-label={fill(t.badgeName, { badge })}>
      <BadgeIcon badge={badge} size={28} />
    </span>
  );
}
