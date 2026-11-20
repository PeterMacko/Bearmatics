// SCRUM-222: the About page screenshots mock /api with made-up demo data. This proves the mocked
// leaderboard is exactly what the real server would send for those players (SPEC: places 1-10,
// shared place 3, a gap, then Nela 12, Demo Bear 13, Oli 14).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Leaderboard } from '../shared/api-types';
import { leaderboardRows, type Player } from './leaderboard';

const demo = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'scripts', 'about-demo.json'), 'utf8'),
) as { meId: string; players: Player[]; leaderboard: Leaderboard; account: { nickname: string } };

describe('About screenshot demo data', () => {
  it('mocks the leaderboard the server computes for the demo players', () => {
    expect(demo.players).toHaveLength(14);
    expect(leaderboardRows(demo.players, demo.meId)).toEqual(demo.leaderboard);
  });

  it('shows places 1-10 with a shared place 3, then 12, me at 13 and 14 after a gap', () => {
    const { rows, gapBefore } = demo.leaderboard;
    expect(rows.map((row) => `${row.place} ${row.nickname}`)).toEqual([
      '1 Rocket Fox',
      '2 Mia',
      '3 Tomi',
      '3 Star Bear',
      '5 Lily_7',
      '6 Kubko',
      '7 Ema',
      '8 Zebra Zoe',
      '9 Maxo',
      '10 Sunny',
      '12 Nela',
      `13 ${demo.account.nickname}`,
      '14 Oli',
    ]);
    expect(gapBefore).toBe(10);
    expect(rows.filter((row) => row.me).map((row) => row.nickname)).toEqual(['Demo Bear']);
  });
});
