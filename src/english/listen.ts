import type { AnswerResult } from '../math/engine';
import { shuffled } from '../random';
import { SESSION_SIZES } from '../session';
import { WORDS, type ListenLevel } from './words';

/** One listen-and-choose question: the spoken target and four word buttons in display order. */
export type WordQuestion = Readonly<{
  level: ListenLevel;
  target: string;
  options: readonly [string, string, string, string];
}>;

export { SESSION_SIZES };

/**
 * A session of distinct target words (no repeats), each with its three approved alternatives
 * for the level, in random order.
 */
export function generateWordSession(
  level: ListenLevel,
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
      options: shuffled([entry.word, ...entry.alternatives[level]], rng),
    }));
}

/** An empty choice is not a mistake: it asks the child to pick a word first. */
export function checkWord(question: WordQuestion, choice: string): AnswerResult {
  if (!choice) return 'invalid-input';
  return choice === question.target ? 'correct' : 'incorrect';
}
