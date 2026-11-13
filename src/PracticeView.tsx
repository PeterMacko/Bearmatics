import type { FormEvent, KeyboardEvent, RefObject } from 'react';
import type { Exercise, Level } from './math/engine';
import type { Copy } from './i18n';
import PictureGroup, { type PictureTheme } from './PictureGroup';
import { OPERATOR_SYMBOLS } from './operatorSymbols';
import type { Feedback } from './session';

const PAD_KEYS = ['7', '8', '9', '0', '4', '5', '6', 'clear', '1', '2', '3', 'backspace'];

/** Practice screen: equation, answer input, number pad and answer actions. */
export default function PracticeView({
  t,
  level,
  current,
  pictureTheme,
  position,
  reviewing,
  solved,
  feedback,
  nextLabel,
  answer,
  padMode,
  touch,
  hintOpen,
  inputRef,
  nextRef,
  hintRef,
  onSubmit,
  onAnswerChange,
  onAnswerKey,
  onPadKey,
  onNext,
  onOpenHint,
  onToggleInputMode,
}: {
  t: Copy;
  level: Level;
  current: Exercise;
  pictureTheme: PictureTheme;
  position: string;
  reviewing: boolean;
  solved: boolean;
  feedback: Feedback;
  nextLabel: string;
  answer: string;
  padMode: boolean;
  touch: boolean;
  hintOpen: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  nextRef: RefObject<HTMLButtonElement | null>;
  hintRef: RefObject<HTMLButtonElement | null>;
  onSubmit: (event: FormEvent) => void;
  onAnswerChange: (value: string) => void;
  onAnswerKey: (event: KeyboardEvent<HTMLElement>) => void;
  onPadKey: (key: string) => void;
  onNext: () => void;
  onOpenHint: () => void;
  onToggleInputMode: () => void;
}) {
  const equationDescription = `${current.blank === 0 ? t.blank : current.values[0]} ${t.operators[current.operation]} ${current.blank === 1 ? t.blank : current.values[1]} ${t.equals} ${current.blank === 2 ? t.blank : current.values[2]}`;
  return (
    <section className="practice">
      <div className="practice-header">
        <div className="practice-top">
          <span className="level-pill">
            {t.level} {level}
          </span>
        </div>
        <p className="exercise-position" aria-live="polite">
          {position}
        </p>
      </div>
      <h2>{reviewing ? t.reviewTitle : t.ready}</h2>
      <form
        onSubmit={onSubmit}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            event.repeat &&
            (event.target === inputRef.current ||
              (event.target as HTMLElement).classList.contains('answer-button'))
          )
            event.preventDefault();
        }}
        noValidate
      >
        <div
          className={`equation ${current.level === 0 ? 'picture-equation' : ''}`}
          data-feedback={feedback}
          role="group"
          aria-label={equationDescription}
        >
          {current.values.map((n, i) => (
            <span className="equation-part" key={i}>
              {i === 1 && (
                <span className="operator" aria-hidden="true">
                  {OPERATOR_SYMBOLS[current.operation]}
                </span>
              )}
              {i === 2 && (
                <span className="operator" aria-hidden="true">
                  =
                </span>
              )}
              <span data-term={i}>
                {i === current.blank ? (
                  <input
                    ref={inputRef}
                    type="text"
                    onKeyDown={onAnswerKey}
                    readOnly={padMode}
                    inputMode={padMode ? 'none' : 'numeric'}
                    autoComplete="off"
                    aria-label={`${t.missing}, ${t.positions[i]}`}
                    aria-describedby={
                      padMode ? 'answer-feedback answer-instructions' : 'answer-feedback'
                    }
                    aria-invalid={feedback === 'invalid' || feedback === 'incorrect'}
                    value={answer}
                    disabled={solved}
                    onChange={(e) => onAnswerChange(e.target.value)}
                  />
                ) : (
                  <span aria-hidden="true">{n}</span>
                )}
              </span>
              {current.level === 0 && (
                <PictureGroup
                  count={i === 2 && !solved ? null : n}
                  theme={pictureTheme}
                  label={
                    i === 2 && !solved
                      ? ''
                      : `${t.picturePositions[i]}: ${t.pictureThemes[pictureTheme]}. ${t.pictureCount}: ${n}.${n === 0 ? ` ${t.emptyGroup}.` : ''}`
                  }
                  emptyLabel={t.emptyGroup}
                  unknownLabel={t.unknown}
                />
              )}
            </span>
          ))}
        </div>
        <p
          id="answer-feedback"
          className={`feedback feedback-${feedback}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {feedback === 'ready' ? '' : t[feedback]}
        </p>
        <span id="answer-instructions" className="sr-only">
          {t.padInstructions}
        </span>
        <span
          className="sr-only"
          data-testid="answer-announcement"
          aria-live="polite"
          aria-atomic="true"
        >
          {padMode ? `${t.answerLabel}: ${answer || t.emptyAnswer}` : ''}
        </span>
        {padMode && (
          <div className="number-pad" onKeyDown={onAnswerKey} role="group" aria-label={t.numberPad}>
            {PAD_KEYS.map((key) => (
              <button
                key={key}
                className={key === 'clear' ? 'pad-clear' : undefined}
                type="button"
                disabled={solved}
                aria-label={
                  key === 'clear' ? t.clearAnswer : key === 'backspace' ? t.backspace : key
                }
                onClick={() => onPadKey(key)}
              >
                {key === 'clear' ? t.clear : key === 'backspace' ? '⌫' : key}
              </button>
            ))}
          </div>
        )}
        <div className="answer-actions">
          {solved ? (
            <button
              ref={nextRef}
              type="button"
              className="primary answer-button"
              data-state="correct"
              onClick={(event) => {
                event.preventDefault();
                onNext();
              }}
            >
              {nextLabel}
              <span aria-hidden="true"> →</span>
            </button>
          ) : (
            <button
              type="submit"
              className="primary answer-button"
              data-state={feedback === 'incorrect' ? 'incorrect' : 'neutral'}
            >
              {t.check}
            </button>
          )}
          <button
            ref={hintRef}
            type="button"
            className="hint-button"
            aria-label={t.showHint}
            title={t.showHint}
            aria-haspopup="dialog"
            aria-controls={hintOpen ? 'hint-dialog' : undefined}
            aria-expanded={hintOpen}
            disabled={solved}
            onClick={onOpenHint}
          >
            <span aria-hidden="true">i</span>
          </button>
        </div>
        {!touch && (
          <div className="practice-tools">
            <button
              type="button"
              className="input-mode-button"
              disabled={solved}
              onClick={onToggleInputMode}
            >
              {padMode ? t.useNative : t.usePad}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
