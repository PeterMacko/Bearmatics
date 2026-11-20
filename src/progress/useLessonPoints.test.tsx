import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '../account/api';
import type { Offer, Progress } from './api';
import { useLessonPoints } from './useLessonPoints';

type Finished = Progress & { added: number; offer: Offer | null };
const api = vi.hoisted(() => ({
  loadProgress: vi.fn<() => Promise<Progress>>(),
  startLesson: vi.fn<(size: number) => Promise<string>>(),
  finishLesson: vi.fn<(id: string, size: number, points: number) => Promise<Finished>>(),
}));
vi.mock('./api', async (original) => ({ ...(await original<object>()), ...api }));

const KID: Account = {
  kind: 'password',
  username: 'kid',
  nickname: 'Cub',
  bear: 1,
  email: null,
  leaderboard: true,
};
const progress = (points: number): Progress => ({
  points,
  streak: 3,
  frozen: false,
  today: true,
});
const finished = (points: number, added: number, offer: Offer | null = null): Finished => ({
  ...progress(points),
  added,
  offer,
});

type Props = { account: Account | null; accountKnown: boolean; finishedFirstTry: number | null };
const setup = (initial: Props) => {
  const playBadge = vi.fn();
  const hook = renderHook((props: Props) => useLessonPoints({ ...props, playBadge }), {
    initialProps: initial,
  });
  return { ...hook, playBadge };
};

