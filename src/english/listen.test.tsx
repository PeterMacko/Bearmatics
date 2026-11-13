import { describe, expect, test } from 'vitest';
import { checkWord, generateWordSession, SESSION_SIZES } from './listen';
import { allWords, audioFile, WORDS } from './words';

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const ALTERNATIVES = new Map(WORDS.map((entry) => [entry.word, entry.alternatives]));

describe('English listen-and-choose sessions', () => {
  test('word data: 21 targets, 111 words needing audio, no alternative equals a target', () => {
    expect(WORDS).toHaveLength(21);
    expect(allWords()).toHaveLength(111);
    const targets = new Set(WORDS.map((entry) => entry.word));
    for (const entry of WORDS)
      for (const level of [1, 2] as const) {
        expect(new Set(entry.alternatives[level]).size).toBe(3);
        for (const word of entry.alternatives[level]) expect(targets.has(word)).toBe(false);
      }
  });

  test('names are capitalised, all other words lower case; audio files are lower case', () => {
    const names = new Set(['Suzy', 'Lucy', 'Susan', 'Daisy']);
    for (const word of allWords()) {
      expect(word).toBe(
        names.has(word) ? word[0].toUpperCase() + word.slice(1) : word.toLowerCase(),
      );
      expect(audioFile(word)).toBe(word.toLowerCase());
    }
  });

  test('over many seeds: no repeated target, options = target + its 3 listed alternatives', () => {
    for (let seed = 1; seed <= 300; seed++)
      for (const level of [1, 2] as const)
        for (const size of SESSION_SIZES) {
          const session = generateWordSession(level, size, seeded(seed));
          expect(session).toHaveLength(size);
          expect(new Set(session.map((q) => q.target)).size).toBe(size);
          for (const q of session) {
            expect(q.level).toBe(level);
            expect([...q.options].sort()).toEqual(
              [q.target, ...ALTERNATIVES.get(q.target)![level]].sort(),
            );
          }
        }
  });

  test('target position varies across questions', () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 50; seed++)
      for (const q of generateWordSession(1, 20, seeded(seed)))
        positions.add(q.options.indexOf(q.target));
    expect([...positions].sort()).toEqual([0, 1, 2, 3]);
  });

  test('rejects unsupported settings', () => {
    expect(() => generateWordSession(1, 7)).toThrow(RangeError);
    expect(() => generateWordSession(3 as 1, 10)).toThrow(RangeError);
  });

  test('checkWord: empty choice is invalid input, otherwise right or wrong', () => {
    const [q] = generateWordSession(2, 5, seeded(4));
    expect(checkWord(q, '')).toBe('invalid-input');
    expect(checkWord(q, q.target)).toBe('correct');
    expect(
      checkWord(
        q,
        q.options.find((o) => o !== q.target)!,
      ),
    ).toBe('incorrect');
  });
});
