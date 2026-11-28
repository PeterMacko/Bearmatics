// SCRUM-299 / SCRUM-300: Logic Levels 3-5 "What comes next?" picture patterns. The child sees a
// row of pictures that follows a rule and picks the picture for the "?" place.
// Level 3: 2 pictures repeating as AB, AAB or ABB; 6 shown, "?" at place 7; 3 choices.
// Level 4: ABC, AABB or ABCB in 8 places, the "?" at place 8 (end) or inside at places 5-7 (so
//          at least one full repeat is always visible before it); 4 choices.
// Level 5: groups of one picture growing or shrinking by 1 (dice layout, counts 1-6), or an
//          arrow turning by a quarter turn each step; 3 shown + "?"; 3 choices.
// Pictures are the Small maths motifs and the Logic arrows (no new art).
import type { AnswerResult } from '../math/engine';
import { PICTURE_THEMES, type PictureTheme } from '../PictureGroup';
import { pickOne, shuffled } from '../../shared/random';
import { isSessionSize } from '../session';
import type { Arrow } from './bearPath';

export type PatternLevel = 3 | 4 | 5;
export const PATTERN_LEVELS: readonly PatternLevel[] = [3, 4, 5];

/** One picture in a row or a choice: a motif, a dice group of one motif, or an arrow. */
export type PatternItem =
  | Readonly<{ kind: 'motif'; motif: PictureTheme }>
  | Readonly<{ kind: 'count'; motif: PictureTheme; count: number }>
  | Readonly<{ kind: 'arrow'; arrow: Arrow }>;

type PatternType =
  | 'AB'
  | 'AAB' // also ABB: the same rows with the two pictures swapped (see L3 pool)
  | 'ABC'
  | 'AABB'
  | 'ABCB'
  | 'grow'
  | 'shrink'
  | 'turn';

/** One row: every place (the hidden one included), where the "?" is and the choices in order. */
export type PatternRow = Readonly<{
  level: PatternLevel;
  type: PatternType;
  places: readonly PatternItem[];
  gap: number;
  choices: readonly PatternItem[];
}>;

/** A row without its choices (the pools). */
type PatternPuzzle = Omit<PatternRow, 'choices'>;

/** A stable text key per picture; the answer string handed to the session checker. */
export function itemKey(item: PatternItem): string {
  if (item.kind === 'motif') return `m:${item.motif}`;
  if (item.kind === 'count') return `c:${item.motif}:${item.count}`;
  return `a:${item.arrow}`;
}

/** The row as the child sees it ("?" for the gap): "no row twice" compares this. */
export const displayedKey = (row: Pick<PatternRow, 'places' | 'gap'>) =>
  row.places.map((item, i) => (i === row.gap ? '?' : itemKey(item))).join(' ');

export const answerOf = (row: Pick<PatternRow, 'places' | 'gap'>) => row.places[row.gap];

const motif = (m: PictureTheme): PatternItem => ({ kind: 'motif', motif: m });

/** Every sequence of `length` places repeating `unit` (letters index `pictures`), any phase. */
function repeats(unit: string, pictures: readonly PictureTheme[], length: number) {
  const out: PatternItem[][] = [];
  for (let phase = 0; phase < unit.length; phase++)
    out.push(
      Array.from({ length }, (_, i) =>
        motif(pictures[unit.charCodeAt((i + phase) % unit.length) - 65]),
      ),
    );
  return out;
}

/** Ordered picks of `n` different motifs (5 x 4 = 20 pairs, 5 x 4 x 3 = 60 triples). */
function picks(n: number): PictureTheme[][] {
  if (n === 0) return [[]];
  return picks(n - 1).flatMap((head) =>
    PICTURE_THEMES.filter((m) => !head.includes(m)).map((m) => [...head, m]),
  );
}

/** Adds rows to `pool` unless the displayed row is already there (first type wins). */
function addUnique(pool: PatternPuzzle[], seen: Set<string>, row: PatternPuzzle) {
  const key = displayedKey(row);
  if (seen.has(key)) return;
  seen.add(key);
  pool.push(row);
}

