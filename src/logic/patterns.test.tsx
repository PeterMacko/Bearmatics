import { describe, expect, test } from 'vitest';
import { PICTURE_THEMES } from '../PictureGroup';
import { seeded } from '../testing/seeded';
import { oracleRight, rowProblems, shownOf } from '../testing/patternOracle';
import {
  answerOf,
  CHOICE_COUNT,
  checkPattern,
  displayedKey,
  generatePatternSession,
  itemKey,
  LEVEL3_POOL,
  LEVEL4_POOL,
  LEVEL5_POOL,
  withChoices,
  type PatternItem,
  type PatternRow,
} from './patterns';

const motif = (m: (typeof PICTURE_THEMES)[number]): PatternItem => ({ kind: 'motif', motif: m });
const count = (n: number, m: (typeof PICTURE_THEMES)[number] = 'bears'): PatternItem => ({
  kind: 'count',
  motif: m,
  count: n,
});
const typeCounts = (rows: readonly { type: string }[]) =>
  rows.reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.type]: (acc[r.type] ?? 0) + 1 }),
    {},
  );

describe('pools (Dev-verified counts: unit = distinct displayed row)', () => {
  test('Level 3: 80 rows (AB 20, AAB/ABB 60), "?" at place 7', () => {
    expect(LEVEL3_POOL).toHaveLength(80);
    expect(new Set(LEVEL3_POOL.map(displayedKey)).size).toBe(80);
    expect(typeCounts(LEVEL3_POOL)).toEqual({ AB: 20, AAB: 60 });
    for (const row of LEVEL3_POOL) {
      expect(row.places).toHaveLength(7);
      expect(row.gap).toBe(6);
      expect(new Set(row.places.map(itemKey)).size).toBe(2);
    }
  });

  test('Level 3 brute force: every 6-picture row with exactly one right 7th of 2 pictures = the pool', () => {
    // Independent enumeration over all 5^6 rows of the 5 motifs.
    const found = new Set<string>();
    const total = 5 ** 6;
    for (let n = 0; n < total; n++) {
      const shown = Array.from({ length: 6 }, (_, i) =>
        motif(PICTURE_THEMES[Math.floor(n / 5 ** i) % 5]),
      );
      if (new Set(shown.map(itemKey)).size !== 2) continue;
      const row = { places: [...shown, null] };
      const right = PICTURE_THEMES.filter((m) => oracleRight(row, motif(m)));
      if (right.length === 1) found.add([...shown.map(itemKey), '?'].join(' '));
    }
    expect(found.size).toBe(80);
    expect(new Set(LEVEL3_POOL.map(displayedKey))).toEqual(found);
  });

  test('Level 4: 220 sequences (ABC 60, AABB 40, ABCB 120) x 4 "?" places (5-8) = 880', () => {
    expect(LEVEL4_POOL).toHaveLength(880);
    expect(new Set(LEVEL4_POOL.map(displayedKey)).size).toBe(880);
    expect(typeCounts(LEVEL4_POOL)).toEqual({ ABC: 240, AABB: 160, ABCB: 480 });
    const sequences = new Set(LEVEL4_POOL.map((r) => r.places.map(itemKey).join(' ')));
    expect(sequences.size).toBe(220);
    const gaps = typeCounts(LEVEL4_POOL.map((r) => ({ type: String(r.gap) })));
    expect(gaps).toEqual({ 4: 220, 5: 220, 6: 220, 7: 220 });
    for (const row of LEVEL4_POOL) expect(row.places).toHaveLength(8);
  });

  test('Level 4 brute force: 8-place repeats of 3 or 4 with ABC / AABB / ABCB shape = 220', () => {
    // Independent: all 5^8 sequences; keep those whose smallest repeat is 3 (3 different
    // pictures) or 4 (a unit that, up to turning and renaming, reads AABB or ABCB).
    const shape = (unit: number[]) => {
      const names = new Map<number, string>();
      return unit
        .map((u) => names.get(u) ?? (names.set(u, 'ABCD'[names.size]), names.get(u)!))
        .join('');
    };
    const rotations = (unit: number[]) =>
      unit.map((_, r) => [...unit.slice(r), ...unit.slice(0, r)]);
    let found = 0;
    const byShape: Record<string, number> = {};
    for (let n = 0; n < 5 ** 8; n++) {
      const seq = Array.from({ length: 8 }, (_, i) => Math.floor(n / 5 ** i) % 5);
      let period = 0;
      for (let p = 1; p <= 4 && !period; p++)
        if (seq.every((s, i) => i < p || s === seq[i - p])) period = p;
      if (period < 3) continue;
      const unit = seq.slice(0, period);
      const shapes = rotations(unit).map(shape);
      const kind =
        period === 3 && new Set(unit).size === 3
          ? 'ABC'
          : period === 4 && shapes.includes('AABB')
            ? 'AABB'
            : period === 4 && shapes.includes('ABCB')
              ? 'ABCB'
              : null;
      if (!kind) continue;
      found++;
      byShape[kind] = (byShape[kind] ?? 0) + 1;
    }
    expect(byShape).toEqual({ ABC: 60, AABB: 40, ABCB: 120 });
    expect(found).toBe(220);
  });

  test('Level 4: every row has exactly one right picture of the 5, a full repeat before the "?"', () => {
    for (const row of LEVEL4_POOL) {
      const right = PICTURE_THEMES.filter((m) => oracleRight(shownOf(row), motif(m)));
      expect(right.map((m) => itemKey(motif(m)))).toEqual([itemKey(answerOf(row))]);
      const period = row.type === 'ABC' ? 3 : 4;
      expect(row.gap).toBeGreaterThanOrEqual(period);
    }
  });

  test('Level 5: 30 count rows (6 runs x 5 motifs) + 8 arrow rows = 38', () => {
    expect(LEVEL5_POOL).toHaveLength(38);
    expect(new Set(LEVEL5_POOL.map(displayedKey)).size).toBe(38);
    expect(typeCounts(LEVEL5_POOL)).toEqual({ grow: 15, shrink: 15, turn: 8 });
    for (const row of LEVEL5_POOL) {
      expect(row.places).toHaveLength(4);
      expect(row.gap).toBe(3);
      expect(oracleRight(shownOf(row), answerOf(row))).toBe(true);
    }
    const runs = LEVEL5_POOL.filter((r) => r.places[0].kind === 'count').map((r) =>
      r.places.map((p) => (p.kind === 'count' ? p.count : 0)).join(''),
    );
    expect(new Set(runs)).toEqual(new Set(['1234', '2345', '3456', '6543', '5432', '4321']));
  });
});

