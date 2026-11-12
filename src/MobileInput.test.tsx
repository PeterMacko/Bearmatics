import { act, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import * as math from './math/engine';
import App from './App';

afterEach(() => vi.unstubAllGlobals());

function compactScreen() {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('max-width'), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
}

test('large hybrid touch hardware forces readonly before focus and offers no native switch', () => {
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { maxTouchPoints: 10 }));
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  start();
  const input = screen.getByRole('textbox');
  expect(input).toHaveAttribute('readonly');
  expect(input).toHaveAttribute('inputmode', 'none');
  expect(input).toHaveFocus();
  expect(screen.getByRole('group', { name: 'Number pad' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Use device keyboard' })).not.toBeInTheDocument();
  for (const key of ['1', '0', '0']) fireEvent.keyDown(input, { key });
  fireEvent.submit(input.closest('form')!);
  expect(screen.getByRole('status')).toHaveTextContent('That’s it! Nicely done.');
});
function start(pad = false) {
  vi.spyOn(math, 'generateSession').mockReturnValue(Array(5).fill({ level: 5, operation: '+', values: [99, 1, 100], blank: 2 }));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  if (pad) fireEvent.click(screen.getByRole('button', { name: 'Use number pad' }));
}

test.each(['en', 'sk'])('touch answer descriptions advertise only available controls in %s', language => {
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { maxTouchPoints: 5 }));
  start();
  if (language === 'sk') {
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zavrieť nastavenia' }));
  }
  const input = screen.getByRole('textbox');
  expect(input).toHaveAttribute('readonly');
  expect(input.getAttribute('aria-describedby')?.split(/\s+/)).toContain('answer-instructions');
  expect(screen.getByRole('group', { name: language === 'sk' ? 'Číselná klávesnica' : 'Number pad' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: language === 'sk' ? 'Použiť klávesnicu zariadenia' : 'Use device keyboard' })).not.toBeInTheDocument();
  expect(input).toHaveAccessibleDescription(language === 'sk'
    ? /^\s*Použi číselnú klávesnicu alebo číslice na klávesnici\. Backspace vymaže číslicu, Delete celú odpoveď a Enter ju skontroluje\.\s*$/
    : /^\s*Use the number pad or hardware digits, Backspace to erase, Delete to clear, and Enter to check\.\s*$/);
});

