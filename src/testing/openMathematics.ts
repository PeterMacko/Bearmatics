import { fireEvent, screen } from '@testing-library/react';

/** The app opens on the course choice; maths tests start by opening Mathematics. */
export function openMathematics() {
  fireEvent.click(screen.getByRole('button', { name: /^(Mathematics|Matematika)$/ }));
}
