// SCRUM-241/244: Word search (Osemsmerovka) with the English school words. A 6 x 6 grid of
// capital letters hides 5 words; a lesson of 5, 10 or 20 words is 1, 2 or 4 grids. Levels 1-2
// place words only left to right and top to bottom, level 3 in all 8 directions. Every grid is
// new (random placement with retries, random filler letters) and checked: each of its words
// appears exactly once reading in any of the 8 directions, no other list word appears, and no
// rude word (the shared SK/EN nickname filter) can be read in any direction.
import { pickOne, shuffled } from '../../shared/random';
import { isRudeNickname } from '../../shared/rules';
import { sameCell, type Cell } from '../cell';
import { WORDS } from '../english/words';
import { assertSessionSize } from '../session';
import { GRID_RUDE_WORDS } from './gridRudeWords';

// The tests read the cell type from here.
export type { Cell };

export const GRID = 6;
export const WORDS_PER_PUZZLE = 5;

export type SearchLevel = 1 | 2 | 3;
export const SEARCH_LEVELS: readonly SearchLevel[] = [1, 2, 3];

/** One step along a word: dr rows down, dc columns to the right (each -1, 0 or 1). */
type Direction = Readonly<{ dr: number; dc: number }>;

/** Levels 1-2: left to right and top to bottom only. */
const SIMPLE_DIRECTIONS: readonly Direction[] = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
];
/** All 8 directions (level 3, and every check of a finished grid). */
const ALL_DIRECTIONS: readonly Direction[] = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: -1, dc: 1 },
  { dr: 0, dc: -1 },
  { dr: -1, dc: 0 },
  { dr: -1, dc: -1 },
  { dr: 1, dc: -1 },
];

function levelDirections(level: SearchLevel): readonly Direction[] {
  return level === 3 ? ALL_DIRECTIONS : SIMPLE_DIRECTIONS;
}

/** The game's words: the English list without "seventeen" (too long for 6 x 6); 20 words. */
export const SEARCH_WORDS: readonly string[] = WORDS.map((entry) => entry.word).filter(
  (word) => word.length <= GRID,
);

/** Grid letters are capitals (the list keeps the word's own spelling, e.g. "Suzy"). */
export const gridLetters = (word: string) => word.toUpperCase();

type PlacedWord = Readonly<{
  word: string;
  start: Cell;
  direction: Direction;
  cells: readonly Cell[];
}>;

export type Puzzle = Readonly<{
  /** GRID rows of GRID capital letters. */
  rows: readonly string[];
  /** The puzzle's words in list order (the order they are shown below the grid). */
  words: readonly PlacedWord[];
}>;

/** Why a filled grid was thrown away (for the generator statistics in the tests). */
type Rejection = 'placement' | 'repeat' | 'other' | 'rude';

type GenerateStats = { attempts: number; rejected: Record<Rejection, number> };

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const inside = (n: number) => n >= 0 && n < GRID;

/** The cells of a word of `length` letters from `start` in `direction` (may leave the grid). */
function wordCells(start: Cell, direction: Direction, length: number): Cell[] {
  return Array.from({ length }, (_, i) => ({
    row: start.row + i * direction.dr,
    col: start.col + i * direction.dc,
  }));
}

/** Every straight reading of the grid: each line in each of the 8 directions, edge to edge. */
function gridLines(rows: readonly string[]): string[] {
  const lines: string[] = [];
  for (const direction of ALL_DIRECTIONS)
    for (let row = 0; row < GRID; row++)
      for (let col = 0; col < GRID; col++) {
        // A line starts where one step back leaves the grid.
        if (inside(row - direction.dr) && inside(col - direction.dc)) continue;
        let text = '';
        for (let r = row, c = col; inside(r) && inside(c); r += direction.dr, c += direction.dc)
          text += rows[r][c];
        lines.push(text);
      }
  return lines;
}

/** How often `word` can be read in the grid, any of the 8 directions. */
function countWord(rows: readonly string[], word: string, lines = gridLines(rows)): number {
  const letters = gridLetters(word);
  let count = 0;
  for (const line of lines)
    for (let at = line.indexOf(letters); at !== -1; at = line.indexOf(letters, at + 1)) count++;
  return count;
}

/**
 * A rude word can be read somewhere in the grid: every run of 3 or more letters in every
 * direction goes through the shared nickname filter (2 letters would flag e.g. "AS") and the
 * grid-only list of short crude words (QA247-01).
 */
export function hasRudeWord(rows: readonly string[], lines = gridLines(rows)): boolean {
  for (const line of lines)
    for (let from = 0; from + 3 <= line.length; from++)
      for (let to = from + 3; to <= line.length; to++) if (rude(line.slice(from, to))) return true;
  return false;
}

// The filter's answers for letter runs already seen (most runs are 3-4 letters and repeat a
// lot between grids); bounded so it never grows without end.
const rudeSeen = new Map<string, boolean>();
function rude(run: string): boolean {
  let answer = rudeSeen.get(run);
  if (answer === undefined) {
    if (rudeSeen.size >= 200_000) rudeSeen.clear();
    answer = GRID_RUDE_WORDS.has(run) || isRudeNickname(run);
    rudeSeen.set(run, answer);
  }
  return answer;
}

