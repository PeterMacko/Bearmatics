import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import App from './App';

test('settings localizes in place, traps focus and restores its gear trigger without resetting practice', () => {
  render(<App />);
  expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show a hint' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show next hint' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close hint' }));
  const gear = screen.getByRole('button', { name: 'Settings' });
  gear.focus();
  fireEvent.click(gear);
  const dialog = screen.getByRole('dialog', { name: 'Settings' });
  const close = within(dialog).getByRole('button', { name: 'Close settings' });
  expect(close).toHaveFocus();
  expect(screen.getByRole('main')).toHaveAttribute('inert');
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'English' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
  expect(close).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  expect(screen.getByRole('dialog', { name: 'Nastavenia' })).toBe(dialog);
  expect(screen.getByRole('button', { name: 'Zvuk povolený' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(gear).toHaveFocus();
  expect(screen.getByRole('textbox')).toHaveValue('123');
  expect(screen.getByRole('status')).toHaveTextContent('Ešte nie');
  expect(screen.getByText('Príklad 1 z 10')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ukázať pomôcku' }));
  expect(screen.getByRole('dialog', { name: 'Pomôcka' })).toHaveTextContent('2 / 3');
});

test('compact back arrow confirms leaving and restores focus on cancel and Escape', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '7' } });
  const back = screen.getByRole('button', { name: 'Choose level' });
  expect(back).toHaveTextContent('←');
  expect(back).not.toHaveTextContent('Choose level');
  back.focus();
  fireEvent.click(back);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Keep practising' }));
  expect(back).toHaveFocus();
  fireEvent.click(back);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(back).toHaveFocus();
  expect(screen.getByRole('textbox')).toHaveValue('7');
});

test('settings, hint and leave dialogs exclude other modal requests', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '7' } });
  const gear = screen.getByRole('button', { name: 'Settings' });
  const hint = screen.getByRole('button', { name: 'Show a hint' });
  const back = screen.getByRole('button', { name: 'Choose level' });
  fireEvent.click(gear);
  fireEvent.click(hint);
  fireEvent.click(back);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Settings');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(hint);
  fireEvent.click(gear);
  fireEvent.click(back);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Hint');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(back);
  fireEvent.click(gear);
  fireEvent.click(hint);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Leave this trail?');
});

test('practice exposes exactly one progress indicator as the first app element', () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  expect(container.querySelector('.app-shell')?.firstElementChild).toBe(
    screen.getByRole('progressbar'),
  );
  expect(screen.getByText('Exercise 1 of 10')).toBeInTheDocument();
});
