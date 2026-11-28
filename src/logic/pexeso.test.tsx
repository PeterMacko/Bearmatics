// SCRUM-324: the pexeso engine with fixed card orders (AC 4-6).
import { describe, expect, it } from 'vitest';
import { lessonPoints, multiplierFor } from '../progress/multipliers';
import {
  FREE_MISSES,
  PEXESO_PICTURES,
  boardShape,
  closeMiss,
  gameFromCards,
  gamePoints,
  heartsLeft,
  isFinished,
  newGame,
  pexesoPoints,
  tapCard,
  type PexesoGame,
  type PexesoPicture,
} from './pexeso';

// 6 pictures, laid out a a b b c c d d e e f f (pairs side by side) unless a test says otherwise.
const P = PEXESO_PICTURES;
const sideBySide = (pairs: number): PexesoPicture[] => P.slice(0, pairs).flatMap((p) => [p, p]);
// a b c d e f a b c d e f: card i and i+6 are a pair.
const twoRows = (pairs: number): PexesoPicture[] => [...P.slice(0, pairs), ...P.slice(0, pairs)];

const taps = (game: PexesoGame, ...indices: number[]) =>
  indices.reduce((g, i) => tapCard(g, i), game);

describe('pexeso boards (AC 2)', () => {
  it('12 / 20 / 30 cards, every picture exactly twice, shuffled by the rng', () => {
    let seed = 1;
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const pairs of [6, 10, 15] as const) {
      const game = newGame(pairs, rng);
      expect(game.cards).toHaveLength(pairs * 2);
      const counts = new Map<string, number>();
      for (const c of game.cards) counts.set(c, (counts.get(c) ?? 0) + 1);
      expect(counts.size).toBe(pairs);
      expect([...counts.values()].every((n) => n === 2)).toBe(true);
      expect(game.free).toBe(FREE_MISSES[pairs]);
    }
    const a = newGame(10, rng).cards.join();
    const b = newGame(10, rng).cards.join();
    expect(a).not.toBe(b);
  });
  it('the same seed gives the same board', () => {
    const seeded = () => {
      let s = 7;
      return () => (s = (s * 48271) % 2147483647) / 2147483647;
    };
    expect(newGame(15, seeded()).cards).toEqual(newGame(15, seeded()).cards);
  });
  it('board shapes: portrait 3x4 / 4x5 / 5x6, landscape 4x3 / 5x4 / 6x5', () => {
    expect([6, 10, 15].map((p) => boardShape(p as 6, false))).toEqual([
      { cols: 3, rows: 4 },
      { cols: 4, rows: 5 },
      { cols: 5, rows: 6 },
    ]);
    expect([6, 10, 15].map((p) => boardShape(p as 6, true))).toEqual([
      { cols: 4, rows: 3 },
      { cols: 5, rows: 4 },
      { cols: 6, rows: 5 },
    ]);
  });
  it('refuses a board where a picture is not exactly twice', () => {
    expect(() => gameFromCards([...sideBySide(5), P[0], P[0]])).toThrow();
    expect(() => gameFromCards(sideBySide(4))).toThrow();
  });
});

