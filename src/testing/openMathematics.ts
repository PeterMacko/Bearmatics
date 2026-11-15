import { fireEvent, screen } from '@testing-library/react';

/** The app opens on the course choice; maths tests start by opening Maths (levels 1-7). */
export function openMathematics() {
  fireEvent.click(screen.getByRole('button', { name: /^(Maths|Matematika)$/ }));
}

/** Small maths (SCRUM-141): the picture counting level, shown as Level 1 (engine level 0). */
export function openSmallMaths() {
  fireEvent.click(screen.getByRole('button', { name: /^(Small maths|Malá matematika)$/ }));
}
