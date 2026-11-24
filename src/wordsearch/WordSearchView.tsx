import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import { fill, type Copy } from '../i18n';
import { ignoreRepeatClick } from '../ignoreRepeatClick';
import FeedbackLine from '../lesson/FeedbackLine';
import PracticeHeader from '../lesson/PracticeHeader';
import SpeakerIcon from '../english/SpeakerIcon';
import { GRID, gridLetters, sameCell, type Cell } from './grid';
import { currentPuzzle, puzzleSolved, type SearchLesson } from './lesson';
import useSearchFit from './useSearchFit';

/** How long a wrong pair flashes before it clears (scope 3: a soft flash). */
export const FLASH_MS = 650;

const CELLS: readonly Cell[] = Array.from({ length: GRID * GRID }, (_, i) => ({
  row: Math.floor(i / GRID),
  col: i % GRID,
}));
const KEY_STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The letter buttons of the "letters in order" mode: the word's letters and two others. */
function letterChoices(word: string): string[] {
  const letters = [...new Set(gridLetters(word))];
  const others = [...ALPHABET].filter((letter) => !letters.includes(letter));
  for (let i = 0; i < 2; i++)
    letters.push(others.splice(Math.floor(Math.random() * others.length), 1)[0]);
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters;
}

/**
 * Word search lesson (SCRUM-241): the 6 x 6 letter grid and, below it, the words (levels 1 and
 * 3) or one speaker per word (level 2, the word appears struck through once found). Tap the
 * first letter, then the last letter of a word. The parent owns the lesson state and the sounds;
 * this view owns the keyboard focus in the grid, the wrong-pair flash and the screen-reader
 * alternative "choose the letters in order". Mount it with a new `key` per grid.
 */
