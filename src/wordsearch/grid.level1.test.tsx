import { expect, test } from 'vitest';
import { seeded } from '../testing/seeded';
import { bulkLine, bulkRun } from '../testing/wordSearchOracle';

// SCRUM-244 acceptance: 10,000 seeded grids on level 1, no failure; each grid checked by the
// independent scanner (each word exactly once in all 8 directions, directions of the level, no
// other list word, no rude word in any direction).
test('level 1: 10,000 grids without a failure', () => {
  const result = bulkRun(1, 10_000, seeded(1001));
  process.stdout.write(bulkLine(result));
  expect(result.failures).toBe(0);
  expect(result.badGrids.slice(0, 5)).toEqual([]);
}, 600_000);
