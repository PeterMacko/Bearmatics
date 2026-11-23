import { describe, expect, test } from 'vitest';
import { seeded } from '../testing/seeded';
import {
  checkBearPath,
  decodeArrows,
  encodeArrows,
  generateBearSession,
  MOVE_SHAPES,
  placements,
  walkArrows,
  type BearPuzzle,
} from './bearPath';

// Independent oracle: cells as indexes 0-15 on a 4 x 4 board (index = 4 * row + col); moves
// by index arithmetic with an explicit edge test; distance by breadth-first search.
const N = 4;
const index = ({ row, col }: { row: number; col: number }) => N * row + col;
function oracleMove(at: number, letter: string): number | null {
  if (letter === 'U') return at >= N ? at - N : null;
  if (letter === 'D') return at < N * N - N ? at + N : null;
  if (letter === 'L') return at % N !== 0 ? at - 1 : null;
  if (letter === 'R') return at % N !== N - 1 ? at + 1 : null;
  throw new Error(letter);
}
function oracleDistance(from: number, to: number): number {
  const seen = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift()!;
    if (at === to) return seen.get(at)!;
    for (const letter of 'UDLR') {
      const next = oracleMove(at, letter);
      if (next !== null && !seen.has(next)) {
        seen.set(next, seen.get(at)! + 1);
        queue.push(next);
      }
    }
  }
  throw new Error('unreachable');
}
/** Right = every arrow stays on the board and the bear ends on the honey after the last one. */
function oracleRight(puzzle: BearPuzzle, letters: string): boolean {
  let at = index(puzzle.bear);
  for (const letter of letters) {
    const next = oracleMove(at, letter);
    if (next === null) return false;
    at = next;
  }
  return at === index(puzzle.honey);
}
const shapeKey = (p: BearPuzzle) => `${p.honey.col - p.bear.col},${p.honey.row - p.bear.row}`;

const at = (row: number, col: number) => ({ row, col });

describe('Logic level 1: move shapes and placements', () => {
  test('32 move shapes (8 of 2 moves, 12 of 3, 12 of 4) and 172 placements', () => {
    expect(MOVE_SHAPES).toHaveLength(32);
    const byDistance = [2, 3, 4].map(
      (d) => MOVE_SHAPES.filter(({ dx, dy }) => Math.abs(dx) + Math.abs(dy) === d).length,
    );
    expect(byDistance).toEqual([8, 12, 12]);
    // Oracle: all ordered pairs of different cells 2-4 moves apart (BFS).
    let pairs = 0;
    for (let a = 0; a < 16; a++)
      for (let b = 0; b < 16; b++) {
        const d = a === b ? 0 : oracleDistance(a, b);
        if (d >= 2 && d <= 4) pairs++;
      }
    expect(pairs).toBe(172);
    expect(MOVE_SHAPES.reduce((sum, shape) => sum + placements(shape).length, 0)).toBe(172);
  });
});

describe('Logic level 1: lessons', () => {
  const MIX = { 5: [2, 2, 1], 10: [3, 4, 3], 20: [6, 7, 7] } as const;

  test('10,000 seeded lessons: 4 x 4, 2-4 moves apart, mix and order, no repeated shape', () => {
    let lessons = 0;
    for (let seed = 1; lessons < 10_000; seed++)
      for (const size of [5, 10, 20] as const) {
        const lesson = generateBearSession(size, seeded(seed));
        lessons++;
        expect(lesson).toHaveLength(size);
        const distances = lesson.map((p) => {
          for (const cell of [p.bear, p.honey]) {
            expect(Number.isInteger(cell.row) && cell.row >= 0 && cell.row < 4).toBe(true);
            expect(Number.isInteger(cell.col) && cell.col >= 0 && cell.col < 4).toBe(true);
          }
          return oracleDistance(index(p.bear), index(p.honey));
        });
        const [two, three, four] = MIX[size];
        expect(distances).toEqual([
          ...Array<number>(two).fill(2),
          ...Array<number>(three).fill(3),
          ...Array<number>(four).fill(4),
        ]);
        expect(new Set(lesson.map(shapeKey)).size).toBe(size);
      }
  });

  test('the random source decides: different seeds give different lessons, one seed the same', () => {
    expect(generateBearSession(10, seeded(7))).toEqual(generateBearSession(10, seeded(7)));
    const seen = new Set(
      Array.from({ length: 50 }, (_, s) => JSON.stringify(generateBearSession(5, seeded(s)))),
    );
    expect(seen.size).toBeGreaterThan(40);
  });

  test('extreme random values still give valid lessons (always 0, always just below 1)', () => {
    for (const value of [0, 0.999999999])
      for (const size of [5, 10, 20]) {
        const lesson = generateBearSession(size, () => value);
        expect(lesson).toHaveLength(size);
        expect(new Set(lesson.map(shapeKey)).size).toBe(size);
      }
  });

  test('unsupported lesson sizes are refused', () => {
    expect(() => generateBearSession(7)).toThrow(RangeError);
  });

  test('every shape and placement can appear (pools are complete)', () => {
    const shapes = new Set<string>();
    const cells = new Set<string>();
    for (let seed = 1; seed <= 400; seed++)
      for (const p of generateBearSession(20, seeded(seed))) {
        shapes.add(shapeKey(p));
        cells.add(JSON.stringify(p));
      }
    expect(shapes.size).toBe(32);
    expect(cells.size).toBe(172);
  });
});

