/**
 * A seeded random source for tests (32-bit linear congruential generator, values in [0, 1)).
 * The same seed always gives the same sequence.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}
