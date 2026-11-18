import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import App from './App';
import { openMathematics } from './testing/openMathematics';

// CR-12: both ways out of a lesson (the leave dialog and Back without progress) end in one
// place; the next lesson always starts with an empty answer.
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const leaveThroughDialog = () => {
  fireEvent.click(button('Choose level'));
  expect(screen.getByRole('dialog', { name: 'Leave this trail?' })).toBeInTheDocument();
  fireEvent.click(button('Choose a new trail'));
};
const startEnglish = (level: 1 | 3) => {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^Level ${level} `) }));
  fireEvent.click(button(/Let’s listen/));
};

test('listen and choose: a chosen word asks first and is gone in the next lesson', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  render(<App />);
  fireEvent.click(button('English'));
  startEnglish(1);
  const words = () =>
    screen.getByRole('group', { name: 'Word buttons' }).querySelectorAll('button');
  const pressed = () => [...words()].filter((b) => b.getAttribute('aria-pressed') === 'true');
  fireEvent.click(words()[0]);
  expect(pressed()).toHaveLength(1);
  leaveThroughDialog();
  startEnglish(1);
  expect(pressed()).toHaveLength(0);
  // Nothing chosen: Back leaves at once, and the next lesson is fresh too.
  fireEvent.click(button('Choose level'));
  expect(screen.queryByRole('dialog')).toBeNull();
  startEnglish(1);
  expect(pressed()).toHaveLength(0);
});

test('listen and write: typed text asks first and is gone in the next lesson', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  render(<App />);
  fireEvent.click(button('English'));
  startEnglish(3);
  const input = () => screen.getByRole('textbox', { name: 'Write the word you hear' });
  fireEvent.change(input(), { target: { value: 'cat' } });
  leaveThroughDialog();
  startEnglish(3);
  expect(input()).toHaveValue('');
  fireEvent.change(input(), { target: { value: '   ' } });
  fireEvent.click(button('Choose level'));
  expect(screen.queryByRole('dialog')).toBeNull();
  startEnglish(3);
  expect(input()).toHaveValue('');
});

test('maths: whitespace only is no progress; Back leaves and the next lesson is empty', () => {
  render(<App />);
  openMathematics();
  fireEvent.click(button('Let’s count'));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  ' } });
  fireEvent.click(button('Choose level'));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(button('Let’s count'));
  expect(screen.getByRole('textbox')).toHaveValue('');
});
