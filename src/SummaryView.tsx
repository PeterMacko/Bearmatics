import type { RefObject } from 'react';
import type { Copy } from './i18n';

/** Completion screen with the first-try score. */
export default function SummaryView({
  t,
  total,
  firstTry,
  headingRef,
  onAgain,
  onBack,
}: {
  t: Copy;
  total: number;
  firstTry: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAgain: () => void;
  onBack: () => void;
}) {
  return (
    <section className="summary">
      <p className="eyebrow">{t.trail}</p>
      <span className="completion-mark" aria-hidden="true">
        ✓
      </span>
      <h2 ref={headingRef} tabIndex={-1}>
        {t.complete}
      </h2>
      <p className="intro">{t.summary}</p>
      <p className="completed-total">
        {total} {t.finished}
      </p>
      <p className="first-try">
        {t.first}{' '}
        <strong>
          {firstTry} / {total}
        </strong>
      </p>
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
      <button className="text-button" onClick={onBack}>
        {t.back}
      </button>
    </section>
  );
}
