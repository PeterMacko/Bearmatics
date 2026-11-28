// A square of a board: the Logic bear path board and the Word search grid.

/** A grid cell, 0-based: row 0 is the top row, col 0 the left column. */
export type Cell = Readonly<{ row: number; col: number }>;

export const sameCell = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;

/** Every square of a `size` x `size` board, row by row. */
export const boardCells = (size: number): Cell[] =>
  Array.from({ length: size * size }, (_, i) => ({
    row: Math.floor(i / size),
    col: i % size,
  }));