beforeEach(() => {
  api.loadProgress.mockResolvedValue(progress(40));
  api.startLesson.mockResolvedValue('lesson-1');
  api.finishLesson.mockResolvedValue(finished(47, 7));
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
});
afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useLessonPoints', () => {
  it('loads points and streak for a signed-in player and clears them when signed out', async () => {
    const { result, rerender } = setup({
      account: KID,
      accountKnown: true,
      finishedFirstTry: null,
    });
    await waitFor(() => expect(result.current.points).toBe(40));
    expect(result.current.streak).toEqual({ streak: 3, frozen: false, today: true });
    expect(result.current.shownFrame?.points).toBe(40);
    rerender({ account: null, accountKnown: true, finishedFirstTry: null });
    expect(result.current.points).toBeNull();
    expect(result.current.streak).toBeNull();
    expect(result.current.shownFrame).toBeNull();
  });

  it('saves a finished lesson once, capped at its size', async () => {
    const { result, rerender } = setup({
      account: KID,
      accountKnown: true,
      finishedFirstTry: null,
    });
    await waitFor(() => expect(result.current.points).toBe(40));
    act(() => result.current.beginLesson(5));
    expect(api.startLesson).toHaveBeenCalledWith(5);
    expect(result.current.streakAtStart.current).toBe(3);
    rerender({ account: KID, accountKnown: true, finishedFirstTry: 9 });
    expect(result.current.lessonSave).toEqual({ state: 'saving' });
    await waitFor(() => expect(result.current.lessonSave?.state).toBe('saved'));
    expect(api.finishLesson).toHaveBeenCalledWith('lesson-1', 5, 5);
    expect(result.current.lessonSave).toEqual({
      state: 'saved',
      added: 7,
      before: 40,
      after: 47,
      firstTry: 5,
      multiplier: 1,
    });
    expect(result.current.points).toBe(47);
    rerender({ account: KID, accountKnown: true, finishedFirstTry: 9 });
    expect(api.finishLesson).toHaveBeenCalledTimes(1);
  });

  it('asks for the lesson ID once the account is known', async () => {
    const { result, rerender } = setup({
      account: null,
      accountKnown: false,
      finishedFirstTry: null,
    });
    act(() => result.current.beginLesson(10));
    expect(api.startLesson).not.toHaveBeenCalled();
    rerender({ account: KID, accountKnown: true, finishedFirstTry: null });
    expect(api.startLesson).toHaveBeenCalledWith(10);
    rerender({ account: KID, accountKnown: true, finishedFirstTry: 8 });
    await waitFor(() => expect(result.current.lessonSave?.state).toBe('saved'));
    expect(api.finishLesson).toHaveBeenCalledWith('lesson-1', 10, 8);
  });

  it('saves nothing when the account turns out signed out', async () => {
    const { result, rerender } = setup({
      account: null,
      accountKnown: false,
      finishedFirstTry: null,
    });
    act(() => result.current.beginLesson(10));
    rerender({ account: null, accountKnown: true, finishedFirstTry: null });
    rerender({ account: null, accountKnown: true, finishedFirstTry: 6 });
    await act(async () => {});
    expect(result.current.lessonSave).toBeNull();
    expect(api.startLesson).not.toHaveBeenCalled();
    expect(api.finishLesson).not.toHaveBeenCalled();
  });

  it('a signed-out lesson saves nothing', async () => {
    const { result, rerender } = setup({
      account: null,
      accountKnown: true,
      finishedFirstTry: null,
    });
    act(() => result.current.beginLesson(10));
    rerender({ account: null, accountKnown: true, finishedFirstTry: 6 });
    await act(async () => {});
    expect(result.current.lessonSave).toBeNull();
    expect(api.startLesson).not.toHaveBeenCalled();
  });

  it('saves each lesson once even when its result is seen again', async () => {
    const { result, rerender } = setup({
      account: KID,
      accountKnown: true,
      finishedFirstTry: null,
    });
    act(() => result.current.beginLesson(10));
    rerender({ account: KID, accountKnown: true, finishedFirstTry: 9 });
    await waitFor(() => expect(result.current.lessonSave?.state).toBe('saved'));
    rerender({ account: KID, accountKnown: true, finishedFirstTry: null });
    rerender({ account: KID, accountKnown: true, finishedFirstTry: 9 });
    await act(async () => {});
    expect(api.finishLesson).toHaveBeenCalledTimes(1);
  });

  it('a retry after a lost answer shows what the lesson gave', async () => {
    api.finishLesson.mockRejectedValueOnce(new Error('lost'));
    api.finishLesson.mockResolvedValueOnce(finished(46, 0));
    const { result, rerender } = setup({
      account: KID,
      accountKnown: true,
      finishedFirstTry: null,
    });
    act(() => result.current.beginLesson(10));
    rerender({ account: KID, accountKnown: true, finishedFirstTry: 6 });
    await waitFor(() => expect(result.current.lessonSave).toEqual({ state: 'failed' }));
    await act(() => result.current.saveLesson(6));
    expect(result.current.lessonSave).toEqual({
      state: 'saved',
      added: 6,
      before: 40,
      after: 46,
      firstTry: 6,
      multiplier: 1,
    });
  });

  it('after leaving, a late answer still updates the bar but not the summary', async () => {
    let answer: (value: Finished) => void = () => {};
    api.finishLesson.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { result, rerender } = setup({
      account: KID,
      accountKnown: true,
      finishedFirstTry: null,
    });
    act(() => result.current.beginLesson(10));
    rerender({ account: KID, accountKnown: true, finishedFirstTry: 10 });
    await waitFor(() => expect(api.finishLesson).toHaveBeenCalled());
    act(() => result.current.endLesson());
    expect(result.current.lessonSave).toBeNull();
    await act(async () => answer(finished(50, 10, { streak: 4, missed: 1, cost: 5 })));
    expect(result.current.points).toBe(50);
    expect(result.current.lessonSave).toBeNull();
    expect(result.current.offer).toBeNull();
  });

  it('opens the unlock offer 900 ms after saving with reduced motion', async () => {
    vi.useFakeTimers();
    const offer = { streak: 4, missed: 1, cost: 5 };
    api.finishLesson.mockResolvedValue(finished(47, 7, offer));
    const { result, rerender } = setup({
      account: KID,
      accountKnown: true,
      finishedFirstTry: null,
    });
    act(() => result.current.beginLesson(10));
    rerender({ account: KID, accountKnown: true, finishedFirstTry: 7 });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.lessonSave?.state).toBe('saved');
    expect(result.current.offer).toEqual({ offer, points: 47 });
    await act(() => vi.advanceTimersByTimeAsync(899));
    expect(result.current.offerOpen).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current.offerOpen).toBe(true);
    act(() => result.current.closeOffer());
    expect(result.current.offerOpen).toBe(false);
    expect(result.current.offer).toBeNull();
  });

  it('warming ends after 1.6 s', () => {
    vi.useFakeTimers();
    const { result } = setup({ account: null, accountKnown: true, finishedFirstTry: null });
    act(() => result.current.setWarming(true));
    act(() => vi.advanceTimersByTime(1599));
    expect(result.current.warming).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.warming).toBe(false);
  });
});

