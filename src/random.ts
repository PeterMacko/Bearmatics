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
