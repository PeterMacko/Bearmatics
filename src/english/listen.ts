import type { AnswerResult } from '../math/engine';
import { WORDS, type EnglishLevel } from './words';

/** One listen-and-choose question: the spoken target and four word buttons in display order. */
export type WordQuestion = Readonly<{
  level: EnglishLevel;
  target: string;
  options: readonly [string, string, string, string];
}>;

export const SESSION_SIZES = [5, 10, 20] as const;

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A session of distinct target words (no repeats), each with its three approved alternatives
 * for the level, in random order.
 */
export function generateWordSession(
  level: EnglishLevel,
  size: number,
  rng: () => number = Math.random,
): readonly WordQuestion[] {
  if (![1, 2].includes(level) || !(SESSION_SIZES as readonly number[]).includes(size))
    throw new RangeError('Unsupported session settings');
  return shuffled(WORDS, rng)
    .slice(0, size)
    .map((entry) => ({
      level,
      target: entry.word,
      options: shuffled(
        [entry.word, ...entry.alternatives[level]],
        rng,
      ) as unknown as WordQuestion['options'],
    }));
}

/** An empty choice is not a mistake: it asks the child to pick a word first. */
export function checkWord(question: WordQuestion, choice: string): AnswerResult {
  if (!choice) return 'invalid-input';
  return choice === question.target ? 'correct' : 'incorrect';
}
