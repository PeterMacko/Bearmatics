import { act, render, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StrictMode } from 'react';
import Bear from './Bear';
import App from './App';
import { openMathematics } from './testing/openMathematics';
let reduced = false;
let hidden = false;
let media: EventTarget;
beforeEach(() => {
  vi.useFakeTimers();
  media = new EventTarget();
  reduced = false;
  hidden = false;
  vi.stubGlobal('matchMedia', () =>
    Object.defineProperty(
      Object.assign(media, { media: '(prefers-reduced-motion: reduce)' }),
      'matches',
      { configurable: true, get: () => reduced },
    ),
  );
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const visibility = (value: boolean) =>
  act(() => {
    hidden = value;
    document.dispatchEvent(new Event('visibilitychange'));
  });
const motion = (value: boolean) =>
  act(() => {
    reduced = value;
    media.dispatchEvent(new Event('change'));
  });
test('reduced motion disables, cancels an active wink, and restarts a fresh idle interval', () => {
  reduced = true;
  const { container } = render(<App />);
  advance(30000);
  expect(container.querySelector('.bear')).not.toHaveAttribute('data-winking', 'true');
  motion(false);
  advance(30000);
  expect(container.querySelector('.bear')).toHaveAttribute('data-winking', 'true');
  motion(true);
  expect(container.querySelector('.bear')).not.toHaveAttribute('data-winking', 'true');
  expect(vi.getTimerCount()).toBe(0);
});
test('hidden document cancels the gesture and resumes without accumulated events', () => {
  const { container } = render(<App />);
  advance(29999);
  visibility(true);
  advance(120000);
  expect(container.querySelector('.bear')).not.toHaveAttribute('data-winking', 'true');
  expect(vi.getTimerCount()).toBe(0);
  visibility(false);
  advance(29999);
  expect(container.querySelector('.bear')).not.toHaveAttribute('data-winking', 'true');
  advance(1);
  expect(container.querySelector('.bear')).toHaveAttribute('data-winking', 'true');
  visibility(true);
  expect(container.querySelector('.bear')).not.toHaveAttribute('data-winking', 'true');
});
test('StrictMode and unmount retain only one timer and remove listeners', () => {
  const add = vi.spyOn(document, 'addEventListener'),
    remove = vi.spyOn(document, 'removeEventListener');
  const mediaAdd = vi.spyOn(media, 'addEventListener'),
    mediaRemove = vi.spyOn(media, 'removeEventListener');
  const { unmount } = render(
    <StrictMode>
      <Bear idleWink />
    </StrictMode>,
  );
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(mediaAdd.mock.calls).toHaveLength(2);
  expect(mediaRemove.mock.calls).toEqual(mediaAdd.mock.calls);
  const added = add.mock.calls.filter(([name]) => name === 'visibilitychange');
  const removed = remove.mock.calls.filter(([name]) => name === 'visibilitychange');
  expect(added).toHaveLength(2);
  expect(removed).toEqual(added);
  advance(120000);
  expect(vi.getTimerCount()).toBe(0);
});
test('menu-to-practice cancels wink timers and never alters practice', () => {
  const { container } = render(<App />);
  openMathematics();
  advance(30000);
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  expect(container.querySelector('.bear')).not.toHaveAttribute('data-winking', 'true');
  advance(1000);
  expect(vi.getTimerCount()).toBe(0);
  advance(120000);
  expect(container.querySelector('.bear-wink-eye')).toBeNull();
});
test('optional gesture defaults off and cannot replace happy or sad expressions', () => {
  const { container, rerender } = render(<Bear />);
  expect(vi.getTimerCount()).toBe(0);
  for (const mood of ['happy', 'sad'] as const) {
    rerender(<Bear mood={mood} idleWink />);
    advance(30000);
    expect(container.querySelector('.bear')).toHaveAttribute('data-mood', mood);
    expect(container.querySelector('.bear-wink-eye')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  }
});
test('menu idle motion shares wink visibility/reduced-motion lifecycle without extra schedulers', () => {
  const { container, rerender, unmount } = render(
    <StrictMode>
      <Bear idleWink />
    </StrictMode>,
  );
  const bear = () => container.querySelector('.bear')!;
  expect(bear()).toHaveAttribute('data-idle-motion', 'running');
  expect(vi.getTimerCount()).toBe(1);
  visibility(true);
  expect(bear()).toHaveAttribute('data-idle-motion', 'paused');
  expect(vi.getTimerCount()).toBe(0);
  visibility(false);
  expect(bear()).toHaveAttribute('data-idle-motion', 'running');
  motion(true);
  expect(bear()).toHaveAttribute('data-idle-motion', 'paused');
  motion(false);
  expect(bear()).toHaveAttribute('data-idle-motion', 'running');
  rerender(
    <StrictMode>
      <Bear />
    </StrictMode>,
  );
  expect(bear()).not.toHaveAttribute('data-idle-motion');
  expect(vi.getTimerCount()).toBe(0);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test('repeat onsets stay 30.24 seconds apart through menu rerenders', () => {
  const { container, unmount } = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  openMathematics();
  const bear = () => container.querySelector('.bear')!;
  advance(15000);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(container.querySelector('input[name=level][value="7"]')!);
  fireEvent.click(container.querySelectorAll('input[name=size]')[2]);
  advance(14999);
  expect(bear()).not.toHaveAttribute('data-winking');
  advance(1);
  expect(bear()).toHaveAttribute('data-winking', 'true');
  for (let n = 0; n < 3; n++) {
    advance(239);
    expect(bear()).toHaveAttribute('data-winking', 'true');
    advance(1);
    expect(bear()).not.toHaveAttribute('data-winking');
    advance(29999);
    expect(bear()).not.toHaveAttribute('data-winking');
    advance(1);
    expect(bear()).toHaveAttribute('data-winking', 'true');
  }
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  advance(60000);
  expect(vi.getTimerCount()).toBe(0);
});

test('menu waits 25–40 seconds before a short one-eye wink, then waits again', () => {
  const { container } = render(<App />);
  const bear = () => container.querySelector('.bear')!;
  expect(bear()).not.toHaveAttribute('data-winking', 'true');
  advance(24999);
  expect(bear()).not.toHaveAttribute('data-winking', 'true');
  advance(5001);
  expect(bear()).toHaveAttribute('data-winking', 'true');
  expect(bear().querySelectorAll('.bear-wink-eye')).toHaveLength(1);
  advance(300);
  expect(bear()).not.toHaveAttribute('data-winking', 'true');
  advance(24999);
  expect(bear()).not.toHaveAttribute('data-winking', 'true');
});
