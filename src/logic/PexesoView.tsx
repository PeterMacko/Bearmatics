import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from 'react';
import { fill, type Copy } from '../i18n';
import { ignoreRepeatClick, SCREEN_SETTLE_MS } from '../ignoreRepeatClick';
import { PexesoBack, PexesoFace } from './PexesoArt';
import { gamePoints, heartsLeft, type PexesoGame } from './pexeso';
import usePexesoFit from './usePexesoFit';

/** A deliberate next card tap comes at least this long after the previous accepted one. */
export const CARD_TAP_MS = 300;

const counted = (forms: readonly string[], n: number) =>
  fill(n === 1 ? forms[0] : n >= 2 && n <= 4 ? forms[1] : forms[2], { n });

/** The polite message after a turn ("Pair found: apple, 3 of 6" / "Not a pair"). */
export function turnMessage(t: Copy, game: PexesoGame): string {
  const last = game.last;
  if (!last) return '';
  if (last.kind === 'pair')
    return fill(t.pexeso.pairFound, {
      name: t.pexeso.names[last.picture],
      found: game.foundPairs,
      pairs: game.pairs,
    });
  return t.pexeso.notPair;
}

/** A card's accessible name: "Card 4, face down" / "Card 4, apple" / "apple, found". */
export function cardName(t: Copy, game: PexesoGame, index: number): string {
  const name = t.pexeso.names[game.cards[index]];
  if (game.found[index]) return fill(t.pexeso.cardFound, { name });
  if (game.open.includes(index)) return fill(t.pexeso.cardUp, { n: index + 1, name });
  return fill(t.pexeso.cardDown, { n: index + 1 });
}

/**
 * SCRUM-324: the Pexeso board (Logic Levels 6-8). The parent owns the game (engine state) and the
 * 1.5 s close; this view draws the cards, the pairs counter, the points chip with the hearts
 * (signed in only) and the help button, and guards the card taps: the repeat click of a double
 * tap (`detail > 1`), a tap within CARD_TAP_MS of the last accepted card tap and taps in the first
 * SCREEN_SETTLE_MS after the board appeared (the rest of the tap that started it) change nothing.
 * Keyboard Enter/Space (detail 0) always counts. Mount with a new `key` per game.
 */
export default function PexesoView({
  t,
  level,
  game,
  signedIn,
  headingRef,
  helpRef,
  helpOpen,
  onTap,
  onHelp,
}: {
  t: Copy;
  /** The level as shown in the Logic menu (6, 7 or 8). */
  level: number;
  game: PexesoGame;
  /** Points chip and hearts only for signed-in players (no points promise signed out). */
  signedIn: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  helpRef: RefObject<HTMLButtonElement | null>;
  helpOpen: boolean;
  onTap: (index: number) => void;
  onHelp: () => void;
}) {
  const p = t.pexeso;
  // When the board appeared (null before its first layout counts as too soon).
  const shownAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    shownAt.current = performance.now();
  }, []);
  const lastTap = useRef(-Infinity);
  const sectionRef = usePexesoFit(game.pairs, signedIn, t);
  const tap = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    const now = performance.now();
    const shown = shownAt.current;
    const tooSoon =
      event.detail > 0 &&
      (shown === null || now - shown < SCREEN_SETTLE_MS || now - lastTap.current < CARD_TAP_MS);
    if (ignoreRepeatClick(event, tooSoon)) return;
    lastTap.current = now;
    onTap(index);
  };
  const points = gamePoints(game);
  const hearts = heartsLeft(game);
  return (
    <section
      ref={sectionRef}
      className="practice pexeso-practice"
      data-pairs={game.pairs}
      data-signed-in={signedIn || undefined}
      style={{ '--cols': 3, '--rows': 4 } as CSSProperties}
    >
      <div className="practice-header">
        <div className="practice-top">
          <span className="level-pill">
            {t.level} {level}
          </span>
        </div>
        <div className="exercise-position pexeso-status">
          <span className="pexeso-pairs">
            <span aria-hidden="true">
              {game.foundPairs} / {game.pairs}
            </span>
            <span className="sr-only">
              {fill(p.pairsLabel, { found: game.foundPairs, pairs: game.pairs })}
            </span>
          </span>
          {signedIn && (
            <span className="pexeso-score">
              <span
                className="pexeso-chip"
                key={`p${points}`}
                data-points={points}
                data-dropped={points < game.pairs || undefined}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8z" />
                </svg>
                <span aria-hidden="true">{points}</span>
                <span className="sr-only">{fill(p.pointsLabel, { points })}</span>
              </span>
              <span className="pexeso-hearts" data-hearts={hearts}>
                {Array.from({ length: game.free }, (_, i) => (
                  <svg
                    key={i}
                    className="pexeso-heart"
                    data-used={i >= hearts || undefined}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M12 20.5S3 14.8 3 8.9C3 6 5.2 4 7.7 4c1.8 0 3.3 1 4.3 2.5C13 5 14.5 4 16.3 4 18.8 4 21 6 21 8.9c0 5.9-9 11.6-9 11.6z" />
                  </svg>
                ))}
                <span className="sr-only">
                  {hearts > 0 ? counted(p.heartsLabel, hearts) : p.noHearts}
                </span>
              </span>
            </span>
          )}
          <button
            ref={helpRef}
            type="button"
            className="hint-button pexeso-help-button"
            aria-label={p.help}
            title={p.help}
            aria-haspopup="dialog"
            aria-expanded={helpOpen}
            onClick={(event) => {
              if (!ignoreRepeatClick(event)) onHelp();
            }}
          >
            <span aria-hidden="true">i</span>
          </button>
        </div>
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="pexeso-title">
        {p.title}
      </h2>
      <div className="pexeso-stage">
        <div className="pexeso-board" role="group" aria-label={p.board}>
          {game.cards.map((picture, index) => {
            const found = game.found[index];
            const up = found || game.open.includes(index);
            return (
              <button
                key={index}
                type="button"
                className="pexeso-card"
                data-state={found ? 'found' : up ? 'open' : 'down'}
                aria-label={cardName(t, game, index)}
                aria-disabled={found || undefined}
                onClick={(event) => tap(event, index)}
              >
                <span className="pexeso-face" key={up ? 'up' : 'down'}>
                  {up ? <PexesoFace picture={picture} /> : <PexesoBack />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="sr-only pexeso-message" role="status" aria-live="polite" aria-atomic="true">
        <span key={game.turns}>{turnMessage(t, game)}</span>
      </p>
    </section>
  );
}
