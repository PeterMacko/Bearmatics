import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import * as math from './math/engine';
import App from './App';

for (const review of [false, true]) {
  for (const replayDetail of [1, 0]) {
    test(`completion ignores continuation clicks and permits replay detail=${replayDetail}, review=${review}`, () => {
      const generate = vi
        .spyOn(math, 'generateSession')
        .mockReturnValue(Array(5).fill({ level: 1, operation: '+', values: [1, 2, 3], blank: 2 }));
      const { container } = render(<App />);
      const click = (name: string) =>
        fireEvent.click(screen.getByRole('button', { name }), { detail: 1 });
      const solve = (value = '3') => {
        fireEvent.change(screen.getByRole('textbox'), { target: { value } });
        click('Check answer');
      };
      fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
      click('Let’s count');
      for (let i = 0; i < 5; i++) {
        if (review && i === 4) solve('9');
        solve();
        click(i < 4 ? 'Next exercise' : review ? 'Review tricky ones' : 'See how you did');
      }
      if (review) {
        solve();
        click('See how you did');
      }
      const summary = screen.getByRole('heading', { name: 'Look how far you’ve come!' });
      expect(screen.getByText(`${review ? 4 : 5} / 5`)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Play again' }), { detail: 2 });
      expect(summary).toBeInTheDocument();
      expect(screen.getByText('5 exercises completed')).toBeInTheDocument();
      expect(screen.getByText(`${review ? 4 : 5} / 5`)).toBeInTheDocument();
      expect(container.querySelector('.bear')).toHaveAttribute('data-mood', 'happy');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(generate).toHaveBeenCalledTimes(1);
      // Native keyboard activation emits click detail=0; deliberate mouse/touch clicks emit 1.
      fireEvent.click(screen.getByRole('button', { name: 'Play again' }), { detail: replayDetail });
      expect(screen.getByText('Exercise 1 of 5')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Check answer' })).toHaveAttribute(
        'data-state',
        'neutral',
      );
      expect(generate).toHaveBeenCalledTimes(2);
    });
  }
}
