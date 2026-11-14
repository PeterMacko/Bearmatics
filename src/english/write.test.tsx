import { describe, expect, test } from 'vitest';
import { WORDS } from './words';
import {
  acceptedSpellings,
  checkWritten,
  generateWriteSession,
  normalizeWritten,
  writePrompt,
  type WriteQuestion,
} from './write';

const q = (target: string): WriteQuestion => ({ level: 3, target });

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe('English listen-and-write checking (every word)', () => {
  for (const { word } of WORDS) {
    test(`${word}: any capitals and spaces accepted; wrong spellings rejected`, () => {
      const lower = word.toLowerCase();
      for (const answer of [
        lower,
        word.toUpperCase(),
        lower[0].toUpperCase() + lower.slice(1),
        ` ${lower} `,
        lower.split('').join(' '),
        `${lower.slice(0, 2)}\t${lower.slice(2)}`,
      ])
        expect(checkWritten(q(word), answer)).toBe('correct');
      for (const wrong of [
        lower.slice(0, -1),
        `${lower}s`,
        lower.slice(1),
        `${lower.slice(0, -1)}x`,
        lower.split('').reverse().join('') === lower
          ? `${lower}a`
          : lower.split('').reverse().join(''),
      ])
        expect(checkWritten(q(word), wrong)).toBe('incorrect');
    });
  }

  test('"gray" is accepted for grey; Suzy accepts only "Suzy"', () => {
    expect(checkWritten(q('grey'), 'gray')).toBe('correct');
    expect(checkWritten(q('grey'), 'Gray ')).toBe('correct');
    expect(acceptedSpellings('Suzy')).toEqual(['suzy']);
    for (const other of ['Susie', 'Suzie', 'Susy', 'Suzi', 'Susan'])
      expect(checkWritten(q('Suzy'), other)).toBe('incorrect');
    expect(checkWritten(q('Suzy'), 'suzy')).toBe('correct');
  });

  test('empty and non-letter input only prompt; neither is a try', () => {
    for (const empty of ['', ' ', '   \t'])
      expect([writePrompt(empty), checkWritten(q('seven'), empty)]).toEqual([
        'empty',
        'invalid-input',
      ]);
    for (const other of ['7', 'seven7', 'sev-en', 'seven!', '😀', "it's"])
      expect([writePrompt(other), checkWritten(q('seven'), other)]).toEqual([
        'letters',
        'invalid-input',
      ]);
    // Accented letters are letters: a normal (wrong) try, not a prompt.
    expect(writePrompt('sévén')).toBeNull();
    expect(checkWritten(q('seven'), 'sévén')).toBe('incorrect');
  });

  test('normalizeWritten lower-cases and removes every space', () => {
    expect(normalizeWritten(' Seven Teen ')).toBe('seventeen');
    expect(checkWritten(q('seventeen'), 'seven teen')).toBe('correct');
  });

  test('sessions of 5/10/20 without repeated words, all from the 21-word list', () => {
    const list = new Set(WORDS.map((w) => w.word));
    for (let seed = 1; seed <= 200; seed++)
      for (const size of [5, 10, 20]) {
        const session = generateWriteSession(size, seeded(seed));
        expect(session).toHaveLength(size);
        expect(new Set(session.map((s) => s.target)).size).toBe(size);
        for (const s of session) {
          expect(s.level).toBe(3);
          expect(list.has(s.target)).toBe(true);
        }
      }
    expect(() => generateWriteSession(7)).toThrow(RangeError);
  });
});
