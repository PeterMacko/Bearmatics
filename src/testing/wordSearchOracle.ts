// SCRUM-244: an independent checker for word search grids (tests only, never imported by the
// app). It does not use the engine's line reader or word counter: it walks every cell in each
// of the 8 (dr, dc) steps with its own bounds test, and sends every run of 3+ letters in every
// direction through the shared SK/EN rude-word filter.
import { isRudeNickname } from '../../shared/rules';
import { GRID_RUDE_WORDS } from '../wordsearch/gridRudeWords';
import {
  generatePuzzle,
  newStats,
  SEARCH_WORDS,
  type Puzzle,
  type SearchLevel,
} from '../wordsearch/grid';

const STEPS = [-1, 0, 1]
  .flatMap((dr) => [-1, 0, 1].map((dc) => [dr, dc] as const))
  .filter(([dr, dc]) => dr !== 0 || dc !== 0);

export type Hit = { row: number; col: number; dr: number; dc: number };

/** Every place `word` can be read (capital letters), in all 8 directions. */
export function scan(rows: readonly string[], word: string): Hit[] {
  const target = word.toUpperCase();
  const hits: Hit[] = [];
  for (let row = 0; row < rows.length; row++)
    for (let col = 0; col < rows[row].length; col++)
      for (const [dr, dc] of STEPS) {
        let ok = true;
        for (let i = 0; i < target.length && ok; i++) {
          const r = row + i * dr;
          const c = col + i * dc;
          ok =
            r >= 0 && r < rows.length && c >= 0 && c < rows[r].length && rows[r][c] === target[i];
        }
        if (ok) hits.push({ row, col, dr, dc });
      }
  return hits;
}

/** Every run of 3 or more letters, from every cell in every direction. */
export function runs(rows: readonly string[]): string[] {
  const out: string[] = [];
  for (let row = 0; row < rows.length; row++)
    for (let col = 0; col < rows[row].length; col++)
      for (const [dr, dc] of STEPS) {
        let text = rows[row][col];
        for (let i = 1; ; i++) {
          const r = row + i * dr;
          const c = col + i * dc;
          if (r < 0 || r >= rows.length || c < 0 || c >= rows[r].length) break;
          text += rows[r][c];
          if (text.length >= 3) out.push(text);
        }
      }
  return out;
}

// The filter's answer per run, remembered (speed only; the filter itself decides).
const rudeRuns = new Map<string, boolean>();
const rudeRun = (run: string) => {
  if (!rudeRuns.has(run)) rudeRuns.set(run, GRID_RUDE_WORDS.has(run) || isRudeNickname(run));
  return rudeRuns.get(run)!;
};

/** Levels 1-2: left to right (0,1) and top to bottom (1,0) only. */
export const SIMPLE_STEPS = new Set(['0,1', '1,0']);

/** Every broken rule of one grid, in words (empty = a good grid). */
export function gridProblems(
  puzzle: Puzzle,
  level: SearchLevel,
  words: readonly string[],
): string[] {
  const problems: string[] = [];
  if (puzzle.rows.length !== 6) problems.push(`${puzzle.rows.length} rows`);
  for (const row of puzzle.rows) if (!/^[A-Z]{6}$/.test(row)) problems.push(`row ${row}`);
  const listed = puzzle.words.map((w) => w.word);
  if (listed.join() !== words.join()) problems.push(`words ${listed.join()}`);
  for (const placed of puzzle.words) {
    const hits = scan(puzzle.rows, placed.word);
    if (hits.length !== 1) {
      problems.push(`${placed.word} found ${hits.length} times`);
      continue;
    }
    const [hit] = hits;
    if (
      hit.row !== placed.start.row ||
      hit.col !== placed.start.col ||
      hit.dr !== placed.direction.dr ||
      hit.dc !== placed.direction.dc
    )
      problems.push(`${placed.word} is not where the engine says`);
    const last = placed.cells[placed.cells.length - 1];
    if (
      placed.cells.length !== placed.word.length ||
      last.row !== hit.row + (placed.word.length - 1) * hit.dr ||
      last.col !== hit.col + (placed.word.length - 1) * hit.dc
    )
      problems.push(`${placed.word} cells`);
    if (level !== 3 && !SIMPLE_STEPS.has(`${hit.dr},${hit.dc}`))
      problems.push(`${placed.word} direction ${hit.dr},${hit.dc} on level ${level}`);
  }
  for (const other of SEARCH_WORDS)
    if (!words.includes(other) && scan(puzzle.rows, other).length > 0)
      problems.push(`other word ${other}`);
  for (const run of runs(puzzle.rows)) if (rudeRun(run)) problems.push(`rude ${run}`);
  return problems;
}

export type BulkResult = {
  level: SearchLevel;
  grids: number;
  failures: number;
  badGrids: string[];
  attemptsAverage: number;
  attemptsMax: number;
  rejected: Record<'placement' | 'repeat' | 'other' | 'rude', number>;
  rudeGrids: number;
  otherGrids: number;
  msPerGrid: number;
};

/**
 * The acceptance run: `grids` grids of 5 random different words on one level (seeded), each
 * checked here. Returns the statistics the report lists.
 */
export function bulkRun(level: SearchLevel, grids: number, rng: () => number): BulkResult {
  const total = newStats();
  let attemptsMax = 0;
  let failures = 0;
  let rudeGrids = 0;
  let otherGrids = 0;
  let time = 0;
  const badGrids: string[] = [];
  for (let i = 0; i < grids; i++) {
    const words = SEARCH_WORDS.map((word) => ({ word, key: rng() }))
      .sort((a, b) => a.key - b.key)
      .slice(0, 5)
      .map((w) => w.word);
    const stats = newStats();
    const started = performance.now();
    const puzzle = generatePuzzle(words, level, rng, stats);
    time += performance.now() - started;
    if (!puzzle) {
      failures++;
      continue;
    }
    total.attempts += stats.attempts;
    for (const key of ['placement', 'repeat', 'other', 'rude'] as const)
      total.rejected[key] += stats.rejected[key];
    if (stats.rejected.rude) rudeGrids++;
    if (stats.rejected.other) otherGrids++;
    attemptsMax = Math.max(attemptsMax, stats.attempts);
    const problems = gridProblems(puzzle, level, words);
    if (problems.length) badGrids.push(`${puzzle.rows.join('/')}: ${problems.join('; ')}`);
  }
  return {
    level,
    grids,
    failures,
    badGrids,
    attemptsAverage: total.attempts / (grids - failures),
    attemptsMax,
    rejected: total.rejected,
    rudeGrids,
    otherGrids,
    msPerGrid: time / grids,
  };
}

/** One line for the test output (the report quotes it). */
export const bulkLine = (r: BulkResult) =>
  `[wordsearch-stats] level ${r.level}: grids ${r.grids}, failures ${r.failures}, bad grids ${r.badGrids.length}, attempts avg ${r.attemptsAverage.toFixed(3)} max ${r.attemptsMax}, rejected ${JSON.stringify(r.rejected)}, grids that hit the rude filter ${r.rudeGrids}, grids that hit another list word ${r.otherGrids}, time per grid ${r.msPerGrid.toFixed(3)} ms\n`;
