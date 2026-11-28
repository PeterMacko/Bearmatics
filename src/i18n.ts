import { accountCopy } from './i18n/account';
import { coursesCopy } from './i18n/courses';
import { englishCopy } from './i18n/english';
import { lessonCopy } from './i18n/lesson';
import { logicCopy } from './i18n/logic';
import { mathsCopy } from './i18n/maths';
import { pointsCopy } from './i18n/points';
import { wordsearchCopy } from './i18n/wordsearch';

export type Language = 'en' | 'sk';

/** All copy, both languages. The parts live in src/i18n/ by feature; the spread order keeps the
 * key order of the old single object (src/i18n.fixture.test.tsx checks it). */
export const copy = {
  en: {
    ...lessonCopy.en,
    ...coursesCopy.en,
    ...mathsCopy.en,
    ...englishCopy.en,
    ...logicCopy.en,
    ...wordsearchCopy.en,
    ...pointsCopy.en,
    ...accountCopy.en,
  },
  sk: {
    ...lessonCopy.sk,
    ...coursesCopy.sk,
    ...mathsCopy.sk,
    ...englishCopy.sk,
    ...logicCopy.sk,
    ...wordsearchCopy.sk,
    ...pointsCopy.sk,
    ...accountCopy.sk,
  },
} as const;

/** Copy for one language. */
export type Copy = (typeof copy)[Language];

/** "1 point", "3 points" / "1 bod", "3 body", "5 bodov". */
export function pointsText(units: readonly string[], n: number): string {
  const word = n === 1 ? units[0] : n >= 2 && n <= 4 ? units[1] : units[2];
  return `${n} ${word}`;
}

export const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
