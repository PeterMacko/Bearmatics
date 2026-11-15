// SCRUM-118 rules 1-3 and 6 with fixed dates (AC 1).
import { describe, expect, it } from 'vitest';
import {
  answerOffer,
  daysBetween,
  finishDay,
  openOffer,
  slovakDay,
  streakView,
  unlockCost,
  type StreakState,
} from './streak';

const s = (
  streak: number,
  lastDay: string | null,
  offerDay: string | null = null,
): StreakState => ({
  streak,
  lastDay,
  offerDay,
});

describe('Slovak calendar day', () => {
  it('midnight in Slovakia, not UTC (winter, UTC+1)', () => {
    expect(slovakDay(Date.UTC(2026, 0, 14, 22, 59))).toBe('2026-01-14');
    expect(slovakDay(Date.UTC(2026, 0, 14, 23, 0))).toBe('2026-01-15');
  });
  it('midnight in summer (UTC+2)', () => {
    expect(slovakDay(Date.UTC(2026, 6, 14, 21, 59))).toBe('2026-07-14');
    expect(slovakDay(Date.UTC(2026, 6, 14, 22, 0))).toBe('2026-07-15');
  });
  it('summer/winter time changes do not skip or repeat a day', () => {
    // 2026-03-29 (23 h) and 2026-10-25 (25 h).
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(slovakDay(Date.UTC(2026, 2, 28, 23, 30))).toBe('2026-03-29');
    expect(slovakDay(Date.UTC(2026, 2, 29, 21, 59))).toBe('2026-03-29');
    expect(slovakDay(Date.UTC(2026, 2, 29, 22, 0))).toBe('2026-03-30');
    expect(slovakDay(Date.UTC(2026, 9, 25, 22, 59))).toBe('2026-10-25');
    expect(slovakDay(Date.UTC(2026, 9, 25, 23, 0))).toBe('2026-10-26');
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });
});

describe('cost (rule 3)', () => {
  it('10 per missed day, at most 10% rounded down, at least 1', () => {
    expect(unlockCost(2, 140)).toBe(14);
    expect(unlockCost(1, 140)).toBe(10);
    expect(unlockCost(1, 9)).toBe(1);
    expect(unlockCost(7, 5)).toBe(1);
    expect(unlockCost(3, 1000)).toBe(30);
    expect(unlockCost(7, 1000)).toBe(70);
  });
});

describe('finished lesson (rule 2)', () => {
  const today = '2026-11-16';
  it('first lesson ever -> 1', () => {
    expect(finishDay(s(0, null), today, 5)).toEqual({ state: s(1, today), offer: null });
  });
  it('same day -> no change', () => {
    expect(finishDay(s(4, today), today, 50)).toEqual({ state: s(4, today), offer: null });
  });
  it('next day -> +1', () => {
    expect(finishDay(s(4, '2026-11-15'), today, 50)).toEqual({ state: s(5, today), offer: null });
  });
  it('1 missed -> offer', () => {
    expect(finishDay(s(4, '2026-11-14'), today, 50)).toEqual({
      state: s(4, '2026-11-14', today),
      offer: { streak: 4, missed: 1, cost: 5 },
    });
  });
  it('7 missed -> offer; 8 missed -> 1', () => {
    expect(finishDay(s(9, '2026-11-08'), today, 500).offer).toEqual({
      streak: 9,
      missed: 7,
      cost: 50,
    });
    expect(finishDay(s(9, '2026-11-07'), today, 500)).toEqual({ state: s(1, today), offer: null });
  });
  it('0 points -> 1, no offer', () => {
    expect(finishDay(s(9, '2026-11-14'), today, 0)).toEqual({ state: s(1, today), offer: null });
  });
  it('the example: 12-day streak, 2 missed, 140 points -> cost 14; Yes -> 126 points, streak 13', () => {
    const { state, offer } = finishDay(s(12, '2026-11-13'), today, 140);
    expect(offer).toEqual({ streak: 12, missed: 2, cost: 14 });
    expect(answerOffer(state, today, 140, true)).toEqual({ state: s(13, today), points: 126 });
  });
  it('No thanks -> 1', () => {
    const { state } = finishDay(s(12, '2026-11-13'), today, 140);
    expect(answerOffer(state, today, 140, false)).toEqual({ state: s(1, today), points: 140 });
  });
});

describe('unanswered offer (rule 6)', () => {
  const today = '2026-11-16';
  it('comes back after the next lesson the same day, cost from the new points', () => {
    const first = finishDay(s(12, '2026-11-13'), today, 140).state;
    expect(finishDay(first, today, 150)).toEqual({
      state: first,
      offer: { streak: 12, missed: 2, cost: 15 },
    });
  });
  it('after midnight counts as No thanks (streak 1 on the offer day), then the normal rules', () => {
    const first = finishDay(s(12, '2026-11-13'), today, 140).state;
    // Next day: the offer day had a lesson -> streak 1 then, today +1 -> 2.
    expect(finishDay(first, '2026-11-17', 150)).toEqual({
      state: s(2, '2026-11-17'),
      offer: null,
    });
    // Two days later: 1 missed day after the offer day -> new offer for the streak of 1.
    expect(finishDay(first, '2026-11-18', 150).offer).toEqual({ streak: 1, missed: 1, cost: 10 });
    expect(openOffer(first, '2026-11-17', 150)).toBeNull();
    expect(answerOffer(first, '2026-11-17', 150, true)).toBeNull();
  });
  it('answer without an open offer -> null', () => {
    expect(answerOffer(s(3, today), today, 100, true)).toBeNull();
  });
});

describe('view', () => {
  const today = '2026-11-16';
  it('active, frozen, lost', () => {
    expect(streakView(s(0, null), today, 10)).toEqual({ streak: 0, frozen: false, today: false });
    expect(streakView(s(5, today), today, 10)).toEqual({ streak: 5, frozen: false, today: true });
    expect(streakView(s(5, '2026-11-15'), today, 10)).toEqual({
      streak: 5,
      frozen: false,
      today: false,
    });
    expect(streakView(s(5, '2026-11-14'), today, 10)).toEqual({
      streak: 5,
      frozen: true,
      today: false,
    });
    expect(streakView(s(5, '2026-11-08'), today, 10)).toEqual({
      streak: 5,
      frozen: true,
      today: false,
    });
    expect(streakView(s(5, '2026-11-07'), today, 10)).toEqual({
      streak: 0,
      frozen: false,
      today: false,
    });
    expect(streakView(s(5, '2026-11-14'), today, 0)).toEqual({
      streak: 0,
      frozen: false,
      today: false,
    });
    // Open offer today: still frozen; offer from yesterday unanswered: streak 1 from yesterday.
    expect(streakView(s(5, '2026-11-14', today), today, 10)).toEqual({
      streak: 5,
      frozen: true,
      today: false,
    });
    expect(streakView(s(5, '2026-11-13', '2026-11-15'), today, 10)).toEqual({
      streak: 1,
      frozen: false,
      today: false,
    });
  });
});
