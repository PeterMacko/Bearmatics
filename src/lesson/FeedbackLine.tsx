import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import type { Copy } from '../i18n';

/**
 * The lesson's feedback line (`#answer-feedback`, a polite status). A word playback failure
 * (`playError`) uses the same reserved space as an alert with a Try again button, so the layout
 * never grows (QA87-01); answer feedback returns once the word plays again.
 */
export default function FeedbackLine({
  kind,
  children,
  playError,
}: {
  /** Suffix of the `feedback-*` colour class. */
  kind: string;
  children: ReactNode;
  playError?: {
    t: Copy;
    onRetry: () => void;
    keepKeyboard?: (event: PointerEvent | MouseEvent) => void;
  } | null;
}) {
  if (playError)
    return (
      <p className="feedback play-error" role="alert">
        {playError.t.wordFailed}{' '}
        <button
          type="button"
          className="text-button"
          onPointerDown={playError.keepKeyboard}
          onMouseDown={playError.keepKeyboard}
          onClick={playError.onRetry}
        >
          {playError.t.tryAgain}
        </button>
      </p>
    );
  return (
    <p
      id="answer-feedback"
      className={`feedback feedback-${kind}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </p>
  );
}
