// SCRUM-245: one word search lesson as plain state (no React): the grids, the words found in
// the grid on screen, the first tapped letter, the first-try score. The App turns it into a
// `Session` shape for the shared bar, bear, leave question and summary (asSession).
import type { Session } from '../session';
import { checkSelection, sameCell, type Cell, type Puzzle, type SearchLevel } from './grid';

/** What the last action did (the view reacts once per `seq`). */
export type SearchEvent =
  | { kind: 'found'; word: number; seq: number }
  | { kind: 'wrong'; cells: readonly Cell[]; seq: number };

export type SearchLesson = Readonly<{
  level: SearchLevel;
  puzzles: readonly Puzzle[];
  /** The grid on screen. */
  index: number;
  /** Words (indexes in the grid's list) found in the grid on screen, in the order found. */
  found: readonly number[];
  /** The first tapped letter, waiting for the last one. */
  selected: Cell | null;
  /** Words found with no wrong try since the previous found word (or the grid's start). */
  firstTry: number;
  foundTotal: number;
  /** Wrong tries in the whole lesson. */
  wrongTries: number;
  /** No wrong try since the previous found word (or the grid's start). */
  clean: boolean;
  event: SearchEvent | null;
  done: boolean;
}>;

export function createSearchLesson(level: SearchLevel, puzzles: readonly Puzzle[]): SearchLesson {
  return {
    level,
    puzzles,
    index: 0,
    found: [],
    selected: null,
    firstTry: 0,
    foundTotal: 0,
    wrongTries: 0,
    clean: true,
    event: null,
    done: false,
  };
}

export const currentPuzzle = (lesson: SearchLesson) => lesson.puzzles[lesson.index];
export const lessonWords = (lesson: SearchLesson) =>
  lesson.puzzles.reduce((n, puzzle) => n + puzzle.words.length, 0);

/** Every word of the grid on screen is found: Next (or Finish) shows. */
export const puzzleSolved = (lesson: SearchLesson) =>
  lesson.found.length === currentPuzzle(lesson).words.length;

const seqOf = (lesson: SearchLesson) => (lesson.event?.seq ?? 0) + 1;

/** A word is found (by its first/last letter, or spelled letter by letter). */
export function findWord(lesson: SearchLesson, word: number): SearchLesson {
  if (lesson.done || lesson.found.includes(word) || !currentPuzzle(lesson).words[word])
    return lesson;
  return {
    ...lesson,
    found: [...lesson.found, word],
    selected: null,
    foundTotal: lesson.foundTotal + 1,
    firstTry: lesson.firstTry + (lesson.clean ? 1 : 0),
    clean: true,
    event: { kind: 'found', word, seq: seqOf(lesson) },
  };
}

/** A wrong try: the word found next earns no first-try point. */
export function wrongTry(lesson: SearchLesson, cells: readonly Cell[] = []): SearchLesson {
  if (lesson.done || puzzleSolved(lesson)) return lesson;
  return {
    ...lesson,
    selected: null,
    clean: false,
    wrongTries: lesson.wrongTries + 1,
    event: { kind: 'wrong', cells, seq: seqOf(lesson) },
  };
}

/**
 * A tap on a letter. The first tap marks it (a second tap on it cancels); the next tap on
 * another letter checks the pair: a word not found yet is found, the ends of a word already
 * found only clear the mark (not wrong), anything else is a wrong try.
 */
export function tapCell(lesson: SearchLesson, cell: Cell): SearchLesson {
  if (lesson.done || puzzleSolved(lesson)) return lesson;
  const { selected } = lesson;
  if (!selected) return { ...lesson, selected: cell };
  if (sameCell(selected, cell)) return { ...lesson, selected: null };
  const word = checkSelection(currentPuzzle(lesson), selected, cell);
  if (word === null) return wrongTry(lesson, [selected, cell]);
  if (lesson.found.includes(word)) return { ...lesson, selected: null };
  return findWord(lesson, word);
}

/** After a solved grid: the next grid, or the end of the lesson after the last one. */
export function nextPuzzle(lesson: SearchLesson): SearchLesson {
  if (lesson.done || !puzzleSolved(lesson)) return lesson;
  if (lesson.index === lesson.puzzles.length - 1) return { ...lesson, done: true, selected: null };
  return {
    ...lesson,
    index: lesson.index + 1,
    found: [],
    selected: null,
    clean: true,
    event: null,
  };
}

/**
 * The lesson in the shared `Session` shape (progress bar, bear, leave question, summary and
 * points): one "exercise" per word; `index` = words found; `attempts` counts every pair checked
 * (it re-keys the bear's reaction). No review round. Feedback is `correct` right after a found
 * word (happy bear); a wrong pair keeps the bear calm (only a soft flash, scope 3).
 */
export function asSession(lesson: SearchLesson): Session<string> {
  const words = lesson.puzzles.flatMap((puzzle) => puzzle.words.map((w) => w.word));
  return {
    exercises: words,
    index: lesson.foundTotal,
    firstTry: lesson.firstTry,
    attempts: lesson.foundTotal + lesson.wrongTries,
    solved: false,
    done: lesson.done,
    feedback: lesson.event?.kind === 'found' && !lesson.done ? 'correct' : 'ready',
    hintStage: 0,
    reviewing: false,
    reviewQueue: [],
  };
}
