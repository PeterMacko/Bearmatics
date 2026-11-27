import type { ReactNode, RefObject } from 'react';
import type { Copy } from './i18n';
import Icon from './Icon';
import { ignoreRepeatClick } from './ignoreRepeatClick';

/** Completion screen with the first-try score. */
export default function SummaryView({
  t,
  eyebrow,
  finishedLabel,
  total,
  firstTry,
  headingRef,
  time,
  points,
  streak,
  footer,
  onAgain,
  onBack,
  againLabel,
  backLabel,
}: {
  t: Copy;
  eyebrow?: string;
  finishedLabel?: string;
  total: number;
  firstTry: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** SCRUM-211: lesson time, as shown and in full words for screen readers; null: no line. */
  time?: { shown: string; spoken: string } | null;
  /** Points and badge for the lesson (SCRUM-117), shown above the buttons. */
  points?: ReactNode;
  /** The streak beside the check mark (SCRUM-118). */
  streak?: ReactNode;
  /** Signed out: the sign-in hint, below the buttons (keeps the Finish → Replay geometry). */
  footer?: ReactNode;
  onAgain: () => void;
  onBack: () => void;
  /** SCRUM-309, "Bear picks a game": "Next game" and "Stop" instead of Play again / Choose level. */
  againLabel?: string;
  backLabel?: string;
}) {
  return (
    <section className="summary">
      <p className="eyebrow">{eyebrow ?? t.trail}</p>
      <div className="completion-row">
        <span className="completion-mark" aria-hidden="true">
          ✓
        </span>
        {streak}
      </div>
      {/* Peter (SCRUM-117 review): no visible title or intro line; the heading stays for screen
          readers and as the focus target. */}
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {t.complete}
      </h2>
      <p className="completed-total">
        {total} {finishedLabel ?? t.finished}
      </p>
      <p className="first-try">
        {t.first}{' '}
        <strong>
          {firstTry} / {total}
        </strong>
      </p>
      {time && (
        <p className="lesson-time">
          <span aria-hidden="true">{time.shown}</span>
          <span className="sr-only">{time.spoken}</span>
        </p>
      )}
      {points}
      <button
        className="primary"
        onClick={(event) => {
          // Ignore the continuation click of the Finish gesture, not a deliberate replay.
          if (!ignoreRepeatClick(event)) onAgain();
        }}
      >
        <Icon name={againLabel ? 'play' : 'replay'} />
        {againLabel ?? t.again}
      </button>
      <button
        className="secondary"
        onClick={(event) => {
          // Same guard: the summary is shorter now, so a double tap on Finish can reach here.
          if (!ignoreRepeatClick(event)) onBack();
        }}
      >
        <Icon name={backLabel ? 'door' : 'list'} />
        {backLabel ?? t.back}
      </button>
      {footer}
    </section>
  );
}