/**
 * Level 3: 7 places, the "?" at place 7. AB 20 rows; AAB/ABB 60 rows (AAB started at its 3rd
 * place, B A A ..., is ABB with the pictures swapped: deduped by the displayed row). 80 rows.
 */
export const LEVEL3_POOL: readonly PatternPuzzle[] = (() => {
  const pool: PatternPuzzle[] = [];
  const seen = new Set<string>();
  for (const type of ['AB', 'AAB', 'ABB'] as const)
    for (const pair of picks(2))
      for (const places of repeats(type, pair, 7))
        addUnique(pool, seen, { level: 3, type: type === 'ABB' ? 'AAB' : type, places, gap: 6 });
  return pool;
})();

/** Level 4: the "?" may stand at places 5-8 (index 4-7). */
const LEVEL4_GAPS: readonly number[] = [4, 5, 6, 7];

/**
 * Level 4: 220 distinct 8-place sequences (ABC 60, AABB 40, ABCB 120) x 4 "?" places = 880.
 */
export const LEVEL4_POOL: readonly PatternPuzzle[] = (() => {
  const pool: PatternPuzzle[] = [];
  const seen = new Set<string>();
  const units = [
    ['ABC', 3],
    ['AABB', 2],
    ['ABCB', 3],
  ] as const;
  for (const gap of LEVEL4_GAPS)
    for (const [type, n] of units)
      for (const pictures of picks(n))
        for (const places of repeats(type, pictures, 8))
          addUnique(pool, seen, { level: 4, type, places, gap });
  return pool;
})();

/** Arrows clockwise from up (a quarter turn = one step in this list). */
const CLOCKWISE: readonly Arrow[] = ['up', 'right', 'down', 'left'];
const turn = (arrow: Arrow, by: number): Arrow =>
  CLOCKWISE[(CLOCKWISE.indexOf(arrow) + by + 4) % 4];

/**
 * Level 5: counts 1-6 as 3 groups + "?" growing or shrinking by 1 (6 runs per motif x 5 = 30),
 * and an arrow turning by a quarter turn each step (4 starts x 2 ways = 8). 38 rows.
 */
export const LEVEL5_POOL: readonly PatternPuzzle[] = (() => {
  const pool: PatternPuzzle[] = [];
  for (const type of ['grow', 'shrink'] as const)
    for (const m of PICTURE_THEMES)
      for (let first = 1; first <= 3; first++) {
        const counts = [0, 1, 2, 3].map((i) => (type === 'grow' ? first + i : 7 - first - i));
        pool.push({
          level: 5,
          type,
          places: counts.map((count) => ({ kind: 'count', motif: m, count })),
          gap: 3,
        });
      }
  for (const way of [1, -1])
    for (const start of CLOCKWISE)
      pool.push({
        level: 5,
        type: 'turn',
        places: [0, 1, 2, 3].map((i) => ({ kind: 'arrow', arrow: turn(start, way * i) })),
        gap: 3,
      });
  return pool;
})();

/** How many choices a row of each level offers. */
export const CHOICE_COUNT: Readonly<Record<PatternLevel, number>> = { 3: 3, 4: 4, 5: 3 };

/**
 * The wrong choices of a row. L3/L4: the row's other pictures, then motifs not in the row up to
 * the level's choice count. L5 counts: same motif, answer +-1 (one side outside 1-6: the other
 * side twice, e.g. 6 -> 5 and 4). L5 arrows: the "turned the other way" direction plus one of
 * the other two.
 */
