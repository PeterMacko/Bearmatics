import { describe, expect, test } from 'vitest';
import { seeded } from '../testing/seeded';
import {
  ARROW_LIMIT,
  bearChecker,
  checkBearPath,
  decodeArrows,
  encodeArrows,
  generateBearSession,
  generateLogicSession,
  generateStoneSession,
  layoutKey,
  MOVE_SHAPES,
  placements,
  shortestPath,
  STONE_LAYOUTS,
  TIER_LAYOUTS,
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
    // Level 1's checker keeps the limit of 4 (SCRUM-289 scope 3).
    expect(ARROW_LIMIT[1]).toBe(4);
    expect(bearChecker(1)(puzzle, 'RRDUD')).toBe('invalid-input');
    expect(bearChecker(1)(puzzle, 'RRD')).toBe('correct');
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

// ---------------------------------------------------------------------------------------------
// SCRUM-289 / SCRUM-292: Level 2 "Around the stones". The oracle below works on cell indexes
// (0-15) with its own moves (oracleMove above) and its own breadth-first search; it never calls
// the engine's solver.

/** Fewest arrows from `from` to `to` avoiding `blocked` cells, or null when unreachable. */
function oracleSteps(from: number, to: number, blocked: ReadonlySet<number>): number | null {
  const seen = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const cell = queue.shift()!;
    if (cell === to) return seen.get(cell)!;
    for (const letter of 'UDLR') {
      const next = oracleMove(cell, letter);
      if (next !== null && !blocked.has(next) && !seen.has(next)) {
        seen.set(next, seen.get(cell)! + 1);
        queue.push(next);
      }
    }
  }
  return null;
}
const rowOf = (i: number) => Math.floor(i / N);
const colOf = (i: number) => i % N;
const manhattan = (a: number, b: number) =>
  Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b));
/** Relative layout key, built by the oracle: honey and stones as (dx, dy) from the bear. */
function oracleKey(bear: number, honey: number, stones: readonly number[]): string {
  const offset = (c: number) => ({ dx: colOf(c) - colOf(bear), dy: rowOf(c) - rowOf(bear) });
  const sorted = stones
    .map(offset)
    .sort((a, b) => a.dy - b.dy || a.dx - b.dx)
    .map((o) => `${o.dx},${o.dy}`);
  const h = offset(honey);
  return `${h.dx},${h.dy}:${sorted.join(';')}`;
}
/** Right = every arrow stays on the board, never enters a stone and ends on the honey. */
function oracleStoneRight(p: BearPuzzle, letters: string): boolean {
  const blocked = new Set((p.stones ?? []).map(index));
  let cell = index(p.bear);
  for (const letter of letters) {
    const next = oracleMove(cell, letter);
    if (next === null || blocked.has(next)) return false;
    cell = next;
  }
  return cell === index(p.honey);
}

/**
 * All relative layouts by brute force over the whole board: every bear and honey cell, 1-2
 * stones on cells of their bounding rectangle other than bear and honey; a layout counts when
 * some placement is solvable within 6, with its fewest arrows over the placements.
 */
const ORACLE_LAYOUTS: ReadonlyMap<string, { straight: number; length: number }> = (() => {
  const out = new Map<string, { straight: number; length: number }>();
  for (let bear = 0; bear < 16; bear++)
    for (let honey = 0; honey < 16; honey++) {
      if (bear === honey) continue;
      const rect: number[] = [];
      for (let c = 0; c < 16; c++) {
        // On a shortest route of the empty board = inside the bounding rectangle.
        if (c === bear || c === honey) continue;
        if (manhattan(bear, c) + manhattan(c, honey) === manhattan(bear, honey)) rect.push(c);
      }
      const sets = rect.flatMap((a, i) => [[a], ...rect.slice(i + 1).map((b) => [a, b])]);
      for (const stones of sets) {
        const length = oracleSteps(bear, honey, new Set(stones));
        if (length === null || length > 6) continue;
        const key = oracleKey(bear, honey, stones);
        const known = out.get(key);
        if (!known || length < known.length)
          out.set(key, { straight: manhattan(bear, honey), length });
      }
    }
  return out;
})();

/** The engine's layout key with stones sorted the oracle's way (row, then column). */
const engineKey = (l: (typeof STONE_LAYOUTS)[number]) =>
  layoutKey({ shape: l.shape, stones: [...l.stones].sort((a, b) => a.dy - b.dy || a.dx - b.dx) });
const puzzleKey = (p: BearPuzzle) =>
  oracleKey(index(p.bear), index(p.honey), (p.stones ?? []).map(index));

