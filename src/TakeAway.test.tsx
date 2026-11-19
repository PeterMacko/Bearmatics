import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import * as math from './math/engine';
import { FeedbackAudio } from './audio';
import App from './App';
import { openSmallMaths } from './testing/openMathematics';
import { click } from './testing/ui';

// SCRUM-156: Small maths level 2 "Take away" with the picture basket.
type Ex = math.Exercise;
const ex = (a: number, b: number): Ex =>
  Object.freeze({ level: 8, operation: '-', values: Object.freeze([a, b, a - b]), blank: 2 }) as Ex;

afterEach(() => vi.restoreAllMocks());

const basket = () => screen.getByRole('group', { name: 'Basket' });
const takenOut = () => screen.getByRole('group', { name: 'Taken out' });
const inBasket = () => within(basket()).queryAllByRole('button');
const out = () => within(takenOut()).queryAllByRole('button');
const answer = (value: string) => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
  click('Check answer');
};
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

async function start(exercises: Ex[]) {
  vi.spyOn(math, 'generateSession').mockReturnValue(exercises);
  vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockResolvedValue(true);
  const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
  render(<App />);
  openSmallMaths();
  fireEvent.click(screen.getByRole('radio', { name: /Level 2/ }));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  click('Let’s count');
  await flush();
  return play;
}

test('menu entry: Level 2 · Take away with its detail (SK too)', () => {
  render(<App />);
  openSmallMaths();
  expect(screen.getByRole('radio', { name: /Level 2/ })).toBeInTheDocument();
  expect(screen.getByText('Level 2 · Take away')).toBeInTheDocument();
  expect(screen.getByText('Take pictures out of the basket, up to 6')).toBeInTheDocument();
});

test('basket shows the first number; taps move out and back; no counter, no hint button', async () => {
  await start([ex(6, 2), ex(3, 1), ex(4, 4), ex(5, 0), ex(2, 1)]);
  expect(screen.getByText('Level 2')).toBeInTheDocument();
  expect(inBasket()).toHaveLength(6);
  expect(out()).toHaveLength(0);
  expect(inBasket()[0]).toHaveAccessibleName('Pirate, in the basket');
  fireEvent.click(inBasket()[0]);
  fireEvent.click(inBasket()[0]);
  fireEvent.click(inBasket()[0]);
  expect(inBasket()).toHaveLength(3);
  expect(out()).toHaveLength(3);
  expect(out()[0]).toHaveAccessibleName('Pirate, taken out');
  fireEvent.click(out()[0]);
  expect(inBasket()).toHaveLength(4);
  // Screen readers hear both counts after each move.
  expect(screen.getByText('In the basket: 4. Taken out: 2.')).toBeInTheDocument();
  // No visible counter, no hint button.
  expect(screen.queryByRole('button', { name: 'Show hint' })).toBeNull();
  expect(basket()).not.toHaveTextContent(/\d/);
});

test('moves never change scoring; basket kept after a wrong answer and after the correct one; full for the next example and the review repeat', async () => {
  const play = await start([ex(6, 2), ex(3, 1), ex(4, 4), ex(5, 0), ex(2, 1)]);
  fireEvent.click(inBasket()[0]);
  fireEvent.click(inBasket()[0]);
  expect(play.mock.calls.filter(([o]) => o === 'pop')).toHaveLength(2);
  answer('3'); // wrong
  expect(screen.getByRole('status')).toHaveTextContent(/not quite|try/i);
  expect(out()).toHaveLength(2);
  answer('4');
  expect(out()).toHaveLength(2); // stays after the correct answer
  click('Next exercise');
  expect(inBasket()).toHaveLength(3);
  expect(out()).toHaveLength(0);
  for (const value of ['2', '0', '5', '1']) {
    if (value === '0') fireEvent.click(inBasket()[0]);
    answer(value);
    click(/^(Next exercise|Review tricky ones|See how you did)/);
  }
  // Review repeat of 6 - 2: full basket again.
  expect(screen.getByRole('group', { name: /6 minus 2/ })).toBeInTheDocument();
  expect(inBasket()).toHaveLength(6);
  answer('4');
  click(/See how you did/);
  // First try score unaffected by the 3 moves: 4 of 5 first-try.
  expect(document.querySelector('.first-try strong')).toHaveTextContent('4 / 5');
});

test('keyboard: Enter and Space move a picture and focus follows it; muted = no pop', async () => {
  const play = await start([ex(5, 2), ex(3, 1), ex(4, 4), ex(5, 0), ex(2, 1)]);
  const first = inBasket()[0];
  first.focus();
  fireEvent.click(first, { detail: 0 }); // Enter/Space activate a button with a click
  await flush();
  expect(out()[0]).toHaveFocus();
  // Mute: moves stay silent.
  click('Settings');
  click('Sound on');
  click('Close settings');
  const before = play.mock.calls.length;
  fireEvent.click(inBasket()[0]);
  expect(play.mock.calls.length).toBe(before);
  expect(out()).toHaveLength(2);
});

test('Slovak names', async () => {
  await start([ex(2, 1), ex(3, 1), ex(4, 4), ex(5, 0), ex(2, 1)]);
  click('Settings');
  click('Slovenčina');
  click('Zavrieť nastavenia');
  expect(screen.getByRole('group', { name: 'Košík' })).toBeInTheDocument();
  expect(
    within(screen.getByRole('group', { name: 'Košík' })).getAllByRole('button')[0],
  ).toHaveAccessibleName('Pirát v košíku');
  fireEvent.click(within(screen.getByRole('group', { name: 'Košík' })).getAllByRole('button')[0]);
  expect(
    within(screen.getByRole('group', { name: 'Vybrané' })).getByRole('button'),
  ).toHaveAccessibleName('Pirát medzi vybranými');
  expect(screen.getByText('V košíku: 1. Vybrané: 1.')).toBeInTheDocument();
});

test('QA162-01: a double tap moves one picture only; a deliberate second tap later moves another', async () => {
  await start([ex(5, 2), ex(3, 1), ex(4, 4), ex(5, 0), ex(2, 1)]);
  fireEvent.click(inBasket()[0], { detail: 1 });
  // The second tap of the double tap lands on the picture that slid into place.
  fireEvent.click(inBasket()[0], { detail: 2 });
  fireEvent.click(inBasket()[0], { detail: 1 });
  expect(out()).toHaveLength(1);
  await act(async () => {
    await new Promise((done) => setTimeout(done, 400));
  });
  fireEvent.click(inBasket()[0], { detail: 1 });
  expect(out()).toHaveLength(2);
});
