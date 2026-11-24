import { describe, expect, test } from 'vitest';
import { hasProgress, progressValue } from '../session';
import { seeded } from '../testing/seeded';
import { generateSearchLesson, type Cell, type Puzzle } from './grid';
import {
  asSession,
  createSearchLesson,
  currentPuzzle,
  findWord,
  lessonWords,
  nextPuzzle,
  puzzleSolved,
  tapCell,
  wrongTry,
  type SearchLesson,
} from './lesson';

const ends = (puzzle: Puzzle, word: number): [Cell, Cell] => {
  const { cells } = puzzle.words[word];
  return [cells[0], cells[cells.length - 1]];
};
/** A cell pair that is no word's ends (the first cell of word 0 and a cell beside it). */
function wrongPair(puzzle: Puzzle): [Cell, Cell] {
  for (let a = 0; a < 36; a++)
    for (let b = 0; b < 36; b++) {
      if (a === b) continue;
      const first = { row: Math.floor(a / 6), col: a % 6 };
      const last = { row: Math.floor(b / 6), col: b % 6 };
      const isWord = puzzle.words.some(({ cells }) => {
        const [x, y] = [cells[0], cells[cells.length - 1]];
        const same = (p: Cell, q: Cell) => p.row === q.row && p.col === q.col;
        return (same(x, first) && same(y, last)) || (same(x, last) && same(y, first));
      });
      if (!isWord) return [first, last];
    }
  throw new Error('no wrong pair');
}
const tapPair = (lesson: SearchLesson, [a, b]: [Cell, Cell]) => tapCell(tapCell(lesson, a), b);
const findAll = (lesson: SearchLesson) => {
  let next = lesson;
  currentPuzzle(lesson).words.forEach((_, i) => {
    next = tapPair(next, ends(currentPuzzle(next), i));
  });
  return next;
};

const make = (size = 10, level: 1 | 2 | 3 = 1) =>
  createSearchLesson(level, generateSearchLesson(level, size, seeded(size + level)));