describe('Logic level 2: stone layouts (pinned counts)', () => {
  test('1,224 layouts; tiers A 64 (8 + 56), B 40 (4 + 36), C 60; engine equals the oracle', () => {
    expect(ORACLE_LAYOUTS.size).toBe(1224);
    expect(STONE_LAYOUTS).toHaveLength(1224);
    const oracle = [...ORACLE_LAYOUTS.entries()];
    const count = (keep: (v: { straight: number; length: number }) => boolean) =>
      oracle.filter(([, v]) => keep(v)).length;
    // Free way of 2 and 3 moves.
    expect(count((v) => v.length === v.straight && v.straight === 2)).toBe(8);
    expect(count((v) => v.length === v.straight && v.straight === 3)).toBe(56);
    // Go-around (longer than the straight distance) of 4, 5 and 6 moves.
    expect(count((v) => v.length > v.straight && v.length === 4)).toBe(4);
    expect(count((v) => v.length > v.straight && v.length === 5)).toBe(36);
    expect(count((v) => v.length > v.straight && v.length === 6)).toBe(60);
    expect(STONE_LAYOUTS.map(engineKey).sort()).toEqual(oracle.map(([k]) => k).sort());
    for (const layout of STONE_LAYOUTS)
      expect(layout.length, engineKey(layout)).toBe(ORACLE_LAYOUTS.get(engineKey(layout))!.length);
    expect(TIER_LAYOUTS.A).toHaveLength(64);
    expect(TIER_LAYOUTS.B).toHaveLength(40);
    expect(TIER_LAYOUTS.C).toHaveLength(60);
    expect(TIER_LAYOUTS.B.filter((l) => l.length === 4)).toHaveLength(4);
    expect(TIER_LAYOUTS.B.filter((l) => l.length === 5)).toHaveLength(36);
    expect(TIER_LAYOUTS.C.every((l) => l.length === 6)).toBe(true);
  });

  test('the engine solver agrees with the oracle on every layout placement', () => {
    for (const layout of STONE_LAYOUTS)
      for (let bear = 0; bear < 16; bear++) {
        const p = {
          bear: { row: rowOf(bear), col: colOf(bear) },
          honey: { row: rowOf(bear) + layout.shape.dy, col: colOf(bear) + layout.shape.dx },
          stones: layout.stones.map((s) => ({ row: rowOf(bear) + s.dy, col: colOf(bear) + s.dx })),
        };
        const cells = [p.honey, ...p.stones];
        if (!cells.every((c) => c.row >= 0 && c.row < 4 && c.col >= 0 && c.col < 4)) continue;
        expect(shortestPath(p)).toBe(
          oracleSteps(bear, index(p.honey), new Set(p.stones.map(index))),
        );
      }
  });
});

describe('Logic level 2: lessons', () => {
  const MIX = { 5: [1, 2, 2], 10: [2, 4, 4], 20: [4, 8, 8] } as const;

  /**
   * Checks one lesson against the scope with the oracle; returns what is wrong ('' = fine).
   * Plain checks rather than expect() per cell keep 10,000 lessons fast.
   */
  function lessonProblem(lesson: readonly BearPuzzle[], size: 5 | 10 | 20): string {
    if (lesson.length !== size) return `length ${lesson.length}`;
    const onBoard = (c: { row: number; col: number }) =>
      [c.row, c.col].every((n) => Number.isInteger(n) && n >= 0 && n < 4);
    const tiers: string[] = [];
    const steps: number[] = [];
    for (const p of lesson) {
      const stones = p.stones ?? [];
      if (![p.bear, p.honey, ...stones].every(onBoard)) return 'off the board';
      const bear = index(p.bear),
        honey = index(p.honey);
      const blocked = stones.map(index);
      if (stones.length < 1 || stones.length > 2) return `${stones.length} stones`;
      if (new Set(blocked).size !== stones.length) return 'two stones on one cell';
      if (blocked.includes(bear) || blocked.includes(honey)) return 'stone on bear or honey';
      // Each stone on a shortest route of the empty board, which it therefore blocks.
      for (const s of blocked)
        if (manhattan(bear, s) + manhattan(s, honey) !== manhattan(bear, honey))
          return 'stone off the shortest routes';
      const d = oracleSteps(bear, honey, new Set(blocked));
      if (d === null || d > 6) return `not solvable within 6 (${d})`;
      const straight = manhattan(bear, honey);
      if (d === straight && straight !== 2 && straight !== 3) return `free way of ${d}`;
      tiers.push(d === straight ? 'A' : d <= 5 ? 'B' : 'C');
      steps.push(d);
    }
    const [a, b, c] = MIX[size];
    if (tiers.join('') !== 'A'.repeat(a) + 'B'.repeat(b) + 'C'.repeat(c))
      return `tiers ${tiers.join('')}`;
    // Easier first inside the go-around tier too (4 moves before 5).
    const round = steps.slice(a, a + b);
    if (round.some((n, i) => i > 0 && n < round[i - 1])) return `round order ${round}`;
    if (new Set(lesson.map(puzzleKey)).size !== size) return 'a layout twice';
    return '';
  }

  for (const size of [5, 10, 20] as const)
    test(`10,000 seeded lessons of ${size}: stones, tiers, solvable within 6, no layout twice`, () => {
      const problems: string[] = [];
      for (let seed = 1; seed <= 10_000; seed++) {
        const problem = lessonProblem(generateStoneSession(size, seeded(seed)), size);
        if (problem) problems.push(`seed ${seed}: ${problem}`);
      }
      expect(problems).toEqual([]);
    }, 60_000);

  test('the random source decides: same seed same lesson, different seeds differ', () => {
    expect(generateStoneSession(10, seeded(7))).toEqual(generateStoneSession(10, seeded(7)));
    const seen = new Set(
      Array.from({ length: 50 }, (_, s) => JSON.stringify(generateStoneSession(5, seeded(s)))),
    );
    expect(seen.size).toBeGreaterThan(40);
  });

  test('extreme random values still give valid lessons (always 0, always just below 1)', () => {
    for (const value of [0, 0.999999999])
      for (const size of [5, 10, 20] as const)
        expect(
          lessonProblem(
            generateStoneSession(size, () => value),
            size,
          ),
        ).toBe('');
  });

  test('unsupported lesson sizes are refused; the level picks the generator', () => {
    expect(() => generateStoneSession(7)).toThrow(RangeError);
    expect(generateLogicSession(2, 5, seeded(3))).toEqual(generateStoneSession(5, seeded(3)));
    expect(generateLogicSession(1, 5, seeded(3))).toEqual(generateBearSession(5, seeded(3)));
  });

  test('every tier layout can appear (pools are complete)', () => {
    const keys = new Set<string>();
    for (let seed = 1; seed <= 400; seed++)
      for (const p of generateStoneSession(20, seeded(seed))) keys.add(puzzleKey(p));
    expect(keys.size).toBe(64 + 40 + 60);
  });
});

