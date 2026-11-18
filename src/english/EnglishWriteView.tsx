import type { RefObject } from 'react';
import type { Copy } from '../i18n';
import AnswerActions from '../lesson/AnswerActions';
import FeedbackLine from '../lesson/FeedbackLine';
import PracticeHeader from '../lesson/PracticeHeader';
import type { Feedback } from '../session';
import SpeakerButton from './SpeakerButton';
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
  wrongAnswer,
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
  /** The last wrong answer in this question, shown so the child can see the mistake. */
  wrongAnswer: string | null;
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
  // After a wrong try the child sees what they wrote (Peter): it stays while they copy the word.
  // Screen readers also hear the correct word (the visible label above is not a live region).
  // English words inside a Slovak sentence are marked lang="en".
  const [wroteBefore, wroteAfter] = t.writeWrong.split('{answer}');
  const [hintBefore, hintAfter] = t.writeWrongHint.split('{word}');
  const status =
    prompt === 'empty' ? (
      t.writeEmpty
    ) : prompt === 'letters' ? (
      t.writeLetters
    ) : wrongAnswer !== null && !solved ? (
      <>
        {wroteBefore}
        <span className="write-wrong" lang="en">
          {wrongAnswer}
        </span>
        {wroteAfter}
        {feedback === 'incorrect' && (
          <span className="visually-hidden">
            {' '}
            {hintBefore}
            <span lang="en">{question.target}</span>
            {hintAfter}
          </span>
        )}
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
      <PracticeHeader t={t} level={question.level} position={position} />
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
        <SpeakerButton
          t={t}
          speakerRef={speakerRef}
          playing={playing}
          onReplay={onReplay}
          keepKeyboard={keepKeyboard}
        />
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
        <FeedbackLine
          kind={prompt ? 'invalid' : feedback}
          playError={playFailed ? { t, onRetry: onRetryPlay, keepKeyboard } : null}
        >
          {status}
        </FeedbackLine>
        <AnswerActions
          t={t}
          solved={solved}
          feedback={feedback}
          nextLabel={nextLabel}
          singleButton
          keepKeyboard={keepKeyboard}
        />
      </form>
    </section>
  );
}