describe('choices', () => {
  test('per level: 3 / 4 / 3 choices, exactly one right (independent checker), all different', () => {
    const rng = seeded(7);
    for (const [pool, level] of [
      [LEVEL3_POOL, 3],
      [LEVEL4_POOL, 4],
      [LEVEL5_POOL, 5],
    ] as const)
      for (const puzzle of pool)
        for (let k = 0; k < 3; k++) {
          const row = withChoices(puzzle, rng);
          expect(rowProblems(row, CHOICE_COUNT[level])).toEqual([]);
        }
  });

  test('Level 3/4: the pattern pictures + motifs not in the row (AABB: 2 + 2 others)', () => {
    const rng = seeded(8);
    for (const puzzle of [...LEVEL3_POOL, ...LEVEL4_POOL]) {
      const row = withChoices(puzzle, rng);
      const inRow = new Set(row.places.map(itemKey));
      const fromRow = row.choices.filter((c) => inRow.has(itemKey(c)));
      expect(fromRow).toHaveLength(inRow.size);
      expect(row.choices.length - fromRow.length).toBe(CHOICE_COUNT[row.level] - inRow.size);
    }
  });

  test('Level 5 counts: same motif, answer +-1; at 6 -> 5 and 4, at 1 -> 2 and 3', () => {
    const rng = seeded(9);
    for (const puzzle of LEVEL5_POOL.filter((r) => r.type !== 'turn')) {
      const row = withChoices(puzzle, rng);
      const answer = answerOf(row);
      if (answer.kind !== 'count') throw new Error('count');
      const wrong = row.choices
        .filter((c) => itemKey(c) !== itemKey(answer))
        .map((c) => (c.kind === 'count' && c.motif === answer.motif ? c.count : -1))
        .sort();
      const expected =
        answer.count === 6
          ? [4, 5]
          : answer.count === 1
            ? [2, 3]
            : [answer.count - 1, answer.count + 1];
      expect(wrong).toEqual(expected);
    }
  });

  test('Level 5 arrows: 2 other directions, always the one turned the other way', () => {
    const rng = seeded(10);
    for (const puzzle of LEVEL5_POOL.filter((r) => r.type === 'turn'))
      for (let k = 0; k < 10; k++) {
        const row = withChoices(puzzle, rng);
        const arrows = row.places.map((p) => (p.kind === 'arrow' ? p.arrow : ''));
        // Turned the other way from the last shown arrow = the arrow shown before it.
        const keys = row.choices.map(itemKey);
        expect(keys).toContain(`a:${arrows[1]}`);
        expect(new Set(keys).size).toBe(3);
        expect(keys).toContain(itemKey(answerOf(row)));
      }
  });

  test('choices come in random order (the right one is not always in the same place)', () => {
    const rng = seeded(11);
    const places = new Set<number>();
    for (let k = 0; k < 50; k++) {
      const row = withChoices(LEVEL3_POOL[0], rng);
      places.add(row.choices.findIndex((c) => itemKey(c) === itemKey(answerOf(row))));
    }
    expect(places).toEqual(new Set([0, 1, 2]));
  });
});

describe('checker', () => {
  const row: PatternRow = withChoices(LEVEL5_POOL[0], seeded(1));
  test('the right picture is correct, the others incorrect, nothing or unknown is no try', () => {
    for (const choice of row.choices)
      expect(checkPattern(row, itemKey(choice))).toBe(
        itemKey(choice) === itemKey(answerOf(row)) ? 'correct' : 'incorrect',
      );
    expect(checkPattern(row, '')).toBe('invalid-input');
    expect(checkPattern(row, 'm:dragons')).toBe('invalid-input');
  });
  test('the oracle agrees on a hand-made row: 1, 2, 3, ? -> 4 only', () => {
    const shown = { places: [count(1), count(2), count(3), null] };
    expect([1, 2, 3, 4, 5, 6].filter((n) => oracleRight(shown, count(n)))).toEqual([4]);
    expect(oracleRight(shown, count(4, 'boats'))).toBe(false);
  });
});

describe('lessons', () => {
  test('sizes 5/10/20 only, Levels 3-5 only', () => {
    expect(() => generatePatternSession(3, 7)).toThrow(RangeError);
    expect(() => generatePatternSession(2 as 3, 5)).toThrow(RangeError);
  });
  test('Level 4 never shows the same picture sequence twice in a lesson', () => {
    const rng = seeded(12);
    for (let k = 0; k < 500; k++) {
      const rows = generatePatternSession(4, 20, rng);
      expect(new Set(rows.map((r) => r.places.map(itemKey).join(' '))).size).toBe(20);
    }
  });
});
