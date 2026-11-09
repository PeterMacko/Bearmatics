import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import * as math from './math/engine';
import App from './App';

test('answer controls are neutral before checking, red for errors and green for success', () => {
  vi.spyOn(math, 'generateSession').mockReturnValue(Array(5).fill({ level: 1, operation: '+', values: [1, 2, 3], blank: 2 }));
  const { container } = render(<App />);
  expect(screen.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  expect(screen.getByRole('button', { name: 'Check answer' })).toHaveAttribute('data-state', 'neutral');
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  expect(screen.getByRole('status')).toHaveTextContent('Check the number.');
  expect(screen.queryByText('Type a whole number, like 3.')).not.toBeInTheDocument();
  expect(container.querySelector('.bear')).toHaveAttribute('data-mood', 'neutral');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  expect(screen.getByRole('button', { name: 'Check answer' })).toHaveAttribute('data-state', 'incorrect');
  expect(container.querySelector('.bear')).toHaveAttribute('data-mood', 'sad');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
  expect(screen.getByRole('button', { name: 'Check answer' })).toHaveAttribute('data-state', 'neutral');
  expect(container.querySelector('.bear')).toHaveAttribute('data-mood', 'neutral');
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  expect(screen.getByRole('button', { name: 'Next exercise' })).toHaveAttribute('data-state', 'correct');
  expect(container.querySelector('.bear')).toHaveAttribute('data-mood', 'happy');
  fireEvent.click(screen.getByRole('button', { name: 'Next exercise' }));
  expect(screen.getByRole('button', { name: 'Check answer' })).toHaveAttribute('data-state', 'neutral');
});

test('progressive hints preserve language/input, require submission and do not count as first-try success', () => {
  const fact: math.Exercise = { level: 1, operation: '+', values: [2, 3, 5], blank: 1 };
  vi.spyOn(math, 'generateSession').mockReturnValue(Array(5).fill(fact));
  render(<App />);
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show a hint' }));
  expect(screen.getByRole('region', { name: 'Hint' })).toHaveTextContent('Try a counting strategy');
  expect(screen.queryByTestId('worked-solution')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show next hint' }));
  expect(screen.getByRole('region', { name: 'Hint' }).querySelectorAll('.quantity')).toHaveLength(3);
  expect(screen.queryByTestId('worked-solution')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show next hint' }));
  expect(screen.getByTestId('worked-solution')).toHaveTextContent('5 − 2 = 3');
  expect(screen.getByRole('button', { name: 'All hints shown' })).toBeDisabled();
  expect(screen.getByRole('textbox')).toHaveValue('9');
  expect(screen.getByRole('textbox')).not.toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  expect(screen.getByRole('region', { name: 'Pomôcka' })).toHaveTextContent('Vypočítajme to spolu');
  expect(screen.getByRole('textbox')).toHaveValue('9');
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  for (let i = 0; i < 5; i++) {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    fireEvent.click(screen.getByRole('button', { name: i === 4 ? 'See how you did' : 'Next exercise' }));
    if (i < 4) {
      expect(screen.queryByRole('region', { name: 'Hint' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show a hint' })).toBeInTheDocument();
    }
  }
  expect(screen.getByText('4 / 5')).toBeInTheDocument();
});

test('keeps retries and language changes on the same exercise and completes exactly once', () => {
  const fact: math.Exercise = { level: 1, operation: '+', values: [1, 2, 3], blank: 2 };
  vi.spyOn(math, 'generateSession').mockReturnValue(Array(5).fill(fact));
  render(<App />);
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  let input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  expect(screen.getByRole('status')).toHaveTextContent('Not quite');
  expect(screen.getByText('Exercise 1 of 5')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  expect(input).toHaveValue('9');
  expect(screen.getByRole('status')).toHaveTextContent('Ešte nie');
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  for (let i = 0; i < 5; i++) {
    input = screen.getByRole('textbox');
    if (i === 1) {
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
      expect(screen.getByRole('status')).toHaveTextContent('Check the number.');
    }
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(screen.getByRole('status')).toHaveTextContent('Nicely done');
    expect(input).toBeDisabled();
    expect(screen.getByText(`Exercise ${i + 1} of 5`)).toBeInTheDocument();
    fireEvent.submit(input.closest('form')!); // duplicate submission must not increment counters
    fireEvent.click(screen.getByRole('button', { name: i === 4 ? 'Review tricky ones' : 'Next exercise' }));
  }
  expect(screen.getByRole('heading', { name: 'Let’s give these another try' })).toBeInTheDocument();
  expect(screen.getByText('Review · 1 to practise')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: '1 plus 2 equals blank' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Look how far you’ve come!' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next exercise' }));
  expect(screen.getByText('Review · 1 to practise')).toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  expect(screen.getByRole('heading', { name: 'Skúsme tieto príklady ešte raz' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  fireEvent.submit(screen.getByRole('textbox').closest('form')!);
  fireEvent.click(screen.getByRole('button', { name: 'See how you did' }));
  expect(screen.getByRole('heading', { name: 'Look how far you’ve come!' })).toBeInTheDocument();
  expect(screen.getByText('5 exercises completed')).toBeInTheDocument();
  expect(screen.getByText('4 / 5')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
  expect(screen.getByText('Exercise 1 of 5')).toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue('');
});

test('hint use is session progress and requires leave confirmation', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show a hint' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose level' }));
  expect(screen.getByRole('dialog', { name: 'Leave this trail?' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Keep practising' }));
  expect(screen.getByRole('region', { name: 'Hint' })).toHaveTextContent('Hint 1 / 3');
});

test('requires confirmation before abandoning progress and can cancel safely', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Choose level' }));
  expect(screen.getByRole('dialog', { name: 'Leave this trail?' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Keep practising' }));
  expect(screen.getByRole('textbox')).toHaveValue('123');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Choose level' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.getByRole('textbox')).toHaveValue('123');
  fireEvent.click(screen.getByRole('button', { name: 'Choose level' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose a new trail' }));
  expect(screen.getByRole('button', { name: 'Let’s count' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  expect(screen.getByRole('textbox')).toHaveValue('');
});

test('offers all levels and session sizes and starts a localized practice session', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Bearmatics', level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /Level 6/ })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '10 exercises' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: /Level 2/ }));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  expect(document.documentElement.lang).toBe('sk');
  fireEvent.click(screen.getByRole('button', { name: 'Začať počítať' }));
  expect(screen.getByText('Príklad 1 z 5')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: /Chýbajúce číslo/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByText('Exercise 1 of 5')).toBeInTheDocument();
  expect(document.documentElement.lang).toBe('en');
});
