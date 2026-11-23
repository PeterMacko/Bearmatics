// SCRUM-262: Logic course, level 1 "Bear goes to the honey". A 4 x 4 grid, the bear on one
// cell and the honey pot on another, 2-4 moves apart (no obstacles). The child plans up to 4
// arrows, then the bear walks them; right = the bear stands on the honey after the LAST arrow.
import type { AnswerResult } from '../math/engine';
import { shuffled } from '../random';
import { SESSION_SIZES } from '../session';

export const GRID_SIZE = 4;
export const MAX_ARROWS = 4;

/** A grid cell, 0-based: row 0 is the top row, col 0 the left column. */
export type Cell = Readonly<{ row: number; col: number }>;
export type Arrow = 'up' | 'down' | 'left' | 'right';
export const ARROWS: readonly Arrow[] = ['up', 'down', 'left', 'right'];

/** One puzzle: where the bear starts and where the honey pot stands. */
export type BearPuzzle = Readonly<{ bear: Cell; honey: Cell }>;

/** The displacement from the bear to the honey (dx = columns to the right, dy = rows down). */
export type MoveShape = Readonly<{ dx: number; dy: number }>;

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
export const DISTANCE_MIX: Readonly<Record<number, readonly [number, number, number]>> = {
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

/** Where the bear goes: the cells it steps on, whether it bumped into an edge, where it ends. */
export type Walk = Readonly<{ steps: readonly Cell[]; bumped: boolean; end: Cell }>;

/** The bear walks the arrows one cell each; an arrow off the grid stops it at the edge. */
export function walkArrows(start: Cell, arrows: readonly Arrow[]): Walk {
  let at = start;
  const steps: Cell[] = [];
  for (const arrow of arrows) {
    const next = { row: at.row + STEP[arrow].dy, col: at.col + STEP[arrow].dx };
    if (!inside(next.row) || !inside(next.col)) return { steps, bumped: true, end: at };
    steps.push(next);
    at = next;
  }
  return { steps, bumped: false, end: at };
}

export const sameCell = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;

/**
 * Session checker (answer = arrow letters, e.g. "RRD"). No arrows (or more than 4) is not an
 * attempt. Right only when every arrow stays on the grid and the LAST one ends on the honey.
 */
export function checkBearPath(puzzle: BearPuzzle, answer: string): AnswerResult {
  const arrows = decodeArrows(answer);
  if (!arrows || arrows.length === 0 || arrows.length > MAX_ARROWS) return 'invalid-input';
  const walk = walkArrows(puzzle.bear, arrows);
  return !walk.bumped && sameCell(walk.end, puzzle.honey) ? 'correct' : 'incorrect';
}
