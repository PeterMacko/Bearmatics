import { expect, test } from 'vitest';
import { generateSession, isValidFact, solveBlank, type Exercise } from './engine';

function seeded(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

test('constant random sources remain bounded and invalid sources throw', () => {
  for (const level of [0, 1, 2, 3, 4, 5, 6, 7] as const) for (const size of [5, 10, 20]) {
    for (const value of [0, 0.5, 1 - Number.EPSILON]) {
      let calls = 0;
      const session = generateSession(level, size, () => { calls++; return value; });
      expect(calls).toBeLessThan(40000);
      expect(session).toHaveLength(size);
      expect(session.filter(e => e.values.includes(0)).length).toBeLessThanOrEqual(1);
      expect(new Set(session).size).toBe(size);
      if (level === 0 && size === 20) {
        expect(new Set(session.map(e => e.values.join(','))).size).toBe(16);
        for (let i = 1; i < size; i++) expect(session[i].values).not.toEqual(session[i - 1].values);
      }
    }
    for (const value of [-1, 1, NaN, Infinity, -Infinity]) expect(() => generateSession(level, size, () => value)).toThrow(RangeError);
    let calls = 0;
    expect(() => generateSession(level, size, () => ++calls === 3 ? NaN : 0)).toThrow(RangeError);
  }
});

test('zero remains legal in every allowed addition and subtraction blank position', () => {
  for (const level of [0, 1, 2, 3, 4, 5] as const) {
    const max = [6, 10, 10, 20, 20, 100][level];
    const blanks = level === 0 || level === 3 ? [2] as const : level === 4 ? [0, 1] as const : [0, 1, 2] as const;
    for (let n = 0; n <= max; n++) {
      const facts: Exercise[] = [];
      for (const blank of blanks) {
        facts.push({ level, operation: '+', values: [0, n, n], blank }, { level, operation: '+', values: [n, 0, n], blank });
        if (level >= 2) facts.push({ level, operation: '-', values: [n, n, 0], blank }, { level, operation: '-', values: [n, 0, n], blank });
      }
      for (const e of facts) {
        expect(isValidFact(level, e.values, e.operation)).toBe(true);
        expect(solveBlank(e)).toBe(e.values[e.blank]);
      }
    }
  }
});

test('repeated originals have distinct frozen presentation identities', () => {
  const session = generateSession(0, 20, () => 0);
  expect(new Set(session).size).toBe(20);
  for (const e of session) expect(Object.isFrozen(e) && Object.isFrozen(e.values)).toBe(true);
});

test('level zero keeps twenty presentations with exactly four spread nonzero repeats', () => {
  for (let seed = 0; seed < 80; seed++) {
    const session = generateSession(0, 20, seeded(seed));
    expect(session).toHaveLength(20);
    const nonzero = session.filter(e => !e.values.includes(0));
    expect(nonzero).toHaveLength(19);
    const counts = new Map<string, number>();
    for (const e of nonzero) counts.set(e.values.join(','), (counts.get(e.values.join(',')) ?? 0) + 1);
    expect(counts.size).toBe(15);
    expect([...counts.values()].filter(n => n === 2)).toHaveLength(4);
    expect(Math.max(...counts.values())).toBe(2);
    expect(session.filter(e => e.values.includes(0))).toHaveLength(1);
    for (let i = 1; i < session.length; i++) expect(session[i].values).not.toEqual(session[i - 1].values);
  }
});

test('caps zero-containing full facts across coverage and filler in original rounds', () => {
  for (const level of [0, 1, 2, 3, 4, 5, 6, 7] as const) {
    for (const size of [5, 10, 20]) {
      for (let seed = 0; seed < 80; seed++) {
        const session = generateSession(level, size, seeded(seed));
        expect(session).toHaveLength(size);
        expect(session).toEqual(generateSession(level, size, seeded(seed)));
        expect(new Set(session).size).toBe(size);
        expect(Object.isFrozen(session)).toBe(true);
        const display = (e: Exercise) => `${e.operation}:${e.values.map((v, i) => i === e.blank ? '?' : v).join(',')}`;
        expect(new Set(session.map(display)).size).toBe(level === 0 && size === 20 ? 16 : size);
        expect(new Set(session.map(e => e.operation)).size).toBe(level <= 1 || level === 6 ? 1 : 2);
        if (level === 4) expect(new Set(session.map(e => e.blank))).toEqual(new Set([0, 1]));
        else {
          expect(session.some(e => e.blank === 2)).toBe(true);
          expect(session.some(e => e.blank !== 2)).toBe(level !== 0 && level !== 3);
        }
        for (const e of session) {
          expect(Object.isFrozen(e) && Object.isFrozen(e.values)).toBe(true);
          expect(isValidFact(level, e.values, e.operation)).toBe(true);
          expect(solveBlank(e)).toBe(e.values[e.blank]);
        }
        expect(session.filter(e => e.values.includes(0)).length, `level ${level}, size ${size}, seed ${seed}`).toBeLessThanOrEqual(1);
        if (level >= 6) expect(session.every(e => e.values.every(n => n > 0))).toBe(true);
      }
    }
  }
});
