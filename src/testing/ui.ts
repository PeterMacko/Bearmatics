import { act, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';

/** The button with this accessible name. */
export const button = (name: string | RegExp) => screen.getByRole('button', { name });

/** The screen's level-2 heading. */
export const heading = () => screen.getByRole('heading', { level: 2 });

/** Lets pending promise callbacks (a resolved fetch, an audio promise) run inside act. */
export const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

/** Moves the fake timers on by `ms` inside act. */
export const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** Clicks the button with this accessible name (a plain synthetic click, detail 0). */
export const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }));

/** A deliberate single tap (detail 1), as the app's double-tap guards expect from a real tap. */
export const tap = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }), { detail: 1 });
