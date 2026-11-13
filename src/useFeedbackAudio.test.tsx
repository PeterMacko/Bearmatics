import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { FeedbackAudio } from './audio';
import type { Feedback } from './session';
import { useFeedbackAudio } from './useFeedbackAudio';

type Props = { feedback?: Feedback; attempts?: number; done?: boolean };
const setup = (enabled = true) => {
  const setEnabled = vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockResolvedValue(enabled);
  const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
  const dispose = vi.spyOn(FeedbackAudio.prototype, 'dispose');
  const hook = renderHook((p: Props) => useFeedbackAudio(p.feedback, p.attempts, p.done), {
    initialProps: {} as Props,
  });
  return { setEnabled, play, dispose, hook };
};
const activate = async (hook: ReturnType<typeof setup>['hook']) => {
  await act(async () => {
    await hook.result.current.activateSound();
  });
};

afterEach(() => vi.restoreAllMocks());

test('sound is wanted but not activated or played until activateSound is called', async () => {
  const { setEnabled, play, hook } = setup();
  expect(hook.result.current).toMatchObject({ soundEnabled: true, soundReady: false });
  hook.rerender({ feedback: 'correct', attempts: 1 });
  expect(setEnabled).not.toHaveBeenCalled();
  expect(play).not.toHaveBeenCalled();
  await activate(hook);
  expect(setEnabled).toHaveBeenCalledExactlyOnceWith(true);
  expect(hook.result.current.soundReady).toBe(true);
});

test('each reaction plays once per attempt', async () => {
  const { play, hook } = setup();
  await activate(hook);
  hook.rerender({ feedback: 'incorrect', attempts: 1 });
  hook.rerender({ feedback: 'incorrect', attempts: 1 });
  hook.rerender({ feedback: 'correct', attempts: 2 });
  expect(play.mock.calls).toEqual([['incorrect'], ['correct']]);
});

test('fanfare plays once per session and again only after resetForNewSession', async () => {
  const { play, hook } = setup();
  await activate(hook);
  hook.rerender({ done: true });
  hook.rerender({ done: false });
  hook.rerender({ done: true });
  expect(play.mock.calls).toEqual([['complete']]);
  act(() => hook.result.current.resetForNewSession());
  hook.rerender({ done: false });
  hook.rerender({ done: true });
  expect(play.mock.calls).toEqual([['complete'], ['complete']]);
});

test('completion while muted is consumed, not replayed after unmuting', async () => {
  const { play, hook } = setup();
  act(() => hook.result.current.toggleSound());
  expect(hook.result.current.soundEnabled).toBe(false);
  hook.rerender({ done: true });
  act(() => hook.result.current.toggleSound());
  await act(async () => {});
  hook.rerender({ done: true });
  expect(play).not.toHaveBeenCalled();
});

test('muting stops playback and disables audio', async () => {
  const { setEnabled, play, hook } = setup();
  await activate(hook);
  act(() => hook.result.current.toggleSound());
  expect(setEnabled).toHaveBeenLastCalledWith(false);
  expect(hook.result.current).toMatchObject({ soundEnabled: false, soundReady: false });
  hook.rerender({ feedback: 'correct', attempts: 1 });
  expect(play).not.toHaveBeenCalled();
});

test('muting while activation is pending wins over the late activation result', async () => {
  let resolve!: (value: boolean) => void;
  const setEnabled = vi
    .spyOn(FeedbackAudio.prototype, 'setEnabled')
    .mockImplementation((value) =>
      value ? new Promise<boolean>((r) => (resolve = r)) : Promise.resolve(false),
    );
  const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
  const hook = renderHook((p: Props) => useFeedbackAudio(p.feedback, p.attempts, p.done), {
    initialProps: {} as Props,
  });
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current.activateSound();
  });
  expect(hook.result.current.soundBusy).toBe(true);
  act(() => hook.result.current.toggleSound());
  await act(async () => {
    resolve(true);
    await pending;
  });
  expect(setEnabled).toHaveBeenLastCalledWith(false);
  expect(hook.result.current).toMatchObject({
    soundEnabled: false,
    soundReady: false,
    soundBusy: false,
  });
  hook.rerender({ feedback: 'correct', attempts: 1 });
  expect(play).not.toHaveBeenCalled();
});

test('blocked audio reports unavailable', async () => {
  const { hook } = setup(false);
  await activate(hook);
  expect(hook.result.current).toMatchObject({ soundReady: false, audioUnavailable: true });
});

test('audio is disposed on unmount', () => {
  const { dispose, hook } = setup();
  hook.unmount();
  expect(dispose).toHaveBeenCalledOnce();
});