describe('pexeso turns (AC 4)', () => {
  it('a pair stays found, at most 2 cards open', () => {
    let g = gameFromCards(sideBySide(6));
    g = tapCard(g, 0);
    expect(g.open).toEqual([0]);
    g = tapCard(g, 1);
    expect(g.found[0] && g.found[1]).toBe(true);
    expect(g.open).toEqual([]);
    expect(g.foundPairs).toBe(1);
    expect(g.last).toEqual({ kind: 'pair', picture: P[0] });
    g = taps(g, 2, 4);
    expect(g.open).toEqual([2, 4]);
    expect(g.closing).toBe(true);
    // never 3 open: a third tap closes the two and opens the tapped card as the next card 1
    g = tapCard(g, 6);
    expect(g.open).toEqual([6]);
    expect(g.closing).toBe(false);
  });
  it('closeMiss (the 1.5 s timer) closes both cards of a miss', () => {
    const g = closeMiss(taps(gameFromCards(sideBySide(6)), 0, 2));
    expect(g.open).toEqual([]);
    expect(g.closing).toBe(false);
    expect(g.turns).toBe(1);
    // and changes nothing outside a miss
    const one = tapCard(gameFromCards(sideBySide(6)), 0);
    expect(closeMiss(one)).toBe(one);
  });
  it('taps on found or open cards change nothing; while a miss waits they only close it', () => {
    let g = taps(gameFromCards(sideBySide(6)), 0, 1, 2);
    expect(tapCard(g, 2)).toBe(g); // the open card 1 again (a double tap)
    expect(tapCard(g, 0)).toBe(g); // a found card
    g = tapCard(g, 4); // miss: 2 and 4 open
    const onOpen = tapCard(g, 4);
    expect(onOpen.open).toEqual([]);
    expect(onOpen.turns).toBe(g.turns);
    const onFound = tapCard(g, 1);
    expect(onFound.open).toEqual([]);
    expect(onFound.found).toEqual(g.found);
    expect(tapCard(onFound, 0)).toBe(onFound);
  });
  it('a finished board ignores taps', () => {
    const all = sideBySide(6).map((_, i) => i);
    const g = taps(gameFromCards(sideBySide(6)), ...all);
    expect(isFinished(g)).toBe(true);
    expect(g.turns).toBe(6);
    expect(tapCard(g, 0)).toBe(g);
  });
});

describe('forgotten and lucky misses (AC 5)', () => {
  it('a first-turn miss is always lucky', () => {
    for (const [a, b] of [
      [0, 1],
      [0, 6],
      [3, 11],
    ]) {
      const g = taps(gameFromCards(twoRows(6)), a, b);
      if (g.last?.kind === 'pair') continue;
      expect(g.last).toEqual({ kind: 'lucky' });
      expect(g.forgotten).toBe(0);
    }
  });
  it('two unseen cards are lucky', () => {
    // twoRows(6): 0..5 = a..f, 6..11 = a..f
    let g = closeMiss(taps(gameFromCards(twoRows(6)), 0, 1)); // a, b seen
    g = closeMiss(taps(g, 2, 3)); // c, d: both unseen, their partners 8, 9 unseen
    expect(g.lucky).toBe(2);
    expect(g.forgotten).toBe(0);
  });
  it('a seen partner followed by a wrong pick is forgotten', () => {
    let g = closeMiss(taps(gameFromCards(twoRows(6)), 0, 1)); // a(0), b(1) seen
    g = taps(g, 6, 2); // first card a(6): its partner 0 was seen, then a wrong pick
    expect(g.last).toEqual({ kind: 'forgotten' });
    expect(g.forgotten).toBe(1);
  });
  it('the rule looks at the FIRST card only', () => {
    let g = closeMiss(taps(gameFromCards(twoRows(6)), 0, 1)); // a(0), b(1) seen
    // first card c(2) (partner 8 never seen), second card a(6) whose partner 0 was seen: lucky
    g = taps(g, 2, 6);
    expect(g.last).toEqual({ kind: 'lucky' });
  });
  it('card 2 of a miss counts as seen for later turns', () => {
    let g = closeMiss(taps(gameFromCards(twoRows(6)), 0, 1)); // b(1) was card 2
    g = taps(g, 7, 3); // first card b(7): partner 1 seen (as card 2 earlier)
    expect(g.last).toEqual({ kind: 'forgotten' });
  });
  it('a card opened by the next-tap rule counts as seen once opened', () => {
    let g = taps(gameFromCards(twoRows(6)), 0, 1, 2); // miss 0/1, tap 2 closes and opens c(2)
    g = closeMiss(tapCard(g, 3)); // c(2) + d(3): lucky
    g = taps(g, 8, 4); // first card c(8): its partner 2 was opened by the next-tap rule
    expect(g.last).toEqual({ kind: 'forgotten' });
    expect([g.lucky, g.forgotten]).toEqual([2, 1]);
  });
  it('finding the seen partner is a pair, not a miss', () => {
    let g = closeMiss(taps(gameFromCards(twoRows(6)), 0, 1));
    g = taps(g, 6, 0);
    expect(g.last).toEqual({ kind: 'pair', picture: P[0] });
    expect([g.lucky, g.forgotten]).toEqual([1, 0]);
  });
});

