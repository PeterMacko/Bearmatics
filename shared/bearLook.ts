// SCRUM-249: a profile bear is built from five parts. Each part is stored as a number (an index
// into that part's list of choices). Shared by the server (checks, legacy column) and the app.
// Pure data and checks only: no browser or Worker APIs.

/** The parts of a bear, in the order the dress screen shows them. */
export const LOOK_PARTS = ['fur', 'background', 'head', 'neck', 'eyes'] as const;
export type LookPart = (typeof LOOK_PARTS)[number];
export type BearLook = Record<LookPart, number>;

/**
 * How many choices each part has. Index 0 of head, neck and eyes is "none".
 * fur: brown, dark brown, honey, white (polar), panda, pink, blue, mint
 * background: the 8 colours of the first bears (yellow, blue, sky, green, peach, cream, pink, coral)
 * head: none, cap, hat, crown, bow, flower
 * neck: none, bow tie, tie, scarf, necklace, medal
 * eyes: none, glasses, sunglasses, star glasses
 */
export const PART_COUNTS: Record<LookPart, number> = {
  fur: 8,
  background: 8,
  head: 6,
  neck: 6,
  eyes: 4,
};

export const validLook = (value: unknown): value is BearLook =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  LOOK_PARTS.every((part) => {
    const n = (value as Record<string, unknown>)[part];
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < PART_COUNTS[part];
  });

/** Only the five parts (drops anything else a request carried). */
export const pickLook = (look: BearLook): BearLook => ({
  fur: look.fur,
  background: look.background,
  head: look.head,
  neck: look.neck,
  eyes: look.eyes,
});

/**
 * The eight bears from before SCRUM-249 (stored as `bear` 1-8) as parts: the same fur and
 * background colours; their extra goes to the matching slot. Two extras have no item of their
 * own any more: the star (bear 1) becomes the crown and the leaf (bear 7) becomes the flower.
 * migrations/0006_bear_parts.sql holds the same table (a server test keeps them equal).
 */
export const OLD_BEARS: Record<number, BearLook> = {
  1: { fur: 0, background: 0, head: 3, neck: 0, eyes: 0 },
  2: { fur: 1, background: 1, head: 2, neck: 0, eyes: 0 },
  3: { fur: 3, background: 2, head: 0, neck: 3, eyes: 0 },
  4: { fur: 4, background: 3, head: 0, neck: 0, eyes: 0 },
  5: { fur: 5, background: 4, head: 4, neck: 0, eyes: 0 },
  6: { fur: 6, background: 5, head: 0, neck: 0, eyes: 1 },
  7: { fur: 7, background: 6, head: 5, neck: 0, eyes: 0 },
  8: { fur: 2, background: 7, head: 3, neck: 0, eyes: 0 },
};

/** Old bear (1-8) with the same fur: written to the old `bear` column for older app versions. */
export const oldBearFor = (look: BearLook): number => [1, 2, 8, 3, 4, 5, 6, 7][look.fur] ?? 1;

/** A random look (`random` returns [0, 1), like Math.random). */
export function randomLook(random: () => number = Math.random): BearLook {
  const pick = (part: LookPart) =>
    Math.min(PART_COUNTS[part] - 1, Math.floor(random() * PART_COUNTS[part]));
  return {
    fur: pick('fur'),
    background: pick('background'),
    head: pick('head'),
    neck: pick('neck'),
    eyes: pick('eyes'),
  };
}

/** `count` random looks with different furs (so their spoken names differ too). */
export function randomLooks(count: number, random: () => number = Math.random): BearLook[] {
  const furs = Array.from({ length: PART_COUNTS.fur }, (_, index) => index);
  for (let i = furs.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [furs[i], furs[j]] = [furs[j], furs[i]];
  }
  return furs.slice(0, count).map((fur) => ({ ...randomLook(random), fur }));
}

export const sameLook = (a: BearLook, b: BearLook) =>
  LOOK_PARTS.every((part) => a[part] === b[part]);
