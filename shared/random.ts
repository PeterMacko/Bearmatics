// Random helpers for the app's lessons and the bear looks. The random source is passed in
// (Math.random in the app, seeded in tests); each helper documents how many `rng()` values it
// uses, since seeded lessons depend on that order and count.

/** An index below `n` from one `rng()` value (an rng of exactly 1 stays in range). */
export const randomIndex = (n: number, rng: () => number) => Math.min(n - 1, Math.floor(rng() * n));

/** One item, with equal chance, from one `rng()` value. */
export const pickOne = <T>(items: readonly T[], rng: () => number): T =>
  items[randomIndex(items.length, rng)];

/**
 * A copy of `items` in random order (Fisher-Yates from the end, one `rng()` call per position).
 * A tuple keeps its length in the type.
 */
export function shuffled<T extends readonly unknown[]>(
  items: T,
  rng: () => number,
): { -readonly [K in keyof T]: T[number] } {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out as { -readonly [K in keyof T]: T[number] };
}
