import { fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import * as math from '../math/engine';
import { openMathematics } from './openMathematics';
import { tap } from './ui';

/**
 * Plays a five-exercise Maths lesson of 1 + 2 = ? to the summary. With `wrongAt` the answer to
 * that exercise is wrong once, so the lesson ends with one review exercise.
 */
export async function playFive(wrongAt = -1) {
  vi.spyOn(math, 'generateSession').mockReturnValue(
    Array(5).fill({ level: 1, operation: '+', values: [1, 2, 3], blank: 2 }),
  );
  openMathematics();
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  tap('Let’s count');
  for (let i = 0; i < 5; i++) {
    if (i === wrongAt) {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '9' } });
      tap('Check answer');
    }
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
    tap('Check answer');
    tap(i < 4 ? 'Next exercise' : wrongAt >= 0 ? 'Review tricky ones' : 'See how you did');
  }
  if (wrongAt >= 0) {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
    tap('Check answer');
    tap('See how you did');
  }
}
