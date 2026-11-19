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
    expect(result.current.lessonSave).toEqual({ state: 'saved', added: 7, before: 40, after: 47 });
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
    expect(result.current.lessonSave).toEqual({ state: 'saved', added: 6, before: 40, after: 46 });
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
