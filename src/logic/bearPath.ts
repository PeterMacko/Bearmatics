// SCRUM-262: Logic course, level 1 "Bear goes to the honey". A 4 x 4 grid, the bear on one
// cell and the honey pot on another, 2-4 moves apart (no obstacles). The child plans up to 4
// arrows, then the bear walks them; right = the bear stands on the honey after the LAST arrow.
// SCRUM-289/292: level 2 "Around the stones": 1-2 stones stand in the bear's way, up to 6
// arrows; an arrow into a stone stops the bear like the edge.
import type { AnswerResult } from '../math/engine';
import { shuffled } from '../random';
import { SESSION_SIZES } from '../session';

export const GRID_SIZE = 4;
/** Level 1's arrow limit (and the default of the checker). */
const MAX_ARROWS = 4;

export type LogicLevel = 1 | 2;
export const LOGIC_LEVELS: readonly LogicLevel[] = [1, 2];
/** How many arrows a child may plan per level (scope 3: Level 1 stays 4, Level 2 has 6). */
export const ARROW_LIMIT: Readonly<Record<LogicLevel, number>> = { 1: MAX_ARROWS, 2: 6 };

/** A grid cell, 0-based: row 0 is the top row, col 0 the left column. */
export type Cell = Readonly<{ row: number; col: number }>;
export type Arrow = 'up' | 'down' | 'left' | 'right';
export const ARROWS: readonly Arrow[] = ['up', 'down', 'left', 'right'];

/** One puzzle: where the bear starts, where the honey pot stands and (Level 2) the stones. */
export type BearPuzzle = Readonly<{ bear: Cell; honey: Cell; stones?: readonly Cell[] }>;

/** The displacement from the bear to the honey (dx = columns to the right, dy = rows down). */
type MoveShape = Readonly<{ dx: number; dy: number }>;

const STEP: Record<Arrow, MoveShape> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/** One letter per arrow in the answer string handed to the session checker. */
const LETTER: Record<Arrow, string> = { up: 'U', down: 'D', left: 'L', right: 'R' };
const FROM_LETTER: Record<string, Arrow> = { U: 'up', D: 'down', L: 'left', R: 'right' };

export const encodeArrows = (arrows: readonly Arrow[]) => arrows.map((a) => LETTER[a]).join('');

export function decodeArrows(answer: string): Arrow[] | null {
  const arrows = [...answer].map((letter) => FROM_LETTER[letter]);
  return arrows.every(Boolean) ? arrows : null;
}

export const distance = (shape: MoveShape) => Math.abs(shape.dx) + Math.abs(shape.dy);
const inside = (n: number) => n >= 0 && n < GRID_SIZE;

/** Every move shape that fits the grid with 2-4 moves (32: 8 of 2, 12 of 3, 12 of 4). */
export const MOVE_SHAPES: readonly MoveShape[] = (() => {
  const shapes: MoveShape[] = [];
  for (let dy = 1 - GRID_SIZE; dy < GRID_SIZE; dy++)
    for (let dx = 1 - GRID_SIZE; dx < GRID_SIZE; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d >= 2 && d <= MAX_ARROWS) shapes.push({ dx, dy });
    }
  return shapes;
})();

/** Every bear cell where a shape keeps the honey on the grid. */
export function placements(shape: MoveShape): BearPuzzle[] {
  const out: BearPuzzle[] = [];
  for (let row = 0; row < GRID_SIZE; row++)
    for (let col = 0; col < GRID_SIZE; col++) {
      const honey = { row: row + shape.dy, col: col + shape.dx };
      if (inside(honey.row) && inside(honey.col)) out.push({ bear: { row, col }, honey });
    }
  return out;
}

/** How many puzzles of 2, 3 and 4 moves a lesson has, easier first (scope 2). */
const DISTANCE_MIX: Readonly<Record<number, readonly [number, number, number]>> = {
  5: [2, 2, 1],
  10: [3, 4, 3],
  20: [6, 7, 7],
};

/**
 * A lesson's puzzles: the distance mix in order 2, 3, 4 moves; no move shape twice; each
 * shape at a random cell where it fits. Finite pools, no retries, so it always ends.
 */
export function generateBearSession(
  size: number,
  rng: () => number = Math.random,
): readonly BearPuzzle[] {
  if (!(SESSION_SIZES as readonly number[]).includes(size))
    throw new RangeError('Unsupported session size');
  const mix = DISTANCE_MIX[size];
  return mix.flatMap((count, i) =>
    shuffled(
      MOVE_SHAPES.filter((shape) => distance(shape) === i + 2),
      rng,
    )
      .slice(0, count)
      .map((shape) => {
        const options = placements(shape);
        return options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
      }),
  );
}

