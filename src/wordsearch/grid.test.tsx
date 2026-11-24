import { describe, expect, test } from 'vitest';
import { WORDS } from '../english/words';
import { seeded } from '../testing/seeded';
import { gridProblems, SIMPLE_STEPS } from '../testing/wordSearchOracle';
import {
  checkSelection,
  generateSearchLesson,
  gridProblem,
  hasRudeWord,
  SEARCH_LEVELS,
  SEARCH_WORDS,
  WORDS_PER_PUZZLE,
  type Puzzle,
  type SearchLevel,
} from './grid';

// The 10,000-grid acceptance runs are in grid.level{1,2,3}.test.tsx (parallel files).
const expectGoodGrid = (puzzle: Puzzle, level: SearchLevel, words: readonly string[]) =>
  expect(gridProblems(puzzle, level, words)).toEqual([]);
const SIMPLE = SIMPLE_STEPS;

describe('word list', () => {
  test('20 words of 3-6 letters: the English list without seventeen', () => {
    expect(SEARCH_WORDS).toHaveLength(20);
    expect(SEARCH_WORDS).not.toContain('seventeen');
    expect(SEARCH_WORDS).toEqual(WORDS.map((w) => w.word).filter((w) => w !== 'seventeen'));
    for (const word of SEARCH_WORDS) expect(word.length).toBeGreaterThanOrEqual(3);
    for (const word of SEARCH_WORDS) expect(word.length).toBeLessThanOrEqual(6);
  });
  test('no list word contains another one or reads the same backwards', () => {
    const upper = SEARCH_WORDS.map((w) => w.toUpperCase());
    for (const a of upper) {
      expect([...a].reverse().join('')).not.toBe(a);
      for (const b of upper)
        if (a !== b) {
          expect(a.includes(b)).toBe(false);
          expect(a.includes([...b].reverse().join(''))).toBe(false);
        }
    }
  });
});

describe('grid checks (engine)', () => {
  test('a rude word is found in any direction, also backwards and diagonal', () => {
    const plain = ['QWQWQW', 'WQWQWQ', 'QWQWQW', 'WQWQWQ', 'QWQWQW', 'WQWQWQ'];
    expect(hasRudeWord(plain)).toBe(false);
    const put = (cells: [number, number][], word: string) => {
      const rows = plain.map((row) => [...row]);
      cells.forEach(([r, c], i) => (rows[r][c] = word[i]));
      return rows.map((row) => row.join(''));
    };
    expect(
      hasRudeWord(
        put(
          [
            [0, 0],
            [0, 1],
            [0, 2],
          ],
          'SEX',
        ),
      ),
    ).toBe(true);
    expect(
      hasRudeWord(
        put(
          [
            [2, 4],
            [2, 3],
            [2, 2],
          ],
          'SEX',
        ),
      ),
    ).toBe(true); // backwards
    expect(
      hasRudeWord(
        put(
          [
            [5, 0],
            [4, 1],
            [3, 2],
            [2, 3],
          ],
          'DICK',
        ),
      ),
    ).toBe(true); // diagonal up
    expect(
      hasRudeWord(
        put(
          [
            [1, 5],
            [2, 4],
            [3, 3],
            [4, 2],
            [5, 1],
          ],
          'KOKOT',
        ),
      ),
    ).toBe(true);
    expect(
      hasRudeWord(
        put(
          [
            [0, 2],
            [1, 2],
            [2, 2],
          ],
          'ASS',
        ),
      ),
    ).toBe(true); // vertical
    expect(
      hasRudeWord(
        put(
          [
            [0, 0],
            [0, 1],
            [0, 2],
          ],
          'ASK',
        ),
      ),
    ).toBe(false);
  });
  test('gridProblem names a repeated word, another list word and a rude word', () => {
    const base = ['DOGQWQ', 'WQWQWQ', 'QWQWQW', 'WQWQWQ', 'QWQWQW', 'WQWQWQ'];
    expect(gridProblem(base, ['dog'])).toBeNull();
    expect(gridProblem(['DOGGOD', ...base.slice(1)], ['dog'])).toBe('repeat');
    expect(gridProblem(['DOGCAT', ...base.slice(1)], ['dog'])).toBe('other');
    expect(gridProblem(['DOGSEX', ...base.slice(1)], ['dog'])).toBe('rude');
  });
});

