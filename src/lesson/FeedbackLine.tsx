import { useEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { Copy } from '../i18n';
import Icon from '../Icon';

/**
 * The lesson's feedback line (`#answer-feedback`, a polite status). A word playback failure
 * (`playError`) uses the same reserved space as an alert with a Try again button, so the layout
 * never grows (QA87-01); answer feedback returns once the word plays again. Where the message does
 * not fit beside Try again, CSS shows only the button and keeps the message for screen readers.
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
  const retry = useRef<HTMLButtonElement>(null);
  const failed = !!playError;
  // QA178-02: when the failure appears below the fold (200% text on the smallest phones), bring
  // Try again into view (only as far as needed; focus stays where it is).
  useEffect(() => {
    if (failed) retry.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [failed]);
  if (playError)
    return (
      <p className="feedback play-error" role="alert">
        <span>{playError.t.wordFailed}</span>{' '}
        <button
          ref={retry}
          type="button"
          className="secondary"
          onPointerDown={playError.keepKeyboard}
          onMouseDown={playError.keepKeyboard}
          onClick={playError.onRetry}
        >
          <Icon name="replay" />
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