describe('daily multipliers (SCRUM-202)', () => {
  type Place = { course: 'small' | 'math' | 'english'; level: number };
  const DAY = '2026-11-20';
  const withDay = (points: number, added: number, day = DAY): Finished => ({
    ...finished(points, added),
    day,
  });
  /** Plays one lesson of `place` to the summary; returns the points sent to the server. */
  async function play(
    hook: ReturnType<typeof setup>,
    place: Place,
    firstTry: number,
    account: Account | null = KID,
  ) {
    const calls = api.finishLesson.mock.calls.length;
    act(() => hook.result.current.beginLesson(10, place));
    hook.rerender({ account, accountKnown: true, finishedFirstTry: firstTry });
    await waitFor(() => expect(hook.result.current.lessonSave?.state).not.toBe('saving'));
    hook.rerender({ account, accountKnown: true, finishedFirstTry: null });
    act(() => hook.result.current.endLesson());
    return api.finishLesson.mock.calls.length > calls
      ? api.finishLesson.mock.calls.at(-1)![2]
      : null;
  }
  const start = async (account: Account | null = KID) => {
    api.loadProgress.mockResolvedValue({ ...progress(40), day: DAY });
    api.finishLesson.mockImplementation(async (_id, _size, points) => withDay(40 + points, points));
    const hook = setup({ account, accountKnown: true, finishedFirstTry: null });
    if (account) await waitFor(() => expect(hook.result.current.points).toBe(40));
    return hook;
  };
  const math2: Place = { course: 'math', level: 2 };

  it('plays 1-2 full points, 3-4 half, 5 and later a quarter (rounded up)', async () => {
    const hook = await start();
    const sent = [];
    for (let n = 0; n < 6; n++) sent.push(await play(hook, math2, 9));
    expect(sent).toEqual([9, 9, 5, 5, 3, 3]);
    expect(await play(hook, { course: 'math', level: 3 }, 9)).toBe(9);
    expect(await play(hook, { course: 'small', level: 2 }, 9)).toBe(9);
  });

  it('the summary gets the first-try count and the multiplier', async () => {
    const hook = await start();
    await play(hook, math2, 9);
    await play(hook, math2, 9);
    act(() => hook.result.current.beginLesson(10, math2));
    hook.rerender({ account: KID, accountKnown: true, finishedFirstTry: 9 });
    await waitFor(() => expect(hook.result.current.lessonSave?.state).toBe('saved'));
    expect(hook.result.current.lessonSave).toMatchObject({
      added: 5,
      firstTry: 9,
      multiplier: 0.5,
    });
  });

  it('top level: first play x1.5, every later play x1; a 0-point first play uses the bonus', async () => {
    const hook = await start();
    expect(hook.result.current.nextMultiplier({ course: 'math', level: 7 })).toBe(1.5);
    expect(await play(hook, { course: 'math', level: 7 }, 9)).toBe(14);
    expect(hook.result.current.nextMultiplier({ course: 'math', level: 7 })).toBe(1);
    for (let n = 0; n < 5; n++) expect(await play(hook, { course: 'math', level: 7 }, 9)).toBe(9);
    expect(await play(hook, { course: 'english', level: 3 }, 0)).toBe(0);
    expect(await play(hook, { course: 'english', level: 3 }, 10)).toBe(10);
    expect(await play(hook, { course: 'small', level: 3 }, 20 / 2)).toBe(15);
  });

  it('the menu sign follows the next play; signed out: no sign and no counts', async () => {
    const hook = await start();
    expect(hook.result.current.nextMultiplier(math2)).toBe(1);
    await play(hook, math2, 4);
    await play(hook, math2, 4);
    expect(hook.result.current.nextMultiplier(math2)).toBe(0.5);
    await play(hook, math2, 4);
    await play(hook, math2, 4);
    expect(hook.result.current.nextMultiplier(math2)).toBe(0.25);
    hook.rerender({ account: null, accountKnown: true, finishedFirstTry: null });
    expect(hook.result.current.nextMultiplier(math2)).toBeNull();
    expect(await play(hook, math2, 4, null)).toBeNull();
  });

  it('a failed save is not a play; a retried save counts once and keeps its multiplier', async () => {
    const hook = await start();
    await play(hook, math2, 9);
    api.finishLesson.mockRejectedValueOnce(new Error('offline'));
    expect(await play(hook, math2, 9)).toBe(9); // failed: not counted
    expect(hook.result.current.nextMultiplier(math2)).toBe(1);
    // Second play: the first answer is lost, the retry finds it counted.
    api.finishLesson.mockRejectedValueOnce(new Error('lost'));
    act(() => hook.result.current.beginLesson(10, math2));
    hook.rerender({ account: KID, accountKnown: true, finishedFirstTry: 9 });
    await waitFor(() => expect(hook.result.current.lessonSave).toEqual({ state: 'failed' }));
    api.finishLesson.mockResolvedValueOnce(withDay(58, 0));
    await act(() => hook.result.current.saveLesson(9));
    await act(() => hook.result.current.saveLesson(9));
    expect(api.finishLesson.mock.calls.slice(-3).map((c) => c[2])).toEqual([9, 9, 9]);
    expect(hook.result.current.nextMultiplier(math2)).toBe(0.5); // two plays, not three
  });

  it('a lesson left before its summary does not count', async () => {
    const hook = await start();
    for (let n = 0; n < 2; n++) {
      act(() => hook.result.current.beginLesson(10, math2));
      act(() => hook.result.current.endLesson());
    }
    expect(api.finishLesson).not.toHaveBeenCalled();
    expect(await play(hook, math2, 9)).toBe(9);
    expect(hook.result.current.nextMultiplier(math2)).toBe(1);
  });

  it('counts per account: two children on one tablet', async () => {
    const hook = await start();
    await play(hook, math2, 9);
    await play(hook, math2, 9);
    const SIS: Account = { ...KID, username: 'sis', nickname: 'Sis' };
    hook.rerender({ account: SIS, accountKnown: true, finishedFirstTry: null });
    await waitFor(() => expect(hook.result.current.points).toBe(40));
    expect(hook.result.current.nextMultiplier(math2)).toBe(1);
    expect(await play(hook, math2, 9, SIS)).toBe(9);
    hook.rerender({ account: KID, accountKnown: true, finishedFirstTry: null });
    await waitFor(() => expect(hook.result.current.nextMultiplier(math2)).toBe(0.5));
  });

  it("starts again at Slovak midnight (the server's day)", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T22:30:00Z')); // 23:30 in Bratislava
    const hook = await start();
    await play(hook, math2, 9);
    await play(hook, math2, 9);
    expect(hook.result.current.nextMultiplier(math2)).toBe(0.5);
    vi.setSystemTime(new Date('2026-11-20T23:00:00Z')); // midnight in Bratislava
    expect(hook.result.current.nextMultiplier(math2)).toBe(1);
    api.finishLesson.mockImplementation(async (_id, _size, points) =>
      withDay(40 + points, points, '2026-11-21'),
    );
    expect(await play(hook, math2, 9)).toBe(9);
    expect(hook.result.current.nextMultiplier(math2)).toBe(1);
  });

  it('device/server day skew at midnight: the multiplier and the count use ONE day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T22:30:00Z')); // 23:30 in Bratislava, server agrees
    const hook = await start();
    await play(hook, math2, 9);
    await play(hook, math2, 9);
    // The device already says 00:00:10 (21 Nov) while the server still answers 20 Nov.
    vi.setSystemTime(new Date('2026-11-20T23:00:10Z'));
    expect(await play(hook, math2, 9)).toBe(9); // the new day's first play: x1 ...
    // ... and it is counted under that same new day, not as the old day's third play.
    expect(JSON.parse(localStorage.getItem('bearmatics-plays')!)).toEqual({
      'password:kid': { day: '2026-11-21', counts: { 'math:2': 1 } },
    });
  });

  it('device behind the server at midnight: the play counts under the day of its multiplier', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T22:30:00Z'));
    const hook = await start();
    await play(hook, math2, 9);
    await play(hook, math2, 9);
    // The device still says 23:59:50 (20 Nov); the server's answer already says 21 Nov.
    vi.setSystemTime(new Date('2026-11-20T22:59:50Z'));
    api.finishLesson.mockImplementation(async (_id, _size, points) =>
      withDay(40 + points, points, '2026-11-21'),
    );
    expect(await play(hook, math2, 9)).toBe(5); // the old day's third play: x1/2 ...
    // ... counted as that day's third play, not as the new day's first.
    expect(JSON.parse(localStorage.getItem('bearmatics-plays')!)).toEqual({
      'password:kid': { day: DAY, counts: { 'math:2': 3 } },
    });
  });

  it("uses the server's day over a wrong device clock", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T10:00:00Z')); // device two days behind
    const hook = await start();
    await play(hook, math2, 9);
    await play(hook, math2, 9);
    expect(JSON.parse(localStorage.getItem('bearmatics-plays')!)).toEqual({
      'password:kid': { day: DAY, counts: { 'math:2': 2 } },
    });
    expect(hook.result.current.nextMultiplier(math2)).toBe(0.5);
  });
});