test('touch fallback overrides an earlier native preference without resetting answer or hints', () => {
  let updateTouch = () => {};
  const capability = { matches: false, addEventListener: vi.fn((_type, listener) => { updateTouch = listener; }), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn((query: string) => query === '(any-pointer: coarse)' ? capability : { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  start(true);
  fireEvent.click(screen.getByRole('button', { name: 'Use device keyboard' }));
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: '007' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show a hint' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close hint' }));
  input.focus();
  capability.matches = true; act(() => updateTouch());
  expect(input).toHaveAttribute('readonly');
  expect(input).toHaveFocus();
  expect(input).toHaveValue('007');
  expect(screen.queryByRole('button', { name: 'Use device keyboard' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show a hint' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Hint 1 / 3');
});

test('hint info icon sits beside the primary action and controls the dialog container', () => {
  start();
  const hint = screen.getByRole('button', { name: 'Show a hint' });
  expect(hint.textContent).toBe('i');
  expect(hint.previousElementSibling).toBe(screen.getByRole('button', { name: 'Check answer' }));
  fireEvent.click(hint);
  expect(document.getElementById(hint.getAttribute('aria-controls')!)).toBe(screen.getByRole('dialog'));
});

test('hint and settings close controls are localized visible cross icons', () => {
  start();
  for (const [open, close] of [['Show a hint', 'Close hint'], ['Settings', 'Close settings']]) {
    fireEvent.click(screen.getByRole('button', { name: open }));
    const button = screen.getByRole('button', { name: close });
    expect(button.textContent).toBe('×');
    expect(button).toHaveAttribute('title', close);
    fireEvent.click(button);
  }
});

test('non-touch desktop keeps native editing even in a narrow window', () => {
  compactScreen(); start();
  expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly');
  expect(screen.queryByRole('group', { name: 'Number pad' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use number pad' })).toBeInTheDocument();
});

test('held Enter cannot repeat checks or advance a newly solved exercise', () => {
  compactScreen(); start(true);
  const input = screen.getByRole('textbox');
  const repeatedCheck = createEvent.keyDown(input, { key: 'Enter', repeat: true });
  fireEvent(input, repeatedCheck);
  expect(repeatedCheck.defaultPrevented).toBe(true);
  for (const digit of ['1', '0', '0']) fireEvent.keyDown(input, { key: digit });
  fireEvent.submit(input.closest('form')!);
  const next = screen.getByRole('button', { name: 'Next exercise' });
  const repeatedNext = createEvent.keyDown(next, { key: 'Enter', repeat: true });
  fireEvent(next, repeatedNext);
  expect(repeatedNext.defaultPrevented).toBe(true);
  expect(screen.getByText('Exercise 1 of 5')).toBeInTheDocument();
});

test('desktop resizing keeps native editing and optional pad refocuses readonly without resetting practice', () => {
  let resize = () => {};
  const media = { matches: false, addEventListener: vi.fn((_type, listener) => { resize = listener; }), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn((query: string) => query.includes('max-width') ? media : { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  start();
  const input = screen.getByRole('textbox');
  expect(input).not.toHaveAttribute('readonly');
  expect(screen.queryByRole('group', { name: 'Number pad' })).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: '007' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show a hint' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close hint' }));
  input.focus();
  const blur = vi.spyOn(input, 'blur');
  media.matches = true;
  act(() => resize());
  expect(input).not.toHaveAttribute('readonly');
  fireEvent.click(screen.getByRole('button', { name: 'Use number pad' }));
  expect(blur).toHaveBeenCalledOnce();
  expect(input).toHaveAttribute('readonly');
  expect(input).toHaveFocus();
  expect(input).toHaveValue('007');
  fireEvent.click(screen.getByRole('button', { name: 'Show a hint' }));
  expect(screen.getByRole('region', { name: 'Hint' })).toHaveTextContent('Hint 1 / 3');
  fireEvent.click(screen.getByRole('button', { name: 'Close hint' }));
  fireEvent.click(screen.getByRole('button', { name: 'Use device keyboard' }));
  media.matches = false; act(() => resize());
  media.matches = true; act(() => resize());
  expect(input).not.toHaveAttribute('readonly');
  expect(input).toHaveValue('007');
});

test('native keyboard fallback preserves answer, hints and feedback through locale changes', () => {
  compactScreen(); start(true);
  const input = screen.getByRole('textbox');
  fireEvent.click(screen.getByRole('button', { name: '9' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show a hint' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close hint' }));
  const equation = screen.getByRole('group', { name: '99 plus 1 equals blank' });
  fireEvent.click(screen.getByRole('button', { name: 'Use device keyboard' }));
  expect(input).not.toHaveAttribute('readonly');
  expect(input).toHaveFocus();
  expect(input).toHaveValue('9');
  expect(screen.getByRole('status')).toHaveTextContent('Not quite');
  fireEvent.click(screen.getByRole('button', { name: 'Show a hint' }));
  expect(screen.getByRole('region', { name: 'Hint' })).toHaveTextContent('Hint 1 / 3');
  fireEvent.click(screen.getByRole('button', { name: 'Close hint' }));
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zavrieť nastavenia' }));
  fireEvent.click(screen.getByRole('button', { name: 'Použiť číselnú klávesnicu' }));
  expect(input).toHaveAttribute('readonly');
  expect(input).toHaveValue('9');
  expect(equation).toHaveAttribute('aria-label', '99 plus 1 rovná sa prázdne miesto');
  fireEvent.click(screen.getByRole('button', { name: 'Ukázať pomôcku' }));
  expect(screen.getByRole('region', { name: 'Pomôcka' })).toHaveTextContent('Pomôcka 1 / 3');
  fireEvent.click(screen.getByRole('button', { name: 'Zavrieť pomôcku' }));
});

test('compact hardware keys edit only the focused answer controls and announce localized values', () => {
  compactScreen(); start(true);
  const input = screen.getByRole('textbox');
  for (const key of ['1', '0', '0']) fireEvent.keyDown(input, { key });
  expect(input).toHaveValue('100');
  expect(screen.getByTestId('answer-announcement')).toHaveTextContent('Answer: 100');
  fireEvent.keyDown(input, { key: 'Backspace' });
  expect(input).toHaveValue('10');
  fireEvent.keyDown(input, { key: 'Delete' });
  expect(input).toHaveValue('');
  fireEvent.keyDown(input, { key: '5', ctrlKey: true });
  fireEvent.keyDown(screen.getByRole('button', { name: 'Show a hint' }), { key: '5' });
  expect(input).toHaveValue('');
  fireEvent.keyDown(input, { key: '9' });
  fireEvent.submit(input.closest('form')!);
  expect(screen.getByRole('status')).toHaveTextContent('Not quite');
  fireEvent.keyDown(screen.getByRole('button', { name: '9' }), { key: 'Delete' });
  expect(input).toHaveValue('');
  expect(screen.getByRole('status')).toHaveTextContent('');
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zavrieť nastavenia' }));
  expect(screen.getByTestId('answer-announcement')).toHaveTextContent('Odpoveď: prázdna');
  expect(screen.getByRole('button', { name: 'Vymazať poslednú číslicu' })).toBeInTheDocument();
});

test('compact number pad edits a three-digit answer without submitting and disables when solved', () => {
  compactScreen(); start(true);
  const input = screen.getByRole('textbox');
  expect(input).toHaveAttribute('readonly');
  expect(input).toHaveFocus();
  const pad = screen.getByRole('group', { name: 'Number pad' });
  expect(within(pad).getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual(['7', '8', '9', '0', '4', '5', '6', 'Clear answer', '1', '2', '3', 'Backspace']);
  for (const digit of ['1', '0', '0']) fireEvent.click(within(pad).getByRole('button', { name: digit }));
  expect(input).toHaveValue('100');
  expect(screen.getByRole('button', { name: 'Check answer' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
  expect(input).toHaveValue('10');
  fireEvent.click(screen.getByRole('button', { name: 'Clear answer' }));
  expect(input).toHaveValue('');
  for (const digit of ['1', '0', '0']) fireEvent.click(within(pad).getByRole('button', { name: digit }));
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  expect(input).toBeDisabled();
  for (const button of within(pad).getAllByRole('button')) expect(button).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next exercise' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Next exercise' }));
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
});

test('hint popup closes without consuming stages and contains keyboard focus', () => {
  compactScreen(); start(true);
  const trigger = screen.getByRole('button', { name: 'Show a hint' });
  trigger.focus(); fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Hint' });
  const close = within(dialog).getByRole('button', { name: 'Close hint' });
  expect(close).toHaveFocus();
  expect(screen.getByRole('main')).toHaveAttribute('inert');
  expect(dialog).toHaveTextContent('Hint 1 / 3');
  const next = within(dialog).getByRole('button', { name: 'Show next hint' });
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(next).toHaveFocus();
  fireEvent.keyDown(next, { key: 'Tab' }); expect(close).toHaveFocus();
  fireEvent.click(next); expect(dialog).toHaveTextContent('Hint 2 / 3');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Hint' })).not.toBeInTheDocument();
  expect(screen.getByRole('main')).not.toHaveAttribute('inert');
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger); expect(screen.getByRole('dialog')).toHaveTextContent('Hint 2 / 3');
  fireEvent.click(screen.getByRole('button', { name: 'Close hint' }));
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zavrieť nastavenia' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ukázať pomôcku' }));
  expect(screen.getByRole('dialog', { name: 'Pomôcka' })).toHaveTextContent('Pomôcka 2 / 3');
  fireEvent.click(screen.getByRole('button', { name: 'Zavrieť pomôcku' }));
});
