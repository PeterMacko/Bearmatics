/**
 * SCRUM-281: the grown-up question before Sign out and Delete account: a³ + b with a = 3–6 and
 * b = 11–49 (answers 38–265). Nothing is stored; `rng` is injectable so tests know the question.
 */
type GrownUpQuestion = { a: number; b: number; answer: number };

const GROWN_UP = { a: [3, 6], b: [11, 49] } as const;

/** A whole number from `low` to `high` (both included) from one `rng()` call. */
const pick = (rng: () => number, [low, high]: readonly [number, number]) =>
  low + Math.min(high - low, Math.max(0, Math.floor(rng() * (high - low + 1))));

export function grownUpQuestion(rng: () => number = Math.random): GrownUpQuestion {
  const a = pick(rng, GROWN_UP.a);
  const b = pick(rng, GROWN_UP.b);
  return { a, b, answer: a ** 3 + b };
}

/** 'empty' (nothing typed), 'right' or 'wrong'. Spaces around the number are ignored. */
export function checkGrownUp(
  question: GrownUpQuestion,
  typed: string,
): 'empty' | 'right' | 'wrong' {
  const answer = typed.trim();
  if (answer === '') return 'empty';
  return /^\d+$/.test(answer) && Number(answer) === question.answer ? 'right' : 'wrong';
}