/**
 * Where the bear goes: the cells it steps on, whether it bumped (into an edge, or into a stone:
 * then `stone` is that stone's cell), where it ends.
 */
export type Walk = Readonly<{ steps: readonly Cell[]; bumped: boolean; end: Cell; stone?: Cell }>;

export const sameCell = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;

/**
 * The bear walks the arrows one cell each; an arrow off the grid stops it at the edge, an arrow
 * into a stone stops it in front of the stone.
 */
export function walkArrows(
  start: Cell,
  arrows: readonly Arrow[],
  stones: readonly Cell[] = [],
): Walk {
  let at = start;
  const steps: Cell[] = [];
  for (const arrow of arrows) {
    const next = { row: at.row + STEP[arrow].dy, col: at.col + STEP[arrow].dx };
    if (!inside(next.row) || !inside(next.col)) return { steps, bumped: true, end: at };
    if (stones.some((stone) => sameCell(stone, next)))
      return { steps, bumped: true, end: at, stone: next };
    steps.push(next);
    at = next;
  }
  return { steps, bumped: false, end: at };
}

/**
 * Session checker (answer = arrow letters, e.g. "RRD"). No arrows (or more than `limit`) is not
 * an attempt. Right only when every arrow stays on the grid, never walks into a stone, and the
 * LAST one ends on the honey.
 */
export function checkBearPath(
  puzzle: BearPuzzle,
  answer: string,
  limit: number = MAX_ARROWS,
): AnswerResult {
  const arrows = decodeArrows(answer);
  if (!arrows || arrows.length === 0 || arrows.length > limit) return 'invalid-input';
  const walk = walkArrows(puzzle.bear, arrows, puzzle.stones);
  return !walk.bumped && sameCell(walk.end, puzzle.honey) ? 'correct' : 'incorrect';
}

/** The checker for a level (its arrow limit). */
export const bearChecker =
  (level: LogicLevel) =>
  (puzzle: BearPuzzle, answer: string): AnswerResult =>
    checkBearPath(puzzle, answer, ARROW_LIMIT[level]);

// ---------------------------------------------------------------------------------------------
// Level 2: stones (SCRUM-292).

/**
 * The fewest arrows from the bear to the honey around the stones on the 4 x 4 grid (breadth-
 * first search), or null when the honey cannot be reached.
 */
export function shortestPath(puzzle: BearPuzzle): number | null {
  const key = (c: Cell) => c.row * GRID_SIZE + c.col;
  const blocked = new Set((puzzle.stones ?? []).map(key));
  const seen = new Map([[key(puzzle.bear), 0]]);
  const queue: Cell[] = [puzzle.bear];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    const d = seen.get(key(at))!;
    if (sameCell(at, puzzle.honey)) return d;
    for (const arrow of ARROWS) {
      const next = { row: at.row + STEP[arrow].dy, col: at.col + STEP[arrow].dx };
      if (!inside(next.row) || !inside(next.col) || blocked.has(key(next)) || seen.has(key(next)))
        continue;
      seen.set(key(next), d + 1);
      queue.push(next);
    }
  }
  return null;
}

/**
 * A stone layout as the child meets it, wherever it stands on the grid: the honey's offset from
 * the bear and the stones' offsets from the bear (sorted). "No layout twice in a lesson" means
 * no relative layout twice.
 */
type StoneLayout = Readonly<{
  shape: MoveShape;
  stones: readonly MoveShape[];
  /** The fewest arrows on the grid (the best placements). */
  length: number;
}>;

const PLACEMENTS = new WeakMap<StoneLayout, readonly BearPuzzle[]>();
/** A layout's usable placements (worked out once per layout). */
function layoutPlacements(layout: StoneLayout): readonly BearPuzzle[] {
  let found = PLACEMENTS.get(layout);
  if (!found) PLACEMENTS.set(layout, (found = stonePlacements(layout, layout.length)));
  return found;
}

/** Lesson tiers, easier first (scope 4): A free way 2-3 moves, B round 4-5, C round 6. */
type StoneTier = 'A' | 'B' | 'C';

export const layoutKey = (layout: Pick<StoneLayout, 'shape' | 'stones'>) =>
  `${layout.shape.dx},${layout.shape.dy}:${layout.stones.map((s) => `${s.dx},${s.dy}`).join(';')}`;

const at = (bear: Cell, offset: MoveShape): Cell => ({
  row: bear.row + offset.dy,
  col: bear.col + offset.dx,
});

/** The puzzle of a layout with the bear on `bear` (cells may lie off the grid). */
const layoutPuzzle = (layout: Pick<StoneLayout, 'shape' | 'stones'>, bear: Cell) => ({
  bear,
  honey: at(bear, layout.shape),
  stones: layout.stones.map((offset) => at(bear, offset)),
});