describe('pexeso points (AC 6)', () => {
  it('free misses (hearts) first, then 1 point each, never below 1', () => {
    // 6 pictures, 1 free
    let g = gameFromCards(twoRows(6));
    g = closeMiss(taps(g, 0, 1)); // lucky
    expect([gamePoints(g), heartsLeft(g)]).toEqual([6, 1]);
    g = closeMiss(taps(g, 6, 2)); // forgotten 1: heart gone, points stay
    expect([gamePoints(g), heartsLeft(g)]).toEqual([6, 0]);
    g = closeMiss(taps(g, 6, 3)); // forgotten 2: 5 points
    expect([gamePoints(g), heartsLeft(g)]).toEqual([5, 0]);
    for (let i = 0; i < 10; i++) g = closeMiss(taps(g, 6, 4));
    expect(g.forgotten).toBe(12);
    expect(gamePoints(g)).toBe(1);
  });
  it('the formula for every board', () => {
    expect(pexesoPoints(6, 0, 1)).toBe(6);
    expect(pexesoPoints(6, 1, 1)).toBe(6);
    expect(pexesoPoints(6, 2, 1)).toBe(5);
    expect(pexesoPoints(6, 7, 1)).toBe(1);
    expect(pexesoPoints(6, 99, 1)).toBe(1);
    expect(pexesoPoints(10, 2, 2)).toBe(10);
    expect(pexesoPoints(10, 4, 2)).toBe(8);
    expect(pexesoPoints(15, 3, 3)).toBe(15);
    expect(pexesoPoints(15, 20, 3)).toBe(1);
  });
  it('the worked examples with the daily and Bear picks multipliers', () => {
    const logic = (level: number, play: number) => multiplierFor('logic', level, play);
    // 6 pictures (Logic 6), 0 forgotten = 6, Bear picks = 9
    expect(lessonPoints(pexesoPoints(6, 0, 1), logic(6, 1), false)).toBe(6);
    expect(lessonPoints(pexesoPoints(6, 0, 1), logic(6, 1), true)).toBe(9);
    // 10 pictures (Logic 7), 4 forgotten (2 free) = 8; 3rd play x0.5 = 4; Bear picks + x0.5 = 6
    const ten = pexesoPoints(10, 4, 2);
    expect(lessonPoints(ten, logic(7, 1), false)).toBe(8);
    expect(logic(7, 3)).toBe(0.5);
    expect(lessonPoints(ten, logic(7, 3), false)).toBe(4);
    expect(lessonPoints(ten, logic(7, 3), true)).toBe(6);
    // 15 pictures (Logic 8), 0 forgotten, Bear picks, first play = ceil(22.5) = 23
    expect(logic(8, 1)).toBe(1);
    expect(lessonPoints(pexesoPoints(15, 0, 3), logic(8, 1), true)).toBe(23);
    // 15 pictures, 20 forgotten = 1; 5th+ play = 1; Bear picks + x0.25 = 1
    const floor = pexesoPoints(15, 20, 3);
    expect(floor).toBe(1);
    expect(logic(8, 5)).toBe(0.25);
    expect(lessonPoints(floor, logic(8, 5), false)).toBe(1);
    expect(lessonPoints(floor, logic(8, 7), true)).toBe(1);
  });
});