describe('Logic level 2: walking around the stones', () => {
  // Bear top-left, honey two to the right, a stone between them.
  const puzzle: BearPuzzle = { bear: at(1, 0), honey: at(1, 2), stones: [at(1, 1)] };

  test('an arrow into a stone stops the bear in front of it = wrong, like the edge', () => {
    expect(walkArrows(puzzle.bear, ['right', 'right'], puzzle.stones)).toEqual({
      steps: [],
      bumped: true,
      end: at(1, 0),
      stone: at(1, 1),
    });
    expect(checkBearPath(puzzle, 'RR', 6)).toBe('incorrect');
    // Later arrows that would reach the honey do not help after the bump.
    expect(checkBearPath(puzzle, 'RURRD', 6)).toBe('incorrect');
    expect(checkBearPath(puzzle, 'URRD', 6)).toBe('correct');
    expect(checkBearPath(puzzle, 'DRRU', 6)).toBe('correct');
    // The edge still stops the bear (no stone key then).
    expect(walkArrows(at(0, 0), ['up'], puzzle.stones)).toEqual({
      steps: [],
      bumped: true,
      end: at(0, 0),
    });
  });

  test('up to 6 arrows on Level 2, 4 on Level 1; more is not an attempt', () => {
    expect(ARROW_LIMIT[2]).toBe(6);
    const around: BearPuzzle = { bear: at(0, 0), honey: at(1, 1), stones: [at(0, 1), at(1, 0)] };
    // Bear in the corner, both neighbours stones: no way at all; long plans are just wrong.
    expect(checkBearPath(around, 'RDRDRD', 6)).toBe('incorrect');
    const six: BearPuzzle = { bear: at(1, 1), honey: at(2, 2), stones: [at(1, 2), at(2, 1)] };
    expect(checkBearPath(six, 'URRDDL', 6)).toBe('correct');
    expect(bearChecker(2)(six, 'URRDDL')).toBe('correct');
    expect(bearChecker(2)(six, 'URRDDLR')).toBe('invalid-input');
    expect(bearChecker(1)(six, 'URRDDL')).toBe('invalid-input');
    expect(bearChecker(2)(six, '')).toBe('invalid-input');
  });

  test('checker agrees with the oracle on every path of 1-6 arrows for sample stone puzzles', () => {
    const paths: string[] = [];
    const grow = (prefix: string) => {
      if (prefix) paths.push(prefix);
      if (prefix.length < 6) for (const l of 'UDLR') grow(prefix + l);
    };
    grow('');
    expect(paths).toHaveLength(4 + 16 + 64 + 256 + 1024 + 4096);
    for (const p of generateStoneSession(10, seeded(5)))
      for (const path of paths)
        expect(bearChecker(2)(p, path) === 'correct', `${JSON.stringify(p)} ${path}`).toBe(
          oracleStoneRight(p, path),
        );
  });
});
