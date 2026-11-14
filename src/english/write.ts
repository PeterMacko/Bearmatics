import type { AnswerResult } from '../math/engine';
import { SESSION_SIZES } from './listen';
import { WORDS } from './words';

/** One listen-and-write question (English level 3): only the sound is given. */
export type WriteQuestion = Readonly<{ level: 3; target: string }>;

/** Approved spelling variants (Peter, SCRUM-80): "gray" for grey. Only "Suzy" for Suzy. */
const VARIANTS: Readonly<Record<string, readonly string[]>> = { grey: ['gray'] };

/** Lower case and remove every space, as the checking rule says. */
export function normalizeWritten(answer: string): string {
  return answer.toLowerCase().replace(/\s+/gu, '');
}

/** Why an answer is not a try: nothing written, or something other than letters. */
export function writePrompt(answer: string): 'empty' | 'letters' | null {
  const value = normalizeWritten(answer);
  if (!value) return 'empty';
  if (!/^\p{L}+$/u.test(value)) return 'letters';
  return null;
}

export function acceptedSpellings(target: string): readonly string[] {
  const word = target.toLowerCase();
  return [word, ...(VARIANTS[word] ?? [])];
}

/** Empty or non-letter input only prompts (not a try); otherwise right or wrong. */
export function checkWritten(question: WriteQuestion, answer: string): AnswerResult {
  if (writePrompt(answer)) return 'invalid-input';
  return acceptedSpellings(question.target).includes(normalizeWritten(answer))
    ? 'correct'
    : 'incorrect';
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 5/10/20 distinct words from the same 21-word list as levels 1-2. */
export function generateWriteSession(
  size: number,
  rng: () => number = Math.random,
): readonly WriteQuestion[] {
  if (!(SESSION_SIZES as readonly number[]).includes(size))
    throw new RangeError('Unsupported session size');
  return shuffled(WORDS, rng)
    .slice(0, size)
    .map((entry) => ({ level: 3 as const, target: entry.word }));
}
