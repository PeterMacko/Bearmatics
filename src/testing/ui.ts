import { fireEvent, screen } from '@testing-library/react';

/** Clicks the button with this accessible name (a plain synthetic click, detail 0). */
export const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }));

/** A deliberate single tap (detail 1), as the app's double-tap guards expect from a real tap. */
export const tap = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }), { detail: 1 });
