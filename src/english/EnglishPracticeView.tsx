import type { RefObject } from 'react';
import type { Copy } from '../i18n';
import AnswerActions from '../lesson/AnswerActions';
import FeedbackLine from '../lesson/FeedbackLine';
import PracticeHeader from '../lesson/PracticeHeader';
import type { Feedback } from '../session';
import type { WordQuestion } from './listen';
import SpeakerButton from './SpeakerButton';
import useWordGrid from './useWordGrid';

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
  const gridRef = useWordGrid(question);
  return (
    <section className="practice english-practice">
      <PracticeHeader t={t} level={question.level} position={position} />
      <h2>{reviewing ? t.englishReviewTitle : t.englishListen}</h2>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (solved) onNext();
          else onCheck();
        }}
      >
        <SpeakerButton t={t} speakerRef={speakerRef} playing={speaking} onReplay={onReplay} />
        <div ref={gridRef} className="word-options" role="group" aria-label={t.englishWords}>
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
        <FeedbackLine kind={feedback} playError={playFailed ? { t, onRetry: onRetryPlay } : null}>
          {feedback === 'ready' ? '' : feedback === 'invalid' ? t.chooseFirst : t[feedback]}
        </FeedbackLine>
        <AnswerActions
          t={t}
          solved={solved}
          feedback={feedback}
          nextLabel={nextLabel}
          nextRef={nextRef}
          onNext={onNext}
        />
      </form>
    </section>
  );
}