export default function WordSearchView({
  t,
  lesson,
  position,
  playing,
  playFailed,
  nextLabel,
  nextRef,
  onTap,
  onPlay,
  onFoundByLetters,
  onWrongLetter,
  onRetryPlay,
  onNext,
}: {
  t: Copy;
  lesson: SearchLesson;
  position: string;
  /** The control whose sound is playing (`word-<i>`, `letters`), or null. */
  playing: string | null;
  playFailed: boolean;
  nextLabel: string;
  nextRef: RefObject<HTMLButtonElement | null>;
  onTap: (cell: Cell) => void;
  /** Play word `index` of the grid; `source` names the control (for its playing highlight). */
  onPlay: (index: number, source: string) => void;
  onFoundByLetters: (index: number) => void;
  onWrongLetter: () => void;
  onRetryPlay: () => void;
  onNext: () => void;
}) {
  const puzzle = currentPuzzle(lesson);
  const { level, found, selected, event } = lesson;
  const solved = puzzleSolved(lesson);
  const [focusCell, setFocusCell] = useState<Cell>({ row: 0, col: 0 });
  const [flash, setFlash] = useState<readonly Cell[]>([]);
  const [lettersMode, setLettersMode] = useState(false);
  const [chosen, setChosen] = useState('');
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sectionRef = useSearchFit(lesson.index, found.length, lettersMode, solved, playFailed);

  // A wrong pair flashes softly, then clears (the selection is already cleared).
  const wrongSeq = event?.kind === 'wrong' ? event.seq : 0;
  useEffect(() => {
    if (!wrongSeq || event?.kind !== 'wrong') return;
    setFlash(event.cells);
    const timer = window.setTimeout(() => setFlash([]), FLASH_MS);
    return () => window.clearTimeout(timer);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per wrong try
  }, [wrongSeq]);

  // The first grid of a lesson and each new grid: focus the grid (its roving cell); solved: Next.
  useEffect(() => {
    if (solved) nextRef.current?.focus({ preventScroll: true });
    else if (!lettersMode) cellRefs.current[0]?.focus({ preventScroll: true });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- on mount and when solved only
  }, [solved]);

  // Letters mode: the next word to spell is the first one not found yet.
  const target = puzzle.words.findIndex((_, i) => !found.includes(i));
  const targetWord = target === -1 ? '' : puzzle.words[target].word;
  const choices = useMemo(() => (targetWord ? letterChoices(targetWord) : []), [targetWord]);
  useEffect(() => setChosen(''), [targetWord]);

  /** Colour of a cell: the most recently found word lying on it. */
  const cellWord = (cell: Cell) => {
    for (let i = found.length - 1; i >= 0; i--)
      if (puzzle.words[found[i]].cells.some((c) => sameCell(c, cell))) return found[i];
    return -1;
  };

  const tap = (cell: Cell, e: MouseEvent) => {
    // The second click of a double tap on the marked letter would cancel it: ignore it. A quick
    // tap on a different letter is a real second tap and goes through.
    if (e.detail > 1 && selected && sameCell(selected, cell)) return;
    setFocusCell(cell);
    onTap(cell);
  };
  const moveFocus = (e: KeyboardEvent) => {
    const step = KEY_STEPS[e.key];
    if (!step) return;
    e.preventDefault();
    const row = Math.min(GRID - 1, Math.max(0, focusCell.row + step[0]));
    const col = Math.min(GRID - 1, Math.max(0, focusCell.col + step[1]));
    setFocusCell({ row, col });
    cellRefs.current[row * GRID + col]?.focus();
  };

  const chooseLetter = (letter: string) => {
    if (target === -1 || solved) return;
    const letters = gridLetters(targetWord);
    if (letters[chosen.length] !== letter) {
      onWrongLetter();
      return;
    }
    const next = chosen + letter;
    if (next.length === letters.length) {
      setChosen('');
      onFoundByLetters(target);
    } else setChosen(next);
  };

  const lettersWrong = event?.kind === 'wrong' && event.cells.length === 0;
  const lastFound = event?.kind === 'found' ? puzzle.words[event.word]?.word : undefined;
  const message = solved
    ? t.searchAllFound
    : selected
      ? t.searchSecond
      : event?.kind === 'found' && lastFound
        ? fill(t.searchFound, { word: gridLetters(lastFound) })
        : event?.kind === 'wrong'
          ? lettersWrong
            ? t.searchLetterWrong
            : t.searchWrong
          : t.searchReady;
  const feedbackKind = solved || event?.kind === 'found' ? 'correct' : 'ready';

  return (
    <section
      ref={sectionRef}
      className="practice wordsearch-practice"
      data-level={level}
      data-solved={solved || undefined}
    >
      <PracticeHeader t={t} level={level} position={position} />
      <h2>{t.searchTitles[level]}</h2>
      <div className="ws-play">
        <div className="ws-stage">
          <div
            className="ws-board"
            role="group"
            aria-label={t.searchGrid}
            aria-describedby="ws-keys"
            onKeyDown={moveFocus}
          >
            {CELLS.map((cell, i) => {
              const letter = puzzle.rows[cell.row][cell.col];
              const word = cellWord(cell);
              const name = fill(t.searchCell, { row: cell.row + 1, col: cell.col + 1, letter });
              const isSelected = !!selected && sameCell(selected, cell);
              return (
                <button
                  key={i}
                  ref={(node) => {
                    cellRefs.current[i] = node;
                  }}
                  type="button"
                  className="ws-cell"
                  tabIndex={sameCell(cell, focusCell) ? 0 : -1}
                  aria-label={word === -1 ? name : fill(t.searchCellFound, { cell: name })}
                  aria-pressed={isSelected}
                  data-word={word === -1 ? undefined : word}
                  data-flash={flash.some((c) => sameCell(c, cell)) || undefined}
                  onClick={(e) => tap(cell, e)}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
        <div className="ws-side">
          {level === 2 ? (
            <ul className="ws-words ws-speakers" aria-label={t.searchWordList}>
              {puzzle.words.map(({ word }, i) => {
                const isFound = found.includes(i);
                return (
                  <li key={word} data-found={isFound || undefined} data-word={i}>
                    <button
                      type="button"
                      className="ws-speaker"
                      data-playing={playing === `word-${i}` || undefined}
                      aria-label={
                        isFound
                          ? fill(t.searchSpeakerFound, { n: i + 1, word: gridLetters(word) })
                          : fill(t.searchSpeaker, { n: i + 1 })
                      }
                      onClick={() => onPlay(i, `word-${i}`)}
                    >
                      <SpeakerIcon />
                    </button>
                    {isFound && (
                      <s className="ws-revealed" aria-hidden="true">
                        {gridLetters(word)}
                      </s>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="ws-words" aria-label={t.searchWordList}>
              {puzzle.words.map(({ word }, i) => {
                const isFound = found.includes(i);
                return (
                  <li key={word} data-found={isFound || undefined} data-word={i}>
                    <button
                      type="button"
                      className="ws-word"
                      data-playing={playing === `word-${i}` || undefined}
                      aria-label={
                        isFound ? fill(t.searchWordFound, { word: gridLetters(word) }) : undefined
                      }
                      onClick={() => onPlay(i, `word-${i}`)}
                    >
                      {isFound ? <s>{gridLetters(word)}</s> : gridLetters(word)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            className="ws-letters-toggle"
            aria-pressed={lettersMode}
            data-on={lettersMode || undefined}
            onClick={() => setLettersMode((on) => !on)}
          >
            {t.searchLettersMode}
          </button>
          {lettersMode && target !== -1 && (
            <div className="ws-letters">
              <p className="ws-letters-word">
                {fill(t.searchLettersWord, { n: target + 1, total: puzzle.words.length })}
                {level !== 2 && <>: {gridLetters(targetWord)}</>}
              </p>
              <button
                type="button"
                className="ws-speaker"
                data-playing={playing === 'letters' || undefined}
                aria-label={t.playWord}
                onClick={() => onPlay(target, 'letters')}
              >
                <SpeakerIcon />
              </button>
              <p className="ws-letters-chosen" aria-live="polite">
                {t.searchLettersPrompt}{' '}
                {fill(t.searchLettersChosen, {
                  letters: chosen ? [...chosen].join(', ') : t.searchLettersNone,
                })}
              </p>
              <div className="ws-letter-buttons" role="group" aria-label={t.searchLetterButtons}>
                {choices.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    className="ws-letter"
                    onClick={() => chooseLetter(letter)}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          )}
          <FeedbackLine
            kind={feedbackKind}
            playError={playFailed ? { t, onRetry: onRetryPlay } : null}
          >
            {message}
          </FeedbackLine>
          {solved && (
            <div className="answer-actions ws-actions">
              <button
                ref={nextRef}
                type="button"
                className="primary answer-button"
                data-state="correct"
                onClick={(e: MouseEvent) => {
                  if (!ignoreRepeatClick(e)) onNext();
                }}
              >
                {nextLabel}
                <span aria-hidden="true"> →</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <p id="ws-keys" className="sr-only">
        {t.searchKeys}
      </p>
    </section>
  );
}
