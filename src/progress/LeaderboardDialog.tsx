import { Fragment, useEffect, useRef, useState, type RefObject } from 'react';
import BearIcon from '../account/BearIcon';
import HintDialog from '../HintDialog';
import { fill, pointsText, type Copy } from '../i18n';
import { loadLeaderboard, type LeaderboardRow } from './api';
import StreakIcon from './StreakIcon';

type State =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; rows: LeaderboardRow[]; gapBefore: number | null };

/**
 * Leaderboard window (SCRUM-148): place, bear, nickname, streak and points; my row highlighted;
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
              className="text-button"
              onClick={() => {
                retried.current = true;
                box.current?.focus();
                setState({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
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
                <th scope="col">{t.place}</th>
                <th scope="col">{t.player}</th>
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
                      <td colSpan={4}>
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
                        <BearIcon bear={row.bear} size={28} />
                        <span>
                          {row.nickname}
                          {row.me && <span className="sr-only"> ({t.you})</span>}
                        </span>
                      </span>
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
