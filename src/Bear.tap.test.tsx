import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as math from './math/engine';
import { FeedbackAudio } from './audio';
import Bear from './Bear';
import App from './App';
import { openMathematics } from './testing/openMathematics';

// SCRUM-172: tapping the bear shows "Grrr!" / "Brum brum!", closes its eyes happily, hops (not
// with reduced motion) and growls (follows Mute). Secret and harmless: never during an answer
// reaction, one at a time, no focus change, no lesson change.

let reduced = false;
beforeEach(() => {
  reduced = false;
  vi.stubGlobal('matchMedia', (query: string) =>
    Object.assign(new EventTarget(), {
      media: query,
      get matches() {
        return query.includes('reduce') && reduced;
      },
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const bear = () => document.querySelector<SVGSVGElement>('svg.bear')!;
const bubble = () => document.querySelector('.bear-bubble');
/** A real pointer tap: pointerdown, mousedown, click. Returns whether defaults were allowed. */
function tap() {
  const target = bear();
  const pointer = fireEvent.pointerDown(target, { pointerType: 'touch' });
  const mouse = fireEvent.mouseDown(target);
  fireEvent.mouseUp(target);
  fireEvent.click(target, { detail: 1 });
  return { pointer, mouse };
}

test('a tap shows the bubble, closes the eyes and hops for 1.5 s; the bubble is hidden', () => {
  vi.useFakeTimers();
  const onTap = vi.fn();
  render(<Bear bubble="Grrr!" onTap={onTap} />);
  expect(bubble()).toBeNull();
  const { pointer, mouse } = tap();
  // Default prevented: the tap never moves focus.
  expect(pointer).toBe(false);
  expect(mouse).toBe(false);
  expect(onTap).toHaveBeenCalledOnce();
  expect(bubble()).toHaveTextContent('Grrr!');
  expect(bubble()).toHaveAttribute('aria-hidden', 'true');
  expect(bear()).toHaveAttribute('data-tapped', 'true');
  expect(bear()).toHaveAttribute('data-tap-hop', 'true');
  expect(bear().querySelector('.bear-tap-eyes')).not.toBeNull();
  expect(bear().querySelector('.bear-tap-mouth')).not.toBeNull();
  act(() => vi.advanceTimersByTime(1499));
  expect(bubble()).not.toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(bubble()).toBeNull();
  expect(bear()).not.toHaveAttribute('data-tapped');
  expect(bear().querySelector('.bear-tap-eyes')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

test('one at a time: taps while the reaction runs are ignored, the next one after it works', () => {
  vi.useFakeTimers();
  const onTap = vi.fn();
  render(<Bear bubble="Grrr!" onTap={onTap} />);
  tap();
  act(() => vi.advanceTimersByTime(700));
  tap();
  tap();
  expect(onTap).toHaveBeenCalledOnce();
  act(() => vi.advanceTimersByTime(800));
  expect(bubble()).toBeNull();
  tap();
  expect(onTap).toHaveBeenCalledTimes(2);
  expect(bubble()).not.toBeNull();
});

test('ignored during an answer reaction', () => {
  const onTap = vi.fn();
  const { rerender } = render(<Bear mood="happy" reacting bubble="Grrr!" onTap={onTap} />);
  tap();
  rerender(<Bear mood="sad" reacting bubble="Grrr!" onTap={onTap} />);
  tap();
  expect(onTap).not.toHaveBeenCalled();
  expect(bubble()).toBeNull();
  expect(bear()).not.toHaveAttribute('data-tapped');
});

test('summary: ignored while the cheer runs, works afterwards', () => {
  vi.useFakeTimers();
  const onTap = vi.fn();
  render(<Bear mood="happy" bubble="Brum brum!" onTap={onTap} />);
  tap();
  expect(onTap).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(700));
  tap();
  expect(onTap).toHaveBeenCalledOnce();
  expect(bubble()).toHaveTextContent('Brum brum!');
});

test('reduced motion: face and bubble only, no hop', () => {
  reduced = true;
  render(<Bear bubble="Grrr!" onTap={() => {}} />);
  tap();
  expect(bubble()).not.toBeNull();
  expect(bear()).toHaveAttribute('data-tapped', 'true');
  expect(bear()).not.toHaveAttribute('data-tap-hop');
});

test('secret: the bear is not focusable and not announced', () => {
  render(<Bear bubble="Grrr!" onTap={() => {}} />);
  tap();
  expect(bear()).toHaveAttribute('aria-hidden', 'true');
  expect(bear()).toHaveAttribute('focusable', 'false');
  expect(bear()).not.toHaveAttribute('tabindex');
  expect(
    screen.queryByText('Grrr!', { ignore: '[aria-hidden="true"], [aria-hidden="true"] *' }),
  ).toBeNull();
});

/** Starts a 5-exercise maths lesson of 1 + 2 = ?. */
function startLesson() {
  vi.spyOn(math, 'generateSession').mockReturnValue(
    Array(5).fill({ level: 1, operation: '+', values: [1, 2, 3], blank: 2 }),
  );
  render(<App />);
  openMathematics();
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
}
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

test('in a lesson: a tap keeps focus, the typed answer and the exercise; SK says Brum brum', async () => {
  vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockResolvedValue(true);
  const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
  startLesson();
  await flush();
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: '7' } });
  input.focus();
  const before = document.querySelector('.practice')!.textContent;
  tap();
  expect(bubble()).toHaveTextContent('Grrr!');
  expect(input).toHaveFocus();
  expect(input).toHaveValue('7');
  expect(document.querySelector('.practice')!.textContent).toBe(before);
  expect(play.mock.calls.filter(([o]) => o === 'growl')).toHaveLength(1);
  // During the answer reaction the bear ignores taps.
  fireEvent.change(input, { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  expect(bear()).toHaveAttribute('data-mood', 'happy');
  tap();
  expect(bubble()).toBeNull();
  expect(play.mock.calls.filter(([o]) => o === 'growl')).toHaveLength(1);
  // Slovak bubble.
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zavrieť nastavenia' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ďalší príklad' }));
  tap();
  expect(bubble()).toHaveTextContent('Brum brum!');
});

test('growl follows Mute; in the menu the tap itself allows sound', async () => {
  const activate = vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockResolvedValue(true);
  const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
  render(<App />);
  openMathematics();
  tap();
  await flush();
  await flush();
  expect(activate).toHaveBeenCalledWith(true);
  expect(play.mock.calls.filter(([o]) => o === 'growl')).toHaveLength(1);
  // Mute: no growl, bubble still shows.
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: /^Sound/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
  await flush();
  await act(async () => {
    await new Promise((done) => setTimeout(done, 1600));
  });
  play.mockClear();
  activate.mockClear();
  tap();
  await flush();
  expect(bubble()).not.toBeNull();
  expect(play).not.toHaveBeenCalled();
  expect(activate).not.toHaveBeenCalledWith(true);
});