export function distractors(puzzle: PatternPuzzle, rng: () => number): PatternItem[] {
  const answer = answerOf(puzzle);
  if (answer.kind === 'count') {
    const { count, motif: m } = answer;
    const counts = count === 6 ? [5, 4] : count === 1 ? [2, 3] : [count - 1, count + 1];
    return counts.map((c) => ({ kind: 'count', motif: m, count: c }));
  }
  if (answer.kind === 'arrow') {
    const before = puzzle.places[puzzle.gap - 1];
    const prior = puzzle.places[puzzle.gap - 2];
    if (before.kind !== 'arrow' || prior.kind !== 'arrow') throw new Error('Arrow row expected');
    const way = CLOCKWISE.indexOf(before.arrow) - CLOCKWISE.indexOf(prior.arrow);
    const otherWay = turn(before.arrow, -((way + 4) % 4 === 1 ? 1 : -1));
    const rest = CLOCKWISE.filter((a) => a !== answer.arrow && a !== otherWay);
    return [
      { kind: 'arrow', arrow: otherWay },
      { kind: 'arrow', arrow: pickOne(rest, rng) },
    ];
  }
  const inRow = [...new Set(puzzle.places.map((p) => (p.kind === 'motif' ? p.motif : null)))];
  const others = shuffled(
    PICTURE_THEMES.filter((m) => !inRow.includes(m)),
    rng,
  );
  const wrong = inRow.filter((m): m is PictureTheme => m !== null && m !== answer.motif);
  return [...wrong, ...others].slice(0, CHOICE_COUNT[puzzle.level] - 1).map(motif);
}

/** A row with its choices (the answer and the distractors) in random order. */
export function withChoices(puzzle: PatternPuzzle, rng: () => number): PatternRow {
  return { ...puzzle, choices: shuffled([answerOf(puzzle), ...distractors(puzzle, rng)], rng) };
}

/**
 * How many rows of each group a lesson has, easier first (Dev's split): L3 AB / AAB-ABB;
 * L4 "?" at the end / inside; L5 growing / shrinking / turning arrows.
 */
const LESSON_MIX: Readonly<Record<PatternLevel, Readonly<Record<number, readonly number[]>>>> = {
  3: { 5: [2, 3], 10: [4, 6], 20: [8, 12] },
  4: { 5: [2, 3], 10: [4, 6], 20: [8, 12] },
  5: { 5: [2, 1, 2], 10: [3, 3, 4], 20: [6, 6, 8] },
};

/** The lesson groups of a level's pool in the order they are met. */
function lessonGroups(level: PatternLevel): readonly (readonly PatternPuzzle[])[] {
  if (level === 3)
    return [LEVEL3_POOL.filter((r) => r.type === 'AB'), LEVEL3_POOL.filter((r) => r.type !== 'AB')];
  if (level === 4)
    return [
      LEVEL4_POOL.filter((r) => r.gap === r.places.length - 1),
      LEVEL4_POOL.filter((r) => r.gap !== r.places.length - 1),
    ];
  return (['grow', 'shrink', 'turn'] as const).map((type) =>
    LEVEL5_POOL.filter((r) => r.type === type),
  );
}

const sequenceKey = (row: PatternPuzzle) => row.places.map(itemKey).join(' ');

/**
 * A lesson: the level's groups in order (easier first), no displayed row twice (and on Level 4
 * no picture sequence twice, even with the "?" elsewhere), choices in random order. Finite
 * shuffled pools, no retries, so it always ends.
 */
export function generatePatternSession(
  level: PatternLevel,
  size: number,
  rng: () => number = Math.random,
): readonly PatternRow[] {
  if (!PATTERN_LEVELS.includes(level) || !isSessionSize(size))
    throw new RangeError('Unsupported session settings');
  const used = new Set<string>();
  const groups = lessonGroups(level);
  return LESSON_MIX[level][size].flatMap((count, i) => {
    const rows: PatternRow[] = [];
    for (const puzzle of shuffled(groups[i], rng)) {
      if (rows.length === count) break;
      const key = sequenceKey(puzzle);
      if (used.has(key)) continue;
      used.add(key);
      rows.push(withChoices(puzzle, rng));
    }
    if (rows.length !== count) throw new Error('Pattern pool too small');
    return rows;
  });
}

/** Session checker: the answer is the tapped picture's key; nothing tapped is not a try. */
export function checkPattern(row: PatternRow, answer: string): AnswerResult {
  if (!answer || !row.choices.some((choice) => itemKey(choice) === answer)) return 'invalid-input';
  return answer === itemKey(answerOf(row)) ? 'correct' : 'incorrect';
}
