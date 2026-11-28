// SCRUM-324: Pexeso (memory game, "Matching pairs") for one player, Logic levels 6-8.
// The child turns two cards per turn and finds every pair. Points reward memory, not luck:
// a miss costs a point only when it was "forgotten" (the partner of the turn's FIRST card had
// already been seen open in an earlier turn); the first 1 / 2 / 3 forgotten misses are free.
// Pure functions; the random source is passed in (seeded in tests).
import { shuffled } from '../random';
import type { Session } from '../session';

export type PexesoLevel = 6 | 7 | 8;
export const PEXESO_LEVELS: readonly PexesoLevel[] = [6, 7, 8];
export type PexesoPairs = 6 | 10 | 15;

/** Pictures (pairs) per level: Logic 6 / 7 / 8 = 6 / 10 / 15 pictures. */
export const PEXESO_PAIRS: Readonly<Record<PexesoLevel, PexesoPairs>> = { 6: 6, 7: 10, 8: 15 };

/** Forgotten misses that cost nothing (the hearts): 1 / 2 / 3. */
export const FREE_MISSES: Readonly<Record<PexesoPairs, number>> = { 6: 1, 10: 2, 15: 3 };

/** How long the two cards of a miss stay open before they turn face down again. */
export const PEXESO_CLOSE_MS = 1500;

export const isPexesoLevel = (level: number): level is PexesoLevel =>
  (PEXESO_LEVELS as readonly number[]).includes(level);

/** The 15 card pictures (art in PexesoArt.tsx, names in i18n). */
export const PEXESO_PICTURES = [
  'bear',
  'pirate',
  'lollipop',
  'boat',
  'plane',
  'apple',
  'fish',
  'ball',
  'house',
  'tree',
  'star',
  'flower',
  'car',
  'umbrella',
  'butterfly',
] as const;
export type PexesoPicture = (typeof PEXESO_PICTURES)[number];

/** What the last finished turn was (for the bear, the sounds and the polite message). */
type TurnResult =
  Readonly<{ kind: 'pair'; picture: PexesoPicture }> | Readonly<{ kind: 'forgotten' | 'lucky' }>;

export type PexesoGame = Readonly<{
  /** Card index (reading order) -> its picture. */
  cards: readonly PexesoPicture[];
  pairs: PexesoPairs;
  free: number;
  found: readonly boolean[];
  /** Shown face up at some time before (any earlier turn, or card 1 of this turn). */
  seen: readonly boolean[];
  /** The face-up cards that are not found: 0, 1 or 2 indices. */
  open: readonly number[];
  /** Two open cards that are not a pair, waiting to close (1.5 s or the next tap). */
  closing: boolean;
  /** Whether the partner of the current turn's first card was seen in an earlier turn. */
  partnerSeen: boolean;
  foundPairs: number;
  turns: number;
  forgotten: number;
  lucky: number;
  last: TurnResult | null;
}>;

/** A game from a fixed card order (tests, and `newGame`). Every picture must appear twice. */
export function gameFromCards(cards: readonly PexesoPicture[]): PexesoGame {
  const pairs = cards.length / 2;
  if (pairs !== 6 && pairs !== 10 && pairs !== 15)
    throw new Error(`unsupported board ${cards.length}`);
  for (const picture of new Set(cards)) {
    if (cards.filter((c) => c === picture).length !== 2) throw new Error(`${picture} not twice`);
  }
  return {
    cards: [...cards],
    pairs,
    free: FREE_MISSES[pairs],
    found: cards.map(() => false),
    seen: cards.map(() => false),
    open: [],
    closing: false,
    partnerSeen: false,
    foundPairs: 0,
    turns: 0,
    forgotten: 0,
    lucky: 0,
    last: null,
  };
}

/** A new board: `pairs` of the 15 pictures chosen at random, each twice, in random order. */
export function newGame(pairs: PexesoPairs, rng: () => number): PexesoGame {
  const pictures = shuffled(PEXESO_PICTURES, rng).slice(0, pairs);
  return gameFromCards(shuffled([...pictures, ...pictures], rng));
}

