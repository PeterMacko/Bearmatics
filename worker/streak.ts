// SCRUM-118: daily streak rules (pure functions, tested with fixed dates).
// A day is the calendar date in Slovak time (Europe/Bratislava, summer time included), decided
// on the server so a changed device clock does not matter.
import type { Offer, Streak } from '../shared/api-types';
import { daysBetween, slovakDay } from '../shared/slovakDay';

export type StreakState = {
  /** Days in a row with a finished lesson (missed days are never added). */
  streak: number;
  /** Last day with a finished lesson that counted, 'YYYY-MM-DD' in Slovak time. */
  lastDay: string | null;
  /** Day an unlock offer was made and not answered yet. */
  offerDay: string | null;
};

/** Longest break that can still be unlocked. */
const MAX_MISSED = 7;
const COST_PER_DAY = 10;

// The tests import the day helpers from here.
export { daysBetween, slovakDay };

/** Days without a lesson between the last counted day and today (0 = played yesterday). */
function missedDays(lastDay: string, today: string): number {
  return daysBetween(lastDay, today) - 1;
}

/** 10 points per missed day, at most 10% of the points (rounded down), at least 1. */
export function unlockCost(missed: number, points: number): number {
  return Math.min(COST_PER_DAY * missed, Math.max(1, Math.floor(points / 10)));
}

/** Rule 6: an offer left unanswered until after midnight counts as "No thanks". */
function settle(state: StreakState, today: string): StreakState {
  if (state.offerDay && state.offerDay < today)
    return { streak: 1, lastDay: state.offerDay, offerDay: null };
  return state;
}

/**
 * A lesson was finished (and counted) today. `points` already includes this lesson (rule 3).
 * Returns the new state and, when the streak is frozen, the unlock offer.
 */
export function finishDay(
  before: StreakState,
  today: string,
  points: number,
): { state: StreakState; offer: Offer | null } {
  const state = settle(before, today);
  if (!state.lastDay || state.streak < 1)
    return { state: { streak: 1, lastDay: today, offerDay: null }, offer: null };
  if (state.lastDay === today) return { state, offer: null };
  const missed = missedDays(state.lastDay, today);
  if (missed <= 0)
    return { state: { streak: state.streak + 1, lastDay: today, offerDay: null }, offer: null };
  if (missed <= MAX_MISSED && points > 0)
    return {
      state: { ...state, offerDay: today },
      offer: { streak: state.streak, missed, cost: unlockCost(missed, points) },
    };
  return { state: { streak: 1, lastDay: today, offerDay: null }, offer: null };
}

/** The open offer of today, if any (for the unlock answer). */
export function openOffer(before: StreakState, today: string, points: number): Offer | null {
  const state = settle(before, today);
  if (state.offerDay !== today || !state.lastDay) return null;
  const missed = missedDays(state.lastDay, today);
  if (missed < 1 || missed > MAX_MISSED || points <= 0) return null;
  return { streak: state.streak, missed, cost: unlockCost(missed, points) };
}

/** The answer to today's offer: Yes pays and continues (+1), No starts again at 1. */
export function answerOffer(
  before: StreakState,
  today: string,
  points: number,
  unlock: boolean,
): { state: StreakState; points: number } | null {
  const offer = openOffer(before, today, points);
  if (!offer) return null;
  if (!unlock) return { state: { streak: 1, lastDay: today, offerDay: null }, points };
  return {
    state: { streak: offer.streak + 1, lastDay: today, offerDay: null },
    points: points - offer.cost,
  };
}

/** What the app shows: the current streak (0 = none) and whether it is frozen. */
export function streakView(before: StreakState, today: string, points: number): Streak {
  const state = settle(before, today);
  // today: a lesson already counted for the streak today (Peter: lit flame only then).
  if (!state.lastDay || state.streak < 1) return { streak: 0, frozen: false, today: false };
  if (state.lastDay === today) return { streak: state.streak, frozen: false, today: true };
  const missed = missedDays(state.lastDay, today);
  if (missed <= 0) return { streak: state.streak, frozen: false, today: false };
  if (missed <= MAX_MISSED && points > 0)
    return { streak: state.streak, frozen: true, today: false };
  return { streak: 0, frozen: false, today: false };
}
