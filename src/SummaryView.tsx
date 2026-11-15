import type { ReactNode, RefObject } from 'react';
import type { Copy } from './i18n';

/** Completion screen with the first-try score. */
export default function SummaryView({
  t,
  eyebrow,
  finishedLabel,
  total,
  firstTry,
  headingRef,
  points,
  footer,
  onAgain,
  onBack,
}: {
  t: Copy;
  eyebrow?: string;
  finishedLabel?: string;
  total: number;
  firstTry: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** Points and badge for the lesson (SCRUM-117), shown above the buttons. */
  points?: ReactNode;
  /** Signed out: the sign-in hint, below the buttons (keeps the Finish → Replay geometry). */
  footer?: ReactNode;
  onAgain: () => void;
  onBack: () => void;
}) {
  return (
    <section className="summary">
      <p className="eyebrow">{eyebrow ?? t.trail}</p>
      <span className="completion-mark" aria-hidden="true">
        ✓
      </span>
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
      {points}
      <button
        className="primary"
        onClick={(event) => {
          // Ignore the continuation click of the Finish gesture, not a deliberate replay.
          if (event.detail > 1) {
            event.preventDefault();
            return;
          }
          onAgain();
        }}
      >
        {t.again}
      </button>
      <button
        className="text-button"
        onClick={(event) => {
          // Same guard: the summary is shorter now, so a double tap on Finish can reach here.
          if (event.detail > 1) {
            event.preventDefault();
            return;
          }
          onBack();
        }}
      >
        {t.back}
      </button>
      {footer}
    </section>
  );
}
