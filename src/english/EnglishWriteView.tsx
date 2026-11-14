import type { RefObject } from 'react';
import type { Copy } from '../i18n';
import type { Feedback } from '../session';
import { SpeakerIcon } from './EnglishPracticeView';
import type { KeyboardViewport } from './useKeyboardViewport';
import type { WriteQuestion } from './write';

/**
 * Listen-and-write exercise (English level 3): the sound only, one text input for the system
 * keyboard and Check (Enter also checks). After a wrong try the word is shown and announced and
 * the child writes it once to continue. With an on-screen keyboard open the speaker, input and
 * Check move into the visible part of the screen.
 */
export default function EnglishWriteView({
  t,
  question,
  position,
  reviewing,
  solved,
  feedback,
  attempts,
  prompt,
  answer,
  playing,
  playFailed,
  nextLabel,
  keyboard,
  speakerRef,
  inputRef,
  onAnswerChange,
  onReplay,
  onRetryPlay,
  onCheck,
  onNext,
}: {
  t: Copy;
  question: WriteQuestion;
  position: string;
  reviewing: boolean;
  solved: boolean;
  feedback: Feedback;
  attempts: number;
  /** Gentle prompt after Check with nothing or non-letters written (not a try). */
  prompt: 'empty' | 'letters' | null;
  answer: string;
  playing: boolean;
  playFailed: boolean;
  nextLabel: string;
  keyboard: KeyboardViewport;
  speakerRef: RefObject<HTMLButtonElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  onAnswerChange: (value: string) => void;
  onReplay: () => void;
  onRetryPlay: () => void;
  onCheck: () => void;
  onNext: () => void;
}) {
  // The word is shown only after a wrong try in this question (and stays until it is solved).
  const shown = attempts > 0 ? question.target : null;
  // The English word inside a Slovak sentence is marked lang="en" for screen readers.
  const [before, after] = t.writeWrong.split('{word}');
  const status =
    prompt === 'empty' ? (
      t.writeEmpty
    ) : prompt === 'letters' ? (
      t.writeLetters
    ) : feedback === 'incorrect' ? (
      <>
        {before}
        <span lang="en">{question.target}</span>
        {after}
      </>
    ) : feedback === 'correct' ? (
      t.correct
    ) : (
      ''
    );
  // Buttons used while typing must not take focus from the input (that closes the keyboard).
  const keepKeyboard = (event: React.PointerEvent | React.MouseEvent) => {
    if (document.activeElement === inputRef.current) event.preventDefault();
  };
  return (
    <section
      className="practice english-practice write-practice"
      // Very short visible area (phone landscape with keyboard): everything on one row.
      data-keyboard={keyboard.open ? (keyboard.height < 240 ? 'short' : 'open') : undefined}
      style={
        keyboard.open
          ? ({
              '--kb-height': `${keyboard.height}px`,
              '--kb-top': `${keyboard.top}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="practice-header">
        <div className="practice-top">
          <span className="level-pill">
            {t.level} {question.level}
          </span>
        </div>
        <p className="exercise-position" aria-live="polite">
          {position}
        </p>
      </div>
      <h2 id="write-title">{reviewing ? t.writeReviewTitle : t.writeTitle}</h2>
      <form
        noValidate
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          if (solved) onNext();
          else onCheck();
        }}
      >
        <button
          ref={speakerRef}
          type="button"
          className="speaker-button"
          data-playing={playing}
          aria-label={t.playWord}
          onPointerDown={keepKeyboard}
          onMouseDown={keepKeyboard}
          onClick={onReplay}
        >
          <SpeakerIcon />
        </button>
        <p className="write-shown" aria-hidden={shown ? undefined : 'true'}>
          {shown && (
            <>
              <span className="write-shown-label">{t.writeShown}</span>{' '}
              <strong lang="en">{shown}</strong>
            </>
          )}
        </p>
        <input
          ref={inputRef}
          className="write-input"
          type="text"
          lang="en"
          name="bearmatics-word"
          aria-labelledby="write-title"
          aria-describedby="answer-feedback"
          aria-invalid={feedback === 'incorrect' || undefined}
          value={answer}
          inputMode="text"
          // 'enter' rather than 'done': the keyboard should stay open between words.
          enterKeyHint="enter"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          data-gramm="false"
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          data-state={solved ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined}
          onChange={(event) => onAnswerChange(event.target.value)}
        />
        {/* A playback failure uses the feedback line's space (QA87-01): no extra row. */}
        {playFailed ? (
          <p className="feedback play-error" role="alert">
            {t.wordFailed}{' '}
            <button
              type="button"
              className="text-button"
              onPointerDown={keepKeyboard}
              onMouseDown={keepKeyboard}
              onClick={onRetryPlay}
            >
              {t.tryAgain}
            </button>
          </p>
        ) : (
          <p
            id="answer-feedback"
            className={`feedback feedback-${prompt ? 'invalid' : feedback}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {status}
          </p>
        )}
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
        </div>
      </form>
    </section>
  );
}
