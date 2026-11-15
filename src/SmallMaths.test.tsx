import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import App from './App';
import { openMathematics, openSmallMaths } from './testing/openMathematics';

// SCRUM-141: Small maths holds the old level 0 (count the pictures), shown as Level 1.
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const heading = () => screen.getByRole('heading', { level: 2 });

test('course choice offers Small maths, Maths and English in this order', () => {
  render(<App />);
  const titles = [...document.querySelectorAll('.course-title')].map((e) => e.textContent);
  expect(titles).toEqual(['Small maths', 'Maths', 'English']);
});

test('Small maths menu: one level shown as Level 1, default size 10, own heading', () => {
  const { container } = render(<App />);
  openSmallMaths();
  expect(heading()).toHaveTextContent('What shall we count?');
  expect(document.activeElement).toBe(heading());
  expect(container.querySelectorAll('input[name="level"]')).toHaveLength(1);
  const level = screen.getByRole('radio', { name: /^Level 1 · Count the pictures/ });
  expect(level).toBeChecked();
  expect(container.querySelector('.level-number')).toHaveTextContent('1');
  expect(screen.getByRole('radio', { name: '10 exercises' })).toBeChecked();
});

test('Small maths practice is the picture counting exercise labelled Level 1', () => {
  const { container } = render(<App />);
  openSmallMaths();
  fireEvent.click(button('Let’s count'));
  expect(container.querySelector('.level-pill')).toHaveTextContent('Level 1');
  expect(container.querySelector('.picture-equation')).not.toBeNull();
  // Sums stay up to 6, like the old level 0.
  const terms = [...container.querySelectorAll('[data-term]')]
    .map((term) => Number(term.textContent))
    .filter((n) => !Number.isNaN(n));
  for (const n of terms) expect(n).toBeLessThanOrEqual(6);
});

test('Maths practice keeps its level numbers and no pictures', () => {
  const { container } = render(<App />);
  openMathematics();
  fireEvent.click(screen.getByRole('radio', { name: /^Level 3 / }));
  fireEvent.click(button('Let’s count'));
  expect(container.querySelector('.level-pill')).toHaveTextContent('Level 3');
  expect(container.querySelector('.picture-equation')).toBeNull();
});

test('each maths course keeps its own count; Back returns to the course choice', () => {
  render(<App />);
  openSmallMaths();
  fireEvent.click(screen.getByRole('radio', { name: '20 exercises' }));
  fireEvent.click(button('Back to courses'));
  expect(heading()).toHaveTextContent('What shall we learn today?');
  openMathematics();
  expect(screen.getByRole('radio', { name: '10 exercises' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  fireEvent.click(button('Back to courses'));
  openSmallMaths();
  expect(screen.getByRole('radio', { name: '20 exercises' })).toBeChecked();
  // Leaving a Small maths lesson returns to the Small maths menu.
  fireEvent.click(button('Let’s count'));
  fireEvent.click(button('Choose level'));
  expect(heading()).toHaveTextContent('What shall we count?');
});

test('Small maths in Slovak', () => {
  render(<App />);
  fireEvent.click(button('Settings'));
  fireEvent.click(button('Slovenčina'));
  fireEvent.click(button('Zavrieť nastavenia'));
  openSmallMaths();
  expect(heading()).toHaveTextContent('Čo budeme počítať?');
  expect(screen.getByRole('radio', { name: /^Úroveň 1 · Počítame obrázky/ })).toBeChecked();
});