const onGrid = (c: Cell) => inside(c.row) && inside(c.col);

/**
 * Every bear cell where the layout stands wholly on the grid and the fewest arrows equal
 * `length` (near the edges some placements are longer or blocked: those are never used).
 */
function stonePlacements(
  layout: Pick<StoneLayout, 'shape' | 'stones'>,
  length: number,
): BearPuzzle[] {
  const out: BearPuzzle[] = [];
  for (let row = 0; row < GRID_SIZE; row++)
    for (let col = 0; col < GRID_SIZE; col++) {
      const puzzle = layoutPuzzle(layout, { row, col });
      if (!onGrid(puzzle.honey) || !puzzle.stones.every(onGrid)) continue;
      if (shortestPath(puzzle) === length) out.push(puzzle);
    }
  return out;
}

/**
 * Every stone layout (scope 2): 1-2 stones on cells of the bear-honey bounding rectangle other
 * than the bear's and the honey's (so each stone is on a shortest route and blocks at least
 * one), solvable within 6 arrows on some placement on the grid. 1,224 layouts.
 */
export const STONE_LAYOUTS: readonly StoneLayout[] = (() => {
  const layouts: StoneLayout[] = [];
  const limit = ARROW_LIMIT[2];
  for (let dy = 1 - GRID_SIZE; dy < GRID_SIZE; dy++)
    for (let dx = 1 - GRID_SIZE; dx < GRID_SIZE; dx++) {
      if (dx === 0 && dy === 0) continue;
      const shape = { dx, dy };
      const cells: MoveShape[] = [];
      for (let y = Math.min(0, dy); y <= Math.max(0, dy); y++)
        for (let x = Math.min(0, dx); x <= Math.max(0, dx); x++)
          if (!(x === 0 && y === 0) && !(x === dx && y === dy)) cells.push({ dx: x, dy: y });
      const sets: MoveShape[][] = [];
      cells.forEach((a, i) => {
        sets.push([a]);
        for (const b of cells.slice(i + 1)) sets.push([a, b]);
      });
      for (const stones of sets) {
        let length: number | null = null;
        for (let row = 0; row < GRID_SIZE; row++)
          for (let col = 0; col < GRID_SIZE; col++) {
            const puzzle = layoutPuzzle({ shape, stones }, { row, col });
            if (!onGrid(puzzle.honey) || !puzzle.stones.every(onGrid)) continue;
            const d = shortestPath(puzzle);
            if (d !== null && (length === null || d < length)) length = d;
          }
        if (length !== null && length <= limit) layouts.push({ shape, stones, length });
      }
    }
  return layouts;
})();

/** The tier of a layout, or null when it belongs to none (free ways of 4+ moves). */
function stoneTier(layout: StoneLayout): StoneTier | null {
  const straight = distance(layout.shape);
  if (layout.length === straight) return straight <= 3 ? 'A' : null;
  return layout.length <= 5 ? 'B' : 'C';
}

export const TIER_LAYOUTS: Readonly<Record<StoneTier, readonly StoneLayout[]>> = {
  A: STONE_LAYOUTS.filter((l) => stoneTier(l) === 'A'),
  B: STONE_LAYOUTS.filter((l) => stoneTier(l) === 'B'),
  C: STONE_LAYOUTS.filter((l) => stoneTier(l) === 'C'),
};

/** How many puzzles of tier A, B and C a Level 2 lesson has, easier first (scope 4). */
const TIER_MIX: Readonly<Record<number, readonly [number, number, number]>> = {
  5: [1, 2, 2],
  10: [2, 4, 4],
  20: [4, 8, 8],
};

const pick = <T>(options: readonly T[], rng: () => number) =>
  options[Math.min(options.length - 1, Math.floor(rng() * options.length))];

/**
 * A Level 2 lesson: tiers A, B, C in that order (shorter ways first inside a tier), no layout
 * twice, each layout at a random cell where it fits with its own fewest arrows. Finite pools,
 * no retries, so it always ends.
 */
export function generateStoneSession(
  size: number,
  rng: () => number = Math.random,
): readonly BearPuzzle[] {
  if (!(SESSION_SIZES as readonly number[]).includes(size))
    throw new RangeError('Unsupported session size');
  return (['A', 'B', 'C'] as const).flatMap((tier, i) =>
    shuffled(TIER_LAYOUTS[tier], rng)
      .slice(0, TIER_MIX[size][i])
      .sort((a, b) => a.length - b.length)
      .map((layout) => pick(layoutPlacements(layout), rng)),
  );
}