describe('word search lesson', () => {
  test('first tap marks a cell, a second tap on it cancels, a new first tap marks again', () => {
    const lesson = make();
    const [a] = ends(currentPuzzle(lesson), 0);
    const marked = tapCell(lesson, a);
    expect(marked.selected).toEqual(a);
    expect(tapCell(marked, a).selected).toBeNull();
    expect(tapCell(marked, a).wrongTries).toBe(0);
  });

  test('first then last letter (either order) finds the word; first try counts', () => {
    const lesson = make();
    const puzzle = currentPuzzle(lesson);
    const [a, b] = ends(puzzle, 2);
    const found = tapPair(lesson, [b, a]);
    expect(found.found).toEqual([2]);
    expect(found.firstTry).toBe(1);
    expect(found.foundTotal).toBe(1);
    expect(found.selected).toBeNull();
    expect(found.event).toEqual({ kind: 'found', word: 2, seq: 1 });
  });

  test('a wrong pair clears the mark, counts as a wrong try and costs the next word its point', () => {
    const lesson = make();
    const puzzle = currentPuzzle(lesson);
    const wrong = tapPair(lesson, wrongPair(puzzle));
    expect(wrong.selected).toBeNull();
    expect(wrong.wrongTries).toBe(1);
    expect(wrong.event?.kind).toBe('wrong');
    expect(wrong.event?.kind === 'wrong' && wrong.event.cells).toEqual(wrongPair(puzzle));
    const late = tapPair(wrong, ends(puzzle, 0));
    expect(late.found).toEqual([0]);
    expect(late.firstTry).toBe(0);
    // The word after it is clean again: its point counts.
    const next = tapPair(late, ends(puzzle, 1));
    expect(next.firstTry).toBe(1);
  });

  test('two wrong pairs in a row still cost only the next word', () => {
    const lesson = make();
    const puzzle = currentPuzzle(lesson);
    let state = tapPair(tapPair(lesson, wrongPair(puzzle)), wrongPair(puzzle));
    state = tapPair(state, ends(puzzle, 0));
    state = tapPair(state, ends(puzzle, 1));
    expect(state.wrongTries).toBe(2);
    expect(state.firstTry).toBe(1);
  });

  test('the ends of a word already found only clear the mark (not wrong, no new event)', () => {
    const lesson = make();
    const puzzle = currentPuzzle(lesson);
    const found = tapPair(lesson, ends(puzzle, 0));
    const again = tapPair(found, ends(puzzle, 0));
    expect(again.selected).toBeNull();
    expect(again.wrongTries).toBe(0);
    expect(again.found).toEqual([0]);
    expect(again.event).toEqual(found.event);
    expect(again.clean).toBe(true);
  });

  test('crossing words: a shared letter can be an end of both words', () => {
    // Find a seeded grid where one word's end cell is a cell of another word.
    for (let seed = 1; seed < 500; seed++) {
      const lesson = createSearchLesson(3, generateSearchLesson(3, 5, seeded(seed)));
      const puzzle = currentPuzzle(lesson);
      const shared = puzzle.words.findIndex((w, i) =>
        puzzle.words.some(
          (other, j) =>
            j !== i &&
            other.cells.some(
              (c) =>
                (c.row === w.cells[0].row && c.col === w.cells[0].col) ||
                (c.row === w.cells.at(-1)!.row && c.col === w.cells.at(-1)!.col),
            ),
        ),
      );
      if (shared === -1) continue;
      const done = findAll(lesson);
      expect(done.found).toHaveLength(5);
      expect(done.firstTry).toBe(5);
      return;
    }
    throw new Error('no crossing grid found');
  });

  test('a solved grid ignores taps; Next goes to the next grid, the last one ends the lesson', () => {
    const lesson = make(10);
    expect(lessonWords(lesson)).toBe(10);
    expect(nextPuzzle(lesson)).toBe(lesson); // not solved yet
    const first = findAll(lesson);
    expect(puzzleSolved(first)).toBe(true);
    expect(tapCell(first, { row: 0, col: 0 })).toBe(first);
    expect(wrongTry(first)).toBe(first);
    const second = nextPuzzle(first);
    expect(second.index).toBe(1);
    expect(second.found).toEqual([]);
    expect(second.clean).toBe(true);
    expect(second.done).toBe(false);
    const end = nextPuzzle(findAll(second));
    expect(end.done).toBe(true);
    expect(end.firstTry).toBe(10);
    expect(tapCell(end, { row: 0, col: 0 })).toBe(end);
  });

  test('findWord (letters in order) finds once; wrongTry costs the point like a wrong pair', () => {
    const lesson = make();
    const once = findWord(lesson, 3);
    expect(findWord(once, 3)).toBe(once);
    expect(once.firstTry).toBe(1);
    const missed = findWord(wrongTry(lesson), 3);
    expect(missed.firstTry).toBe(0);
  });

  test('as a Session: words as exercises, progress = words found, no review, leave question', () => {
    const lesson = make(20, 3);
    const start = asSession(lesson);
    expect(start.exercises).toHaveLength(20);
    expect(progressValue(start)).toBe(0);
    expect(hasProgress(start, '')).toBe(false);
    expect(hasProgress(asSession(tapPair(lesson, wrongPair(currentPuzzle(lesson)))), '')).toBe(
      true,
    );
    const one = tapPair(lesson, ends(currentPuzzle(lesson), 0));
    expect(progressValue(asSession(one))).toBe(1);
    expect(asSession(one).feedback).toBe('correct');
    expect(asSession(wrongTry(one)).feedback).toBe('ready');
    let state = lesson;
    for (let i = 0; i < 4; i++) state = nextPuzzle(findAll(state));
    const done = asSession(state);
    expect(done.done).toBe(true);
    expect(done.firstTry).toBe(20);
    expect(done.reviewing).toBe(false);
    expect(done.reviewQueue).toEqual([]);
  });
});