describe('generator (seeded)', () => {
  test('every grid follows the rules for a few seeds and words (quick check)', () => {
    for (const level of SEARCH_LEVELS)
      for (let seed = 1; seed <= 50; seed++) {
        const rng = seeded(seed * 7 + level);
        const lesson = generateSearchLesson(level, 20, rng);
        expect(lesson).toHaveLength(4);
        for (const puzzle of lesson)
          expectGoodGrid(
            puzzle,
            level,
            puzzle.words.map((w) => w.word),
          );
      }
  });

  test('lesson sizes 5/10/20 give 1/2/4 grids of 5 different words; 20 = every word once', () => {
    for (const level of SEARCH_LEVELS)
      for (const [size, grids] of [
        [5, 1],
        [10, 2],
        [20, 4],
      ] as const)
        for (let seed = 1; seed <= 20; seed++) {
          const lesson = generateSearchLesson(level, size, seeded(seed));
          expect(lesson).toHaveLength(grids);
          const words = lesson.flatMap((p) => p.words.map((w) => w.word));
          expect(words).toHaveLength(size);
          expect(new Set(words).size).toBe(size);
          for (const puzzle of lesson) expect(puzzle.words).toHaveLength(WORDS_PER_PUZZLE);
          if (size === 20) expect([...words].sort()).toEqual([...SEARCH_WORDS].sort());
        }
    expect(() => generateSearchLesson(1, 7)).toThrow(RangeError);
  });

  test('the same seed gives the same lesson; different seeds differ', () => {
    const a = generateSearchLesson(3, 10, seeded(42));
    expect(generateSearchLesson(3, 10, seeded(42))).toEqual(a);
    expect(generateSearchLesson(3, 10, seeded(43))).not.toEqual(a);
  });

  test('level 3 uses backwards and diagonal directions; levels 1-2 never', () => {
    const used = (level: SearchLevel) => {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 100; seed++)
        for (const puzzle of generateSearchLesson(level, 20, seeded(seed)))
          for (const w of puzzle.words) seen.add(`${w.direction.dr},${w.direction.dc}`);
      return seen;
    };
    expect(used(1)).toEqual(SIMPLE);
    expect(used(2)).toEqual(SIMPLE);
    expect(used(3).size).toBe(8);
  });
});

describe('selection checker', () => {
  const puzzle = generateSearchLesson(3, 5, seeded(7))[0];
  test('first and last letter of each word (either tap order) find that word', () => {
    puzzle.words.forEach((placed, index) => {
      const first = placed.cells[0];
      const last = placed.cells[placed.cells.length - 1];
      expect(checkSelection(puzzle, first, last)).toBe(index);
      expect(checkSelection(puzzle, last, first)).toBe(index);
    });
  });
  test('any other pair is wrong (null): second letter, same cell twice, random cells', () => {
    const placed = puzzle.words[0];
    expect(checkSelection(puzzle, placed.cells[0], placed.cells[1])).toBeNull();
    expect(checkSelection(puzzle, placed.cells[0], placed.cells[0])).toBeNull();
    const ends = new Set(
      puzzle.words.flatMap((w) => {
        const a = w.cells[0];
        const b = w.cells[w.cells.length - 1];
        return [`${a.row},${a.col}|${b.row},${b.col}`, `${b.row},${b.col}|${a.row},${a.col}`];
      }),
    );
    for (let a = 0; a < 36; a++)
      for (let b = 0; b < 36; b++) {
        const first = { row: Math.floor(a / 6), col: a % 6 };
        const last = { row: Math.floor(b / 6), col: b % 6 };
        const key = `${first.row},${first.col}|${last.row},${last.col}`;
        expect(checkSelection(puzzle, first, last) !== null).toBe(ends.has(key));
      }
  });
});
