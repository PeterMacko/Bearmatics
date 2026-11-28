import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from 'react';
import type { Copy } from '../i18n';
import { ignoreRepeatClick } from '../ignoreRepeatClick';
import FeedbackLine from '../lesson/FeedbackLine';
import PracticeHeader from '../lesson/PracticeHeader';
import type { Feedback } from '../session';
import { EyeIcon } from './LogicArt';
import { capitalize, itemName, PatternPicture, rowLabel } from './PatternArt';
import PatternDemo from './PatternDemo';
import { answerOf, itemKey, type PatternRow } from './patterns';
import usePatternFit from './usePatternFit';

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Logic Levels 3-5 (SCRUM-299): a row of pictures with a dashed "?" place and big picture
 * choices. A tap answers at once: right = the picture moves into the "?" place; wrong = a red
 * mark on that choice, and every choice stays tappable for the next try. The parent owns the
 * session; this view owns the marks, the move and the demo. Mount with a new `key` per row.
 */
export default function PatternPracticeView({
  t,
  row,
  position,
  reviewing,
  solved,
  feedback,
  nextLabel,
  demoRun,
  nextRef,
  onChoose,
  onNext,
  onShowMe,
  onDemoDone,
}: {
  t: Copy;
  row: PatternRow;
  position: string;
  reviewing: boolean;
  solved: boolean;
  feedback: Feedback;
  nextLabel: string;
  /** Non-zero while the demo shows (a new number restarts it). */
  demoRun: number;
  nextRef: RefObject<HTMLButtonElement | null>;
  /** A choice was tapped: its key is the session answer. */
  onChoose: (key: string) => void;
  onNext: () => void;
  onShowMe: () => void;
  onDemoDone: () => void;
}) {
  const [reduced] = useState(prefersReducedMotion);
  const [wrong, setWrong] = useState<ReadonlySet<string>>(() => new Set());
  /** Where the right picture starts its move (offset from the "?" place); null = no move. */
  const [from, setFrom] = useState<{ x: number; y: number } | null>(null);
  const answered = useRef(false);
  const gapRef = useRef<HTMLSpanElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const demo = demoRun > 0;
  const dice = row.places.some((p) => p.kind === 'count');
  const sectionRef = usePatternFit(demoRun, solved, row.places.length, dice);
  const answerKey = itemKey(answerOf(row));
  const p = t.pattern;

  // A new row and the end of the demo put focus on the row (it reads the pictures and the
  // question mark); a solved row focuses Next.
  useEffect(() => {
    if (solved) nextRef.current?.focus({ preventScroll: true });
    else if (!demo) rowRef.current?.focus({ preventScroll: true });
  }, [solved, demo, nextRef]);

  const choose = (event: MouseEvent<HTMLButtonElement>, key: string) => {
    // A double tap is one answer; after the right answer nothing more counts.
    if (ignoreRepeatClick(event) || answered.current || demo) return;
    if (key === answerKey) {
      answered.current = true;
      const gap = gapRef.current?.getBoundingClientRect();
      const button = event.currentTarget.getBoundingClientRect();
      if (!reduced && gap && gap.width > 0)
        setFrom({
          x: button.left + button.width / 2 - (gap.left + gap.width / 2),
          y: button.top + button.height / 2 - (gap.top + gap.height / 2),
        });
    } else setWrong((marks) => new Set(marks).add(key));
    onChoose(key);
  };

  const filled = solved;
  const message = feedback === 'correct' ? p.correct : feedback === 'incorrect' ? p.incorrect : '';
  const cols = row.places.length;
  return (
    <section
      ref={sectionRef}
      className="practice pattern-practice"
      data-level={row.level}
      data-places={cols}
      data-dice={dice || undefined}
      data-solved={solved || undefined}
      style={{ '--cols': cols, '--choices': row.choices.length } as CSSProperties}
    >
      <PracticeHeader t={t} level={row.level} position={position} />
      <h2>{reviewing ? p.reviewTitle : p.questions[row.level]}</h2>
      <div className="pattern-play">
        <div className="pattern-stage">
          {demo ? (
            <PatternDemo key={demoRun} t={t} reduced={reduced} onDone={onDemoDone} />
          ) : (
            <div
              ref={rowRef}
              className="pattern-row"
              role="img"
              tabIndex={-1}
              aria-label={rowLabel(p, row.places, row.gap, filled)}
            >
              {row.places.map((item, i) =>
                i === row.gap ? (
                  <span
                    key={i}
                    ref={gapRef}
                    className="pattern-place pattern-gap"
                    data-filled={filled || undefined}
                  >
                    {filled ? (
                      <span
                        className="pattern-arrive"
                        data-moving={from ? true : undefined}
                        style={
                          from
                            ? ({
                                '--from-x': `${from.x}px`,
                                '--from-y': `${from.y}px`,
                              } as CSSProperties)
                            : undefined
                        }
                      >
                        <PatternPicture item={item} />
                      </span>
                    ) : (
                      <span className="pattern-question" aria-hidden="true">
                        ?
                      </span>
                    )}
                  </span>
                ) : (
                  <span key={i} className="pattern-place">
                    <PatternPicture item={item} />
                  </span>
                ),
              )}
            </div>
          )}
        </div>
        <div className="pattern-choices" role="group" aria-label={p.choices}>
          {row.choices.map((item) => {
            const key = itemKey(item);
            const state =
              solved && key === answerKey ? 'correct' : wrong.has(key) ? 'incorrect' : '';
            return (
              <button
                key={key}
                type="button"
                className="pattern-choice"
                aria-label={capitalize(itemName(p, item))}
                aria-disabled={solved || demo || undefined}
                data-state={state || undefined}
                onClick={(event) => choose(event, key)}
              >
                <PatternPicture item={item} />
                {state && (
                  <span className="pattern-mark" aria-hidden="true">
                    {state === 'correct' ? '✓' : '✗'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <FeedbackLine kind={feedback}>{message}</FeedbackLine>
        <div className="answer-actions pattern-actions">
          {solved ? (
            <button
              ref={nextRef}
              type="button"
              className="primary answer-button"
              data-state="correct"
              onClick={(event: MouseEvent) => {
                if (!ignoreRepeatClick(event)) onNext();
              }}
            >
              {nextLabel}
              <span aria-hidden="true"> →</span>
            </button>
          ) : (
            // Keeps Next's place so nothing moves when it appears.
            <span className="answer-button pattern-next-room" aria-hidden="true" />
          )}
          <button
            type="button"
            className="secondary logic-show-me pattern-show-me"
            aria-disabled={demo || undefined}
            onClick={(event: MouseEvent) => {
              if (ignoreRepeatClick(event) || demo) return;
              setFrom(null);
              onShowMe();
            }}
          >
            <EyeIcon />
            {t.showMe}
          </button>
        </div>
      </div>
    </section>
  );
}