/** Why a filled grid fails the checks, or null when it is good. */
export function gridProblem(
  rows: readonly string[],
  words: readonly string[],
): Exclude<Rejection, 'placement'> | null {
  const lines = gridLines(rows);
  if (words.some((word) => countWord(rows, word, lines) !== 1)) return 'repeat';
  const others = SEARCH_WORDS.filter((word) => !words.includes(word));
  if (others.some((word) => countWord(rows, word, lines) > 0)) return 'other';
  if (hasRudeWord(rows, lines)) return 'rude';
  return null;
}

/** Places the words (longest first, random free spot each) or null when one does not fit. */
function placeWords(
  words: readonly string[],
  directions: readonly Direction[],
  rng: () => number,
): { cells: (string | null)[][]; placed: Map<string, PlacedWord> } | null {
  const cells: (string | null)[][] = Array.from({ length: GRID }, () =>
    Array<string | null>(GRID).fill(null),
  );
  const placed = new Map<string, PlacedWord>();
  const order = shuffled(words, rng).sort((a, b) => b.length - a.length);
  for (const word of order) {
    const letters = gridLetters(word);
    const spots: PlacedWord[] = [];
    for (const direction of directions)
      for (let row = 0; row < GRID; row++)
        for (let col = 0; col < GRID; col++) {
          const endRow = row + (letters.length - 1) * direction.dr;
          const endCol = col + (letters.length - 1) * direction.dc;
          if (!inside(endRow) || !inside(endCol)) continue;
          const path = wordCells({ row, col }, direction, letters.length);
          const fits = path.every(
            (cell, i) =>
              cells[cell.row][cell.col] === null || cells[cell.row][cell.col] === letters[i],
          );
          if (!fits) continue;
          // Crossing is allowed, lying on top of another word in the same line is not.
          const overlap = path.filter((cell) => cells[cell.row][cell.col] !== null).length;
          if (overlap < letters.length - 1)
            spots.push({ word, start: { row, col }, direction, cells: path });
        }
    if (spots.length === 0) return null;
    const spot = pickOne(spots, rng);
    spot.cells.forEach((cell, i) => (cells[cell.row][cell.col] = letters[i]));
    placed.set(word, spot);
  }
  return { cells, placed };
}

/**
 * One grid with these words (each placed in a direction the level allows). Tries placements
 * until a grid passes the checks; null only when `maxAttempts` all failed (the lesson builder
 * then picks other words). `stats`, when given, collects attempts and rejection reasons.
 */
export function generatePuzzle(
  words: readonly string[],
  level: SearchLevel,
  rng: () => number = Math.random,
  stats?: GenerateStats,
  maxAttempts = 200,
): Puzzle | null {
  const directions = levelDirections(level);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (stats) stats.attempts++;
    const placement = placeWords(words, directions, rng);
    if (!placement) {
      if (stats) stats.rejected.placement++;
      continue;
    }
    const rows = placement.cells.map((row) =>
      row.map((letter) => letter ?? pickOne([...LETTERS], rng)).join(''),
    );
    const problem = gridProblem(rows, words);
    if (problem) {
      if (stats) stats.rejected[problem]++;
      continue;
    }
    return { rows, words: words.map((word) => placement.placed.get(word)!) };
  }
  return null;
}

export const newStats = (): GenerateStats => ({
  attempts: 0,
  rejected: { placement: 0, repeat: 0, other: 0, rude: 0 },
});

/**
 * A lesson: size 5, 10 or 20 words = 1, 2 or 4 grids of 5. The words are all different (20 = the
 * whole list once), in a random order and split into grids of 5.
 */
export function generateSearchLesson(
  level: SearchLevel,
  size: number,
  rng: () => number = Math.random,
  stats?: GenerateStats,
): readonly Puzzle[] {
  assertSessionSize(size);
  // Bounded: a set of 5 words that cannot be placed (never seen in tests) gets new words.
  for (let round = 0; round < 50; round++) {
    const words = shuffled(SEARCH_WORDS, rng).slice(0, size);
    const puzzles: Puzzle[] = [];
    for (let i = 0; i < size; i += WORDS_PER_PUZZLE) {
      const puzzle = generatePuzzle(words.slice(i, i + WORDS_PER_PUZZLE), level, rng, stats);
      if (!puzzle) break;
      puzzles.push(puzzle);
    }
    if (puzzles.length === size / WORDS_PER_PUZZLE) return puzzles;
  }
  throw new Error('No word search grid found');
}

/**
 * The selection checker: the first and the last tapped cell. The index of the puzzle word whose
 * first and last letters are these cells (either tap order), or null (a wrong pair).
 */
export function checkSelection(puzzle: Puzzle, first: Cell, last: Cell): number | null {
  const index = puzzle.words.findIndex(({ cells }) => {
    const a = cells[0];
    const b = cells[cells.length - 1];
    return (sameCell(a, first) && sameCell(b, last)) || (sameCell(a, last) && sameCell(b, first));
  });
  return index === -1 ? null : index;
}
