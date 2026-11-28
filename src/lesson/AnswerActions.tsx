import type { MouseEvent, PointerEvent, ReactNode, RefObject } from 'react';
import type { Copy } from '../i18n';
import type { Feedback } from '../session';
import NextButton from './NextButton';

/**
 * Check / Next under a lesson exercise. By default Check submits the form and a separate Next
 * button (focused through `nextRef`) replaces it once solved. `singleButton` keeps ONE submit
 * button that turns into Next (English writing: the input keeps the on-screen keyboard open);
 * `keepKeyboard` then runs on pointer/mouse down. `children` go after the button (hint slot).
 */
export default function AnswerActions({
  t,
  solved,
  feedback,
  nextLabel,
  nextRef,
  onNext,
  singleButton = false,
  keepKeyboard,
  children,
}: {
  t: Copy;
  solved: boolean;
  feedback: Feedback;
  nextLabel: string;
  nextRef?: RefObject<HTMLButtonElement | null>;
  onNext?: () => void;
  singleButton?: boolean;
  keepKeyboard?: (event: PointerEvent | MouseEvent) => void;
  children?: ReactNode;
}) {
  if (singleButton)
    return (
      <div className="answer-actions">
        <button
          type="submit"
          className="primary answer-button"
          data-state={solved ? 'correct' : feedback === 'incorrect' ? 'incorrect' : 'neutral'}
          onPointerDown={keepKeyboard}
          onMouseDown={keepKeyboard}
        >
          {solved ? (
            <>
              {nextLabel}
              <span aria-hidden="true"> →</span>
            </>
          ) : (
            t.check
          )}
        </button>
        {children}
      </div>
    );
  return (
    <div className="answer-actions">
      {solved ? (
        // No repeat-click guard here today (SCRUM-347), unlike the game screens.
        <NextButton label={nextLabel} nextRef={nextRef} onNext={onNext} guard={false} />
      ) : (
        <button
          type="submit"
          className="primary answer-button"
          data-state={feedback === 'incorrect' ? 'incorrect' : 'neutral'}
        >
          {t.check}
        </button>
      )}
      {children}
    </div>
  );
}
