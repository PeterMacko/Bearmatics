import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import App from './App';

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const heading = () => screen.getByRole('heading', { level: 2 });
const openEnglish = () => fireEvent.click(button('English'));

test('English home shows three levels, 5/10/20 and focuses its heading', () => {
  render(<App />);
  openEnglish();
  expect(heading()).toHaveTextContent('Which level shall we try?');
  expect(document.activeElement).toBe(heading());
  const levels = screen.getAllByRole('radio', { name: /^Level / });
  expect(levels.map((r) => r.closest('label')!.querySelector('.level-title')!.textContent)).toEqual(
    [
      'Level 1 · Listen and choose',
      'Level 2 · Listen and choose: similar-sounding words',
      'Level 3 · Listen and write',
    ],
  );
  expect(levels[0]).toBeChecked();
  // All three levels are playable now.
  expect(screen.queryByText(/coming soon/i)).toBeNull();
  for (const n of [5, 10, 20])
    expect(screen.getByRole('radio', { name: `${n} exercises` })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '10 exercises' })).toBeChecked();
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
});

test('English level 3 starts the listen-and-write screen', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  render(<App />);
  openEnglish();
  fireEvent.click(screen.getByRole('radio', { name: /^Level 3 / }));
  const start = button(/Let’s listen/);
  expect(start).not.toHaveAttribute('aria-disabled');
  fireEvent.click(start);
  expect(screen.getByRole('textbox', { name: 'Write the word you hear' })).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  vi.restoreAllMocks();
});

test('English home is localized and keeps its page and choices across a language switch', () => {
  render(<App />);
  openEnglish();
  fireEvent.click(screen.getByRole('radio', { name: /^Level 2 / }));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  fireEvent.click(button('Settings'));
  fireEvent.click(button('Slovenčina'));
  fireEvent.click(button('Zavrieť nastavenia'));
  expect(heading()).toHaveTextContent('Ktorú úroveň skúsime?');
  expect(screen.getByRole('radio', { name: /^Úroveň 2 · Počúvaj a vyber: podobne/ })).toBeChecked();
  expect(screen.getByRole('radio', { name: /^5 / })).toBeChecked();
  expect(screen.queryByText(/čoskoro/i)).toBeNull();
});

test('Back returns to the course choice; English and maths choices stay separate', () => {
  render(<App />);
  fireEvent.click(button('Mathematics'));
  fireEvent.click(screen.getByRole('radio', { name: /^Level 6 / }));
  fireEvent.click(button('Back to courses'));
  openEnglish();
  fireEvent.click(screen.getByRole('radio', { name: /^Level 3 / }));
  fireEvent.click(button('Back to courses'));
  expect(heading()).toHaveTextContent('What shall we learn today?');
  expect(document.activeElement).toBe(heading());
  fireEvent.click(button('Mathematics'));
  expect(screen.getByRole('radio', { name: /^Level 6 / })).toBeChecked();
  fireEvent.click(button('Back to courses'));
  openEnglish();
  expect(screen.getByRole('radio', { name: /^Level 3 / })).toBeChecked();
});