describe('Logic level 1: checking a planned path', () => {
  const puzzle: BearPuzzle = { bear: at(1, 0), honey: at(2, 2) };

  test('right: ends on the honey after the last arrow (any order of the moves)', () => {
    for (const path of ['RRD', 'RDR', 'DRR']) {
      expect(checkBearPath(puzzle, path)).toBe('correct');
      expect(oracleRight(puzzle, path)).toBe(true);
    }
    // A longer way round is also right when it stays on the grid and ends on the honey.
    expect(checkBearPath({ bear: at(0, 0), honey: at(0, 2) }, 'DRRU')).toBe('correct');
  });

  test('wrong: ends somewhere else', () => {
    expect(checkBearPath(puzzle, 'RR')).toBe('incorrect');
    expect(checkBearPath(puzzle, 'RRDD')).toBe('incorrect');
    expect(checkBearPath(puzzle, 'U')).toBe('incorrect');
  });

  test('wrong: passes over the honey but ends somewhere else', () => {
    expect(walkArrows(puzzle.bear, ['right', 'right', 'down', 'right']).steps).toContainEqual(
      puzzle.honey,
    );
    expect(checkBearPath(puzzle, 'RRDR')).toBe('incorrect');
    expect(checkBearPath({ bear: at(0, 0), honey: at(0, 2) }, 'RRR')).toBe('incorrect');
  });

  test('wrong: an arrow leads off the grid at each edge; the bear stops at the edge', () => {
    const corner = { bear: at(0, 0), honey: at(1, 1) };
    // Up and left off the top-left corner, even when later arrows would reach the honey.
    expect(checkBearPath(corner, 'URD')).toBe('incorrect');
    expect(checkBearPath(corner, 'LRD')).toBe('incorrect');
    const far = { bear: at(3, 3), honey: at(2, 2) };
    expect(checkBearPath(far, 'DUL')).toBe('incorrect');
    expect(checkBearPath(far, 'RUL')).toBe('incorrect');
    const walk = walkArrows(at(3, 2), ['right', 'right', 'up']);
    expect(walk).toEqual({ steps: [at(3, 3)], bumped: true, end: at(3, 3) });
    expect(walkArrows(at(0, 1), ['up'])).toEqual({ steps: [], bumped: true, end: at(0, 1) });
  });

  test('no arrows or more than 4 arrows are not an attempt; unknown letters neither', () => {
    expect(checkBearPath(puzzle, '')).toBe('invalid-input');
    expect(checkBearPath(puzzle, 'RRDUD')).toBe('invalid-input');
    expect(checkBearPath(puzzle, 'RX')).toBe('invalid-input');
    expect(checkBearPath({ bear: at(0, 0), honey: at(2, 2) }, 'RRDD')).toBe('correct');
  });

  test('checker agrees with the oracle on every path of 1-4 arrows for sample puzzles', () => {
    const paths: string[] = [];
    const grow = (prefix: string) => {
      if (prefix) paths.push(prefix);
      if (prefix.length < 4) for (const l of 'UDLR') grow(prefix + l);
    };
    grow('');
    expect(paths).toHaveLength(4 + 16 + 64 + 256);
    for (const p of generateBearSession(20, seeded(3)))
      for (const path of paths)
        expect(checkBearPath(p, path) === 'correct', `${JSON.stringify(p)} ${path}`).toBe(
          oracleRight(p, path),
        );
  });

  test('arrows encode to letters and back', () => {
    expect(encodeArrows(['up', 'down', 'left', 'right'])).toBe('UDLR');
    expect(decodeArrows('RDLU')).toEqual(['right', 'down', 'left', 'up']);
    expect(decodeArrows('Q')).toBeNull();
  });
});
