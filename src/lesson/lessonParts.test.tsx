import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { copy } from '../i18n';
import { prefersReducedMotion } from '../motion';
import NextButton from './NextButton';
import PictureDemo, { DEMO_MS, STILL_DEMO_MS } from './PictureDemo';
import ShowMeButton from './ShowMeButton';

// SCRUM-335 W2a (review RF-04): the shared lesson parts keep each screen's behaviour.

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test.each([
  // [guard, click detail, Next runs, default prevented]
  [true, 0, true, false],
  [true, 1, true, false],
  [true, 2, false, true],
  // Maths/English (AnswerActions): no repeat guard today (SCRUM-347), always prevented.
  [false, 0, true, true],
  [false, 1, true, true],
  [false, 2, true, true],
])('NextButton guard=%s, detail %s: runs %s, prevented %s', (guard, detail, runs, prevented) => {
  const onNext = vi.fn();
  const nextRef = createRef<HTMLButtonElement>();
  render(<NextButton label="Next exercise" nextRef={nextRef} onNext={onNext} guard={guard} />);
  const button = screen.getByRole('button', { name: 'Next exercise' });
  expect(nextRef.current).toBe(button);
  expect(button.outerHTML).toBe(
    '<button type="button" class="primary answer-button" data-state="correct">Next exercise<span aria-hidden="true"> →</span></button>',
  );
  const event = fireEvent.click(button, { detail });
  expect(onNext).toHaveBeenCalledTimes(runs ? 1 : 0);
  expect(!event).toBe(prevented);
});

test.each([
  // [aria-disabled prop, click detail, runs, attribute in the DOM]
  [false, 1, true, 'false'],
  [undefined, 1, true, null],
  [true, 1, false, 'true'],
  [false, 2, false, 'false'],
  [false, 0, true, 'false'],
])('ShowMeButton aria-disabled=%s, detail %s: runs %s', (ariaDisabled, detail, runs, attr) => {
  const onShowMe = vi.fn();
  render(
    <ShowMeButton
      t={copy.en}
      className="pattern-show-me"
      ariaDisabled={ariaDisabled}
      onShowMe={onShowMe}
    />,
  );
  const button = screen.getByRole('button', { name: 'Show me' });
  expect(button.className).toBe('secondary logic-show-me pattern-show-me');
  expect(button.getAttribute('aria-disabled')).toBe(attr);
  fireEvent.click(button, { detail });
  expect(onShowMe).toHaveBeenCalledTimes(runs ? 1 : 0);
});

test.each([
  [false, DEMO_MS, 'demo demo-moving', 0],
  [true, STILL_DEMO_MS, 'demo demo-still', 3],
])('PictureDemo reduced=%s: onDone once after %s ms', (reduced, ms, className, frames) => {
  vi.useFakeTimers();
  const onDone = vi.fn();
  const Scene = ({ step }: { step: unknown }) => <i data-step={String(step)} />;
  const { container } = render(
    <PictureDemo
      className="demo"
      frameClassName="frame"
      label="Demo"
      reduced={reduced}
      onDone={onDone}
      Scene={Scene}
    />,
  );
  const root = screen.getByRole('img', { name: 'Demo' });
  expect(root.className).toBe(className);
  expect(container.querySelectorAll('.frame')).toHaveLength(frames);
  act(() => vi.advanceTimersByTime(ms - 1));
  expect(onDone).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onDone).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(ms * 2));
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('prefersReducedMotion follows the media query and is false without matchMedia', () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
  }));
  expect(prefersReducedMotion()).toBe(true);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  expect(prefersReducedMotion()).toBe(false);
  vi.stubGlobal('matchMedia', undefined);
  expect(prefersReducedMotion()).toBe(false);
});
