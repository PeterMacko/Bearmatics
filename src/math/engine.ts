export type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Operation = '+' | '-' | '*' | '/';
export type Blank = 0 | 1 | 2;
export type Fact = readonly [number, number, number];
export type Exercise = Readonly<{ level: Level; operation: Operation; values: Fact; blank: Blank }>;

export type AnswerResult = 'correct' | 'incorrect' | 'invalid-input';

/** Parsing failure is not a mathematical mistake and must not affect scoring. */
export function checkAnswer(exercise: Exercise, input: string): AnswerResult {
  const expected = solveBlank(exercise);
  const text = input.trim();
  if (!/^[0-9]+$/.test(text)) return 'invalid-input';
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return 'invalid-input';
  return value === expected ? 'correct' : 'incorrect';
}

const pools = new Map<Level, readonly Exercise[]>();

/** Bounded sampling; only level-0 size-20 rounds repeat four nonzero facts. */
export function generateSession(level: Level, size: number = 10, rng: () => number = Math.random): readonly Exercise[] {
  if (![0, 1, 2, 3, 4, 5, 6, 7].includes(level) || ![5, 10, 20].includes(size)) throw new RangeError('Unsupported session settings');
  let pool = pools.get(level);
  if (!pool) {
    const exercises: Exercise[] = [];
    const addFact = (operation: Operation, values: Fact) => {
      if (!isValidFact(level, values, operation)) return;
      const frozen = Object.freeze(values);
      for (const blank of (level === 0 || level === 3) ? [2] as const : level === 4 ? [0, 1] as const : [0, 1, 2] as const) {
        const exercise = Object.freeze({ level, operation, values: frozen, blank });
        solveBlank(exercise);
        exercises.push(exercise);
      }
    };
    if (level <= 5) {
      const max = [6, 10, 10, 20, 20, 100][level];
      for (let a = 0; a <= max; a++) for (let b = 0; b <= max; b++) {
        addFact('+', [a, b, a + b]);
        addFact('-', [a, b, a - b]);
      }
    } else {
      const max = level === 6 ? 5 : 10;
      for (let a = 1; a <= max; a++) for (let b = 1; b <= max; b++) {
        addFact('*', [a, b, a * b]);
        if (level === 7) addFact('/', [a * b, b, a]);
      }
    }
    pool = Object.freeze(exercises);
    pools.set(level, pool);
  }
  function shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const random = rng();
      if (!Number.isFinite(random) || random < 0 || random >= 1) throw new RangeError('Random source must return a number in [0, 1)');
      const j = Math.floor(random * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
  // Apply one shared budget before coverage selection as well as filler.
  let zeroAvailable = true;
  const available = shuffle([...pool]).filter(e => {
    if (!e.values.includes(0)) return true;
    if (!zeroAvailable) return false;
    zeroAvailable = false;
    return true;
  });
  const selected: Exercise[] = [];
  const take = (predicate: (e: Exercise) => boolean) => {
    if (selected.some(predicate)) return;
    const index = available.findIndex(predicate);
    if (index < 0) throw new RangeError('Insufficient exercises');
    selected.push(available.splice(index, 1)[0]);
  };
  const operations: Operation[] = level <= 1 ? ['+'] : level <= 5 ? ['+', '-'] : level === 6 ? ['*'] : ['*', '/'];
  for (const operation of operations) take(e => e.operation === operation);
  if (level === 4) {
    take(e => e.blank === 0);
    take(e => e.blank === 1);
  } else {
    take(e => e.blank === 2);
    if (level !== 0 && level !== 3) take(e => e.blank !== 2);
  }
  selected.push(...available.slice(0, size - selected.length));
  const ordered = shuffle(selected);
  if (level === 0 && size === 20) {
    // Only 15 nonzero facts exist. Reuse four different ones, separated from
    // their first presentations and from each other, without random retries.
    const repeats = ordered.filter(e => !e.values.includes(0)).slice(0, 4);
    const extended: Exercise[] = [];
    for (let i = 0; i < ordered.length; i++) {
      extended.push(ordered[i]);
      if (i >= 8 && i < 12) extended.push(Object.freeze({ ...repeats[i - 8] }));
    }
    return Object.freeze(extended);
  }
  return Object.freeze(ordered);
}

export function solveBlank(exercise: Exercise): number {
  const { level, operation, values, blank } = exercise;
  if ((level === 4 && blank === 2) || ((level === 0 || level === 3) && blank !== 2) || ![0, 1, 2].includes(blank) || !isValidFact(level, values, operation)) throw new RangeError('Invalid exercise');
  const solutions: number[] = [];
  // Enumerate the permitted domain instead of trusting the stored hidden value.
  for (let candidate = 0; candidate <= 100; candidate++) {
    const completed = [...values];
    completed[blank] = candidate;
    if (isValidFact(level, completed, operation)) solutions.push(candidate);
  }
  if (solutions.length !== 1) throw new RangeError('Exercise must have exactly one answer');
  return solutions[0];
}

export function isValidFact(level: number, values: readonly number[], operation: string): boolean {
  if (values.length !== 3 || !values.every(n => Number.isSafeInteger(n) && n >= 0)) return false;
  const [a, b, c] = values;
  if (level >= 0 && level <= 5 && Number.isInteger(level)) {
    const max = [6, 10, 10, 20, 20, 100][level];
    return values.every(n => n <= max) && ((operation === '+' && a + b === c) || (level > 1 && operation === '-' && a - b === c));
  }
  if (level === 6 || level === 7) {
    const max = level === 6 ? 5 : 10;
    const factor = (n: number) => n >= 1 && n <= max;
    if (operation === '*') return factor(a) && factor(b) && a * b === c;
    if (level === 7 && operation === '/') return factor(b) && factor(c) && a === b * c;
  }
  return false;
}
