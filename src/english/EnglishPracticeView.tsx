import type { RefObject } from 'react';
import type { Copy } from '../i18n';
import type { Feedback } from '../session';
import type { WordQuestion } from './listen';

/** Animated speaker: replays the word. Its label never contains the word itself. */
function SpeakerIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M12 24h10l14-11v38L22 40H12z" fill="currentColor" />
      <path className="speaker-wave wave-one" d="M43 24a11 11 0 0 1 0 16" />
      <path className="speaker-wave wave-two" d="M48 18a19 19 0 0 1 0 28" />
      <path className="speaker-wave wave-three" d="M53 12a27 27 0 0 1 0 40" />
    </svg>
  );
}

/**
 * Listen-and-choose exercise: a large speaker that (re)plays the word, four word buttons
 * (one selectable at a time, each says its word) and Check. Feedback, Next, review and
 * scoring follow the maths session rules.
 */
export default function EnglishPracticeView({
  t,
  question,
  position,
  reviewing,
  solved,
  feedback,
  choice,
  playing,
  playFailed,
  nextLabel,
  speakerRef,
  nextRef,
  onReplay,
  onRetryPlay,
  onChoose,
  onCheck,
  onNext,
}: {
  t: Copy;
  question: WordQuestion;
  position: string;
  reviewing: boolean;
  solved: boolean;
  feedback: Feedback;
  choice: string;
  /** 'speaker' or the word whose button started the sound; null when silent. */
  playing: string | null;
  playFailed: boolean;
  nextLabel: string;
  speakerRef: RefObject<HTMLButtonElement | null>;
  nextRef: RefObject<HTMLButtonElement | null>;
  onReplay: () => void;
  onRetryPlay: () => void;
  onChoose: (word: string) => void;
  onCheck: () => void;
  onNext: () => void;
}) {
  const speaking = playing === 'speaker';
  return (
    <section className="practice english-practice">
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
      <h2>{reviewing ? t.englishReviewTitle : t.englishListen}</h2>
      <form
        noValidate
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
          data-playing={speaking}
          aria-label={t.playWord}
          onClick={onReplay}
        >
          <SpeakerIcon />
        </button>
        {playFailed && (
          <p className="word-error" role="alert">
            {t.wordFailed}{' '}
            <button type="button" className="text-button" onClick={onRetryPlay}>
              {t.tryAgain}
            </button>
          </p>
        )}
        <div className="word-options" role="group" aria-label={t.englishWords}>
          {question.options.map((word) => {
            const selected = choice === word;
            const state = solved && word === question.target ? 'correct' : selected ? feedback : '';
            return (
              <button
                key={word}
                type="button"
                className="word-option"
                aria-pressed={selected}
                data-state={state || undefined}
                data-playing={playing === word}
                disabled={solved}
                onClick={() => onChoose(word)}
              >
                {word}
              </button>
            );
          })}
        </div>
        <p
          id="answer-feedback"
          className={`feedback feedback-${feedback}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {feedback === 'ready' ? '' : feedback === 'invalid' ? t.chooseFirst : t[feedback]}
        </p>
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
        </div>
      </form>
    </section>
  );
}
