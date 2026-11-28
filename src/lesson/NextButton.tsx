import type { MouseEvent, RefObject } from 'react';
import { ignoreRepeatClick } from '../ignoreRepeatClick';

/**
 * The green Next button of a solved exercise (label + arrow; focused through `nextRef`).
 * `guard`: the repeat click of a double tap is ignored (the game screens). Without it (Maths and
 * English, `AnswerActions`) every click goes on (SCRUM-347 decides whether that changes).
 */
export default function NextButton({
  label,
  nextRef,
  onNext,
  guard,
}: {
  label: string;
  nextRef?: RefObject<HTMLButtonElement | null>;
  onNext?: () => void;
  guard: boolean;
}) {
  return (
    <button
      ref={nextRef}
      type="button"
      className="primary answer-button"
      data-state="correct"
      onClick={(event: MouseEvent) => {
        if (guard) {
          if (!ignoreRepeatClick(event)) onNext?.();
          return;
        }
        event.preventDefault();
        onNext?.();
      }}
    >
      {label}
      <span aria-hidden="true"> →</span>
    </button>
  );
}
