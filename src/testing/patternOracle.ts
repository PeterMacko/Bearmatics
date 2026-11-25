// SCRUM-300: an independent rule checker for "What comes next?" rows. It never uses the
// engine's answer or pools: a picture is right when the filled row follows a rule the child can
// see (a repeat for Levels 3-4, +-1 counts of one picture, or quarter turns of one arrow).
import { generatePatternSession, type PatternItem, type PatternRow } from '../logic/patterns';

type Shown = { places: readonly (PatternItem | null)[] };

/** Screen vectors (y grows downwards); a clockwise quarter turn maps (x, y) to (-y, x). */
const VECTOR = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] } as const;

/** Is the filled row right by the rules the child can see? */
export function oracleRight(row: Shown, candidate: PatternItem): boolean {
  const places = row.places.map((p) => p ?? candidate);
  const kinds = new Set(places.map((p) => p.kind));
  if (kinds.size !== 1) return false;
  if (places[0].kind === 'motif') {
    // A repeat of 2-4 pictures, seen fully at least twice in the row.
    const keys = places.map((p) => (p.kind === 'motif' ? p.motif : ''));
    for (let period = 2; period <= 4 && 2 * period <= keys.length; period++)
      if (keys.every((k, i) => i < period || k === keys[i - period])) return true;
    return false;
  }
  if (places[0].kind === 'count') {
    const counts = places.map((p) => (p.kind === 'count' ? p.count : NaN));
    const motifs = new Set(places.map((p) => (p.kind === 'count' ? p.motif : '')));
    if (motifs.size !== 1 || counts.some((c) => c < 1 || c > 6)) return false;
    const step = counts[1] - counts[0];
    return Math.abs(step) === 1 && counts.every((c, i) => i === 0 || c - counts[i - 1] === step);
  }
  const vectors = places.map((p) => (p.kind === 'arrow' ? VECTOR[p.arrow] : [0, 0]));
  const cw = (v: readonly number[]) => [-v[1], v[0]];
  const ccw = (v: readonly number[]) => [v[1], -v[0]];
  const steps = (turn: (v: readonly number[]) => number[]) =>
    vectors.every((v, i) => i === 0 || same2(turn(vectors[i - 1]), v));
  return steps(cw) || steps(ccw);
}
const same2 = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1];

export const shownOf = (row: Pick<PatternRow, 'places' | 'gap'>): Shown => ({
  places: row.places.map((p, i) => (i === row.gap ? null : p)),
});

/** Problems with one generated row, checked independently ([] = fine). */
export function rowProblems(row: PatternRow, choiceCount: number): string[] {
  const problems: string[] = [];
  const shown = shownOf(row);
  const right = row.choices.filter((c) => oracleRight(shown, c));
  if (right.length !== 1) problems.push(`${right.length} right choices`);
  if (row.choices.length !== choiceCount) problems.push(`${row.choices.length} choices`);
  const keys = new Set(row.choices.map((c) => JSON.stringify(c)));
  if (keys.size !== row.choices.length) problems.push('a choice twice');
  for (const item of [...row.places, ...row.choices])
    if (
      item.kind === 'count' &&
      !(Number.isInteger(item.count) && item.count >= 1 && item.count <= 6)
    )
      problems.push(`count ${item.count}`);
  if (!oracleRight(shown, row.places[row.gap])) problems.push('hidden picture not right');
  return problems;
}

export type BulkResult = {
  lessons: number;
  failures: number;
  examples: string[];
  ms: number;
  maxMs: number;
};

/** Generates many lessons and checks every row, the lesson size and "no displayed row twice". */
export function bulkRun(
  level: 3 | 4 | 5,
  size: number,
  lessons: number,
  rng: () => number,
  choiceCount: number,
  easierFirst: (rows: readonly PatternRow[]) => boolean,
): BulkResult {
  const result: BulkResult = { lessons, failures: 0, examples: [], ms: 0, maxMs: 0 };
  for (let n = 0; n < lessons; n++) {
    let problems: string[] = [];
    const start = performance.now();
    let rows: readonly PatternRow[] = [];
    try {
      rows = generatePatternSession(level, size, rng);
    } catch (error) {
      problems.push(String(error));
    }
    const ms = performance.now() - start;
    result.ms += ms;
    result.maxMs = Math.max(result.maxMs, ms);
    if (rows.length !== size) problems.push(`${rows.length} rows`);
    const displayed = rows.map((r) =>
      r.places.map((p, i) => (i === r.gap ? '?' : JSON.stringify(p))).join(' '),
    );
    if (new Set(displayed).size !== displayed.length) problems.push('a row twice');
    if (!easierFirst(rows)) problems.push('not easier first');
    for (const row of rows) problems = problems.concat(rowProblems(row, choiceCount));
    if (problems.length) {
      result.failures++;
      if (result.examples.length < 5) result.examples.push(problems.join('; '));
    }
  }
  return result;
}

export const bulkLine = (level: number, size: number, r: BulkResult) =>
  `Level ${level} size ${size}: ${r.lessons} lessons, ${r.failures} failures, ` +
  `${(r.ms / r.lessons).toFixed(3)} ms per lesson (max ${r.maxMs.toFixed(2)} ms)\n`;
