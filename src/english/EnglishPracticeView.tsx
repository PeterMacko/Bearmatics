import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Copy } from '../i18n';
import type { Feedback } from '../session';
import type { WordQuestion } from './listen';

/** Animated speaker: replays the word. Its label never contains the word itself. */
export function SpeakerIcon() {
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
 * Sizes the square word buttons to the space the screen really has: start at the largest size,
 * then shrink by however much the page overflows (one row of 4 shrinks 4x slower in height).
 * The word font follows the square so the longest word stays on one line.
 * CSS keeps a size for the first paint and for environments without layout.
 */
export function useWordGrid(key: unknown) {
  const grid = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el || typeof window === 'undefined') return;
    const fit = () => {
      const style = getComputedStyle(el);
      const cols = style.gridTemplateColumns.split(' ').filter(Boolean).length || 2;
      const gap = parseFloat(style.columnGap) || 10;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // Phones (compact layout) up to 340 px; tablets and desktops may use up to 440 px.
      const compact = el.closest('.compact-practice') !== null;
      const max = cols === 4 ? 560 : compact ? 340 : 440;
      const min = cols === 4 ? 4 * 6.5 * rem + 3 * gap : 2 * 6.5 * rem + gap;
      el.style.width = `${max}px`;
      el.style.minWidth = '0';
      const form = el.closest('form');
      // Page coordinates (add scrollY) so a scrolled page (200% text) is measured correctly.
      const bottoms = [el, ...(form ? Array.from(form.children) : [])].map(
        (child) => child.getBoundingClientRect().bottom + window.scrollY,
      );
      // clientHeight is the layout viewport; innerHeight can grow while mobile browsers zoom out.
      const viewport = document.documentElement.clientHeight || window.innerHeight;
      const overflow = Math.max(
        document.documentElement.scrollHeight - viewport,
        Math.max(...bottoms) + 8 - viewport,
        0,
      );
      let width = Math.min(max, el.getBoundingClientRect().width);
      width -= overflow * (cols === 4 ? 4 : 1);
      width = Math.floor(Math.max(Math.min(min, el.parentElement?.clientWidth ?? min), width));
      el.style.width = `${width}px`;
      // Check and the word block share one width on phones.
      form?.style.setProperty('--word-block', `${width}px`);
      const square = (width - (cols - 1) * gap) / cols;
      // First guess from the square, then measure the widest of the four words on one line
      // and shrink the font until it fits the button's inner width. Never below 1rem, so
      // enlarged text still grows (very long words may then wrap at 200% text).
      let font = Math.max(rem, Math.min(1.75 * rem, square / 6));
      el.style.setProperty('--word-font', `${font}px`);
      const buttons = Array.from(el.querySelectorAll<HTMLElement>('.word-option'));
      if (buttons.length) {
        const button = getComputedStyle(buttons[0]);
        const inner =
          buttons[0].clientWidth - parseFloat(button.paddingLeft) - parseFloat(button.paddingRight);
        const widest = Math.max(
          ...buttons.map((b) => {
            const range = document.createRange();
            range.selectNodeContents(b);
            if (typeof range.getClientRects !== 'function') return 0; // no layout (tests)
            // Width of the text if it were on one line: sum of its line boxes.
            return Array.from(range.getClientRects()).reduce((sum, r) => sum + r.width, 0);
          }),
        );
        if (widest > inner - 2 && widest > 0) {
          font = Math.max(rem, Math.floor(font * ((inner - 2) / widest) * 10) / 10);
          el.style.setProperty('--word-font', `${font}px`);
        }
      }
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    // Refit when anything around the grid changes size (bear, header, fonts, rotation).
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    const section = el.closest('section');
    if (observer && section?.parentElement) observer.observe(section.parentElement);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [key]);
  return grid;
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
  const gridRef = useWordGrid(question);
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
