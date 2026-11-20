/**
 * Bear badges (SCRUM-117). Badge 1 needs 30 points and every next badge needs 5% more points
 * than the previous step: badge n at ceil(600 × (1.05^n − 1)). Exact integer maths
 * (1.05 = 21/20), because floating point gives 31 for badge 1. The badge always follows the
 * points and is never stored, so it goes down when points go down.
 */
export function badgeThreshold(n: number): number {
  if (n <= 0) return 0;
  const top = 21n ** BigInt(n);
  const bottom = 20n ** BigInt(n);
  return Number((600n * (top - bottom) + bottom - 1n) / bottom);
}

type BadgeProgress = {
  points: number;
  /** 0 = no badge yet. */
  badge: number;
  /** Points needed for the next badge in total, and how many are still missing. */
  nextAt: number;
  toNext: number;
};

export function badgeFor(points: number): BadgeProgress {
  const safe = Math.max(0, Math.floor(points));
  let badge = 0;
  while (safe >= badgeThreshold(badge + 1)) badge++;
  const nextAt = badgeThreshold(badge + 1);
  return { points: safe, badge, nextAt, toNext: nextAt - safe };
}

/** Colour changes every 5 badges: bronze, silver, gold, then again with stars. */
export function badgeLook(badge: number): {
  metal: 'none' | 'bronze' | 'silver' | 'gold';
  stars: number;
} {
  if (badge <= 0) return { metal: 'none', stars: 0 };
  const step = Math.floor((badge - 1) / 5);
  return { metal: (['bronze', 'silver', 'gold'] as const)[step % 3], stars: Math.floor(step / 3) };
}
