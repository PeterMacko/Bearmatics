import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import * as math from './math/engine';
import App from './App';
import { openSmallMaths } from './testing/openMathematics';
import { click } from './testing/ui';

// SCRUM-164: Small maths level 3 "Up to 12": result as two dice, hidden until correct.
const ex = (a: number, b: number): math.Exercise =>
  Object.freeze({
    level: 9,
    operation: '+',
    values: Object.freeze([a, b, a + b]),
    blank: 2,
  }) as math.Exercise;

afterEach(() => vi.restoreAllMocks());

const answer = (value: string) => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
  click('Check answer');
};

function start(exercises: math.Exercise[]) {
  vi.spyOn(math, 'generateSession').mockReturnValue(exercises);
  const view = render(<App />);
  openSmallMaths();
  fireEvent.click(screen.getByRole('radio', { name: /^Level 3/ }));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  click('Let’s count');
  return view;
}

test('menu entry: Level 3 · Up to 12 with its detail', () => {
  render(<App />);
  openSmallMaths();
  expect(screen.getByText('Level 3 · Up to 12')).toBeInTheDocument();
  expect(screen.getByText('Add two dice, results 7 to 12')).toBeInTheDocument();
});

test('results 7-11 (12 below): hidden until correct, then a die of 6 and a die with the rest', () => {
  const facts = [ex(1, 6), ex(4, 4), ex(3, 6), ex(5, 5), ex(6, 5), ex(6, 6)];
  const { container } = start(facts.slice(0, 5));
  const check = (fact: math.Exercise) => {
    const total = fact.values[2];
    // Hidden: no count given away, no result dice.
    expect(container.querySelector('.dice-pair')).toBeNull();
    expect(screen.getByRole('img', { name: 'Missing amount' })).toBeInTheDocument();
    answer(String(total - 1)); // wrong: still hidden
    expect(container.querySelector('.dice-pair')).toBeNull();
    answer(String(total));
    const pair = screen.getByRole('img', { name: `Result: 6 and ${total - 6}, ${total}` });
    const dice = pair.querySelectorAll('.picture-group');
    expect(dice).toHaveLength(2);
    expect(dice[0].querySelectorAll('[data-picture-pip]')).toHaveLength(6);
    expect(dice[1].querySelectorAll('[data-picture-pip]')).toHaveLength(total - 6);
  };
  for (const fact of facts.slice(0, 5)) {
    check(fact);
    click(/^(Next exercise|Review tricky ones|See how you did)/);
  }
});

test('result 12 shows two full dice; no hint button, no basket; Slovak name', () => {
  const { container } = start([ex(6, 6), ex(1, 6), ex(4, 4), ex(3, 6), ex(5, 5)]);
  expect(container.querySelector('.level-pill')).toHaveTextContent('Level 3');
  expect(screen.queryByRole('button', { name: 'Show hint' })).toBeNull();
  expect(container.querySelector('.take-away')).toBeNull();
  answer('12');
  const pair = screen.getByRole('img', { name: 'Result: 6 and 6, 12' });
  for (const die of pair.querySelectorAll('.picture-group'))
    expect(die.querySelectorAll('[data-picture-pip]')).toHaveLength(6);
  click('Settings');
  click('Slovenčina');
  click('Zavrieť nastavenia');
  expect(screen.getByRole('img', { name: 'Výsledok: 6 a 6, 12' })).toBeInTheDocument();
});
