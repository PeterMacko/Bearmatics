// SCRUM-309: "Bear picks a game" remembers the child's age and the last exercise count on this
// device only (one localStorage entry, never sent). Unreadable or blocked storage = no age
// (the mode asks again) and 5 exercises.
import { isSessionSize } from '../../shared/lessonSizes';
import { readJson, writeJson } from '../deviceStore';
import { MAX_AGE, MIN_AGE } from '../levelAges';

export const BEAR_PICKS_KEY = 'bearmatics-bear-picks';

export type PickSize = 5 | 10 | 20;
type BearPicksStore = { age: number | null; size: PickSize };

const validAge = (age: unknown): age is number =>
  typeof age === 'number' && Number.isInteger(age) && age >= MIN_AGE && age <= MAX_AGE;

export function readBearPicks(): BearPicksStore {
  const parsed = readJson(() => localStorage, BEAR_PICKS_KEY);
  if (!parsed || typeof parsed !== 'object') return { age: null, size: 5 };
  const { age, size } = parsed as Record<string, unknown>;
  return {
    age: validAge(age) ? age : null,
    size: isSessionSize(size as number) ? (size as PickSize) : 5,
  };
}

/** Storage full or blocked: the choice is kept only while the mode runs. */
export function writeBearPicks(store: BearPicksStore) {
  writeJson(() => localStorage, BEAR_PICKS_KEY, store);
}
