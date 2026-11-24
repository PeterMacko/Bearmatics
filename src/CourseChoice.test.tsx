import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import App from './App';

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const heading = () => screen.getByRole('heading', { level: 2 });

test('the app opens on the course choice with the five courses and nothing else to start', () => {
  render(<App />);
  expect(heading()).toHaveTextContent('What shall we learn today?');
  expect(button('Maths')).toHaveAccessibleDescription('Count, add, subtract, multiply and share');
  expect(button('Small maths')).toHaveAccessibleDescription(
    'Count pictures: add up to 12, take away up to 6',
  );
  expect(button('English')).toHaveAccessibleDescription('Listen to English words and learn them');
  // SCRUM-241: Word search is the fifth and last card.
  expect(button('Word search')).toHaveAccessibleDescription(
    'Find English words hidden among the letters',
  );
  expect(screen.getAllByRole('listitem').at(-1)).toContainElement(button('Word search'));
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.queryByRole('button', { name: /Back to courses/ })).toBeNull();
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
  // First load does not steal focus.
  expect(document.activeElement).toBe(document.body);
});

test('course choice is localized in Slovak', () => {
  render(<App />);
  fireEvent.click(button('Settings'));
  fireEvent.click(button('Slovenčina'));
  fireEvent.click(button('Zavrieť nastavenia'));
  expect(heading()).toHaveTextContent('Čo sa dnes naučíme?');
  expect(button('Malá matematika')).toHaveAccessibleDescription(
    'Počítaj obrázky: sčítaj do 12, odoberaj do 6',
  );
  expect(button('Matematika')).toBeInTheDocument();
  expect(button('Angličtina')).toBeInTheDocument();
  expect(button('Osemsmerovka')).toHaveAccessibleDescription(
    'Nájdi anglické slová skryté medzi písmenami',
  );
  expect(screen.getByRole('list', { name: 'Kurzy' })).toBeInTheDocument();
});

test('Maths opens the unchanged level menu and focuses its heading', () => {
  render(<App />);
  fireEvent.click(button('Maths'));
  expect(heading()).toHaveTextContent('Where shall we explore?');
  expect(document.activeElement).toBe(heading());
  expect(screen.getByRole('radio', { name: /^Level 1 / })).toBeChecked();
  expect(screen.getByRole('radio', { name: '10 exercises' })).toBeChecked();
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
});

test('Back returns to the course choice, focuses it and keeps the maths level and count', () => {
  render(<App />);
  fireEvent.click(button('Maths'));
  fireEvent.click(screen.getByRole('radio', { name: /^Level 5 / }));
  fireEvent.click(screen.getByRole('radio', { name: '20 exercises' }));
  fireEvent.click(button('Back to courses'));
  expect(heading()).toHaveTextContent('What shall we learn today?');
  expect(document.activeElement).toBe(heading());
  fireEvent.click(button('Maths'));
  expect(screen.getByRole('radio', { name: /^Level 5 / })).toBeChecked();
  expect(screen.getByRole('radio', { name: '20 exercises' })).toBeChecked();
});

test('leaving practice returns to the maths menu, not the course choice', () => {
  render(<App />);
  fireEvent.click(button('Maths'));
  fireEvent.click(button('Let’s count'));
  fireEvent.click(button('Choose level'));
  expect(heading()).toHaveTextContent('Where shall we explore?');
  expect(button('Back to courses')).toBeInTheDocument();
});
