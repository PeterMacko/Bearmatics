import type { Level } from './math/engine';

/** One level in a maths course menu: the engine level and the number the child sees. */
export type CourseLevel = { value: Level; shown: number };

/**
 * SCRUM-141: maths is split into two courses. Small maths shows the old level 0 (count the
 * pictures) as its level 1; more Small maths levels are added to this list later. Maths keeps
 * levels 1-7 under their numbers. The engine levels and their rules are unchanged.
 */
export const SMALL_MATH_LEVELS: CourseLevel[] = [
  { value: 0, shown: 1 },
  // SCRUM-156: take away with a picture basket.
  { value: 8, shown: 2 },
];
export const MATH_LEVELS: CourseLevel[] = ([1, 2, 3, 4, 5, 6, 7] as const).map((value) => ({
  value,
  shown: value,
}));

/** The level number shown to the child for an engine level in a course. */
export function shownLevel(levels: CourseLevel[], level: Level) {
  return levels.find((item) => item.value === level)?.shown ?? level;
}