/** Close the two cards of a miss (the 1.5 s timer, or a tap). Nothing else changes. */
export function closeMiss(game: PexesoGame): PexesoGame {
  return game.closing ? { ...game, open: [], closing: false } : game;
}

/**
 * The child taps card `index`. Taps on found cards or on an open card change nothing (except
 * that while a miss waits to close, such a tap closes it). A tap on another card while a miss
 * waits closes the miss and opens the tapped card as card 1 of the next turn.
 */
export function tapCard(game: PexesoGame, index: number): PexesoGame {
  if (index < 0 || index >= game.cards.length || game.foundPairs === game.pairs) return game;
  if (game.closing) {
    const closed = closeMiss(game);
    if (game.found[index] || game.open.includes(index)) return closed;
    return tapCard(closed, index);
  }
  if (game.found[index] || game.open.includes(index)) return game;
  const seen = game.seen.map((s, i) => s || i === index);
  if (game.open.length === 0) {
    const partner = partnerOf(game.cards, index);
    return { ...game, seen, open: [index], partnerSeen: game.seen[partner] };
  }
  const first = game.open[0];
  const turns = game.turns + 1;
  if (game.cards[first] === game.cards[index]) {
    const found = game.found.map((f, i) => f || i === first || i === index);
    return {
      ...game,
      seen,
      found,
      open: [],
      turns,
      foundPairs: game.foundPairs + 1,
      partnerSeen: false,
      last: { kind: 'pair', picture: game.cards[index] },
    };
  }
  const forgotten = game.partnerSeen;
  return {
    ...game,
    seen,
    open: [first, index],
    closing: true,
    turns,
    partnerSeen: false,
    forgotten: game.forgotten + (forgotten ? 1 : 0),
    lucky: game.lucky + (forgotten ? 0 : 1),
    last: { kind: forgotten ? 'forgotten' : 'lucky' },
  };
}

function partnerOf(cards: readonly PexesoPicture[], index: number): number {
  return cards.findIndex((c, i) => i !== index && c === cards[index]);
}

export const isFinished = (game: PexesoGame) => game.foundPairs === game.pairs;

/** Points = max(1, pairs - max(0, forgotten - free)) (before the daily / Bear picks multipliers). */
export function pexesoPoints(pairs: number, forgotten: number, free: number): number {
  return Math.max(1, pairs - Math.max(0, forgotten - free));
}

export const gamePoints = (game: PexesoGame) => pexesoPoints(game.pairs, game.forgotten, game.free);

/** Hearts left (free forgotten misses not yet used). */
export const heartsLeft = (game: PexesoGame) => Math.max(0, game.free - game.forgotten);

/** Board shape (columns x rows): portrait 3x4 / 4x5 / 5x6, landscape (and wide) 4x3 / 5x4 / 6x5. */
export function boardShape(pairs: PexesoPairs, landscape: boolean): { cols: number; rows: number } {
  const [a, b] = pairs === 6 ? [3, 4] : pairs === 10 ? [4, 5] : [5, 6];
  return landscape ? { cols: b, rows: a } : { cols: a, rows: b };
}

/**
 * The game in the shape of a lesson Session (the bar, progress, leave question, summary and
 * points read it): one "exercise" per pair; `firstTry` is the game's points before the daily
 * and Bear picks multipliers; feedback 'correct' right after a pair (the correct cue).
 */
export function asSession(game: PexesoGame): Session<PexesoPicture> {
  const done = isFinished(game);
  const pictures = [...new Set(game.cards)];
  return {
    exercises: pictures,
    index: game.foundPairs,
    firstTry: gamePoints(game),
    attempts: game.turns,
    solved: false,
    done,
    feedback: !done && game.last?.kind === 'pair' && game.open.length === 0 ? 'correct' : 'ready',
    hintStage: 0,
    reviewing: false,
    reviewQueue: [],
  };
}
