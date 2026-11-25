// SCRUM-300 acceptance: 10,000 seeded lessons per size on each level, no failure. Every row is
// checked by the independent rule checker (exactly one right choice, distractors never right,
// counts 1-6, the level's choice count), plus no displayed row twice and easier types first.
import { expect, test } from 'vitest';
import { seeded } from '../testing/seeded';
import { bulkLine, bulkRun, oracleRight, shownOf } from '../testing/patternOracle';
import type { PatternItem, PatternRow } from './patterns';

const SPLIT: Record<number, number> = { 5: 2, 10: 4, 20: 8 };
const first = (rows: readonly PatternRow[], easy: (row: PatternRow) => boolean, n: number) =>
  rows.slice(0, n).every(easy) && !rows.slice(n).some(easy);

// Level 3: AB rows (a repeat of 2 already visible) first, then AAB/ABB.
const ab = (row: PatternRow) => {
  const shown = shownOf(row).places.slice(0, 4) as PatternItem[];
  return (
    JSON.stringify(shown[0]) === JSON.stringify(shown[2]) &&
    JSON.stringify(shown[1]) === JSON.stringify(shown[3])
  );
};
// Level 4: the "?" at the end first, then inside.
const atEnd = (row: PatternRow) => shownOf(row).places.at(-1) === null;
// Level 5: growing counts, shrinking counts, then arrows.
const order5 = (row: PatternRow) => {
  const p = row.places[0];
  if (p.kind === 'arrow') return 2;
  const q = row.places[1];
  return q.kind === 'count' && p.kind === 'count' && q.count > p.count ? 0 : 1;
};
const sorted5 = (rows: readonly PatternRow[]) =>
  rows.every((row, i) => i === 0 || order5(rows[i - 1]) <= order5(row));

for (const size of [5, 10, 20]) {
  test(`Level 3 size ${size}: 10,000 lessons without a failure`, () => {
    const r = bulkRun(3, size, 10_000, seeded(3000 + size), 3, (rows) =>
      first(rows, ab, SPLIT[size]),
    );
    process.stdout.write(bulkLine(3, size, r));
    expect(r.examples).toEqual([]);
    expect(r.failures).toBe(0);
  }, 600_000);
  test(`Level 4 size ${size}: 10,000 lessons without a failure`, () => {
    const r = bulkRun(4, size, 10_000, seeded(4000 + size), 4, (rows) =>
      first(rows, atEnd, SPLIT[size]),
    );
    process.stdout.write(bulkLine(4, size, r));
    expect(r.examples).toEqual([]);
    expect(r.failures).toBe(0);
  }, 600_000);
  test(`Level 5 size ${size}: 10,000 lessons without a failure`, () => {
    const r = bulkRun(
      5,
      size,
      10_000,
      seeded(5000 + size),
      3,
      (rows) =>
        sorted5(rows) &&
        rows.filter((row) => order5(row) === 2).length === { 5: 2, 10: 4, 20: 8 }[size],
    );
    process.stdout.write(bulkLine(5, size, r));
    expect(r.examples).toEqual([]);
    expect(r.failures).toBe(0);
  }, 600_000);
}

test('the oracle used above rejects a wrong picture (sanity)', () => {
  const shown = {
    places: [{ kind: 'arrow', arrow: 'up' }, { kind: 'arrow', arrow: 'right' }, null],
  } as const;
  expect(oracleRight(shown, { kind: 'arrow', arrow: 'down' })).toBe(true);
  expect(oracleRight(shown, { kind: 'arrow', arrow: 'up' })).toBe(false);
  expect(oracleRight(shown, { kind: 'arrow', arrow: 'left' })).toBe(false);
});
