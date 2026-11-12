import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import App from './App';

test('keeps one accessible identity without the obsolete visible mark on menu or practice', () => {
  const { container } = render(<App />);
  expect(container.querySelector('.brand-mark')).toBeNull();
  expect(screen.getAllByRole('heading', { name: 'Bearmatics', level: 1 })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  expect(container.querySelector('.brand-mark')).toBeNull();
  expect(screen.getAllByRole('heading', { name: 'Bearmatics', level: 1 })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Choose level' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Settings' })).toHaveLength(1);
});
