import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { copy } from '../i18n';
import { AccountError } from './api';
import { CheckRow, SubmitButton } from './fields';
import { errorText, firstProblem, nicknameProblem } from './problems';

const t = copy.en.account;

describe('firstProblem', () => {
  it('returns the first failed check, in order', () => {
    expect(firstProblem([false, 'second', 'third'])).toBe('second');
    expect(firstProblem(['', 'nickname', false])).toBe('nickname');
  });

  it('returns an empty string when every check passes', () => {
    expect(firstProblem([false, '', false])).toBe('');
    expect(firstProblem([])).toBe('');
  });
});

describe('nicknameProblem', () => {
  it('checks the form first, then rude words', () => {
    expect(nicknameProblem(t, '')).toBe(t.errors.nickname);
    expect(nicknameProblem(t, 'Brave Cub')).toBe('');
  });
});

describe('errorText', () => {
  it('maps server errors to messages', () => {
    expect(errorText(t, new Error('x'))).toBe(t.errors.generic);
    expect(errorText(t, new AccountError('offline'))).toBe(t.errors.offline);
    expect(errorText(t, new AccountError('invalid', 'email'))).toBe(t.errors.email);
    expect(errorText(t, new AccountError('invalid', 'other'))).toBe(t.errors.generic);
    expect(errorText(t, new AccountError('not_allowed'))).toBe(t.errors.nicknameRude);
  });
});

describe('SubmitButton', () => {
  it('shows the working text only when one is given', () => {
    const { rerender } = render(<SubmitButton busy label="Save" working="Working" />);
    expect(screen.getByRole('button')).toHaveTextContent('Working');
    expect(screen.getByRole('button')).toBeDisabled();
    rerender(<SubmitButton busy label="Save e-mail" />);
    expect(screen.getByRole('button')).toHaveTextContent('Save e-mail');
    rerender(<SubmitButton busy={false} label="Save" working="Working" />);
    expect(screen.getByRole('button')).toHaveTextContent('Save');
    expect(screen.getByRole('button')).toBeEnabled();
  });
});

describe('CheckRow', () => {
  it('is never disabled while busy, only aria-disabled', () => {
    const { container, rerender } = render(
      <CheckRow id="row" label="Show me" checked busy describedBy="row-hint" onChange={() => {}} />,
    );
    const box = screen.getByRole('checkbox', { name: 'Show me' });
    expect(box).toBeEnabled();
    expect(box).toHaveAttribute('aria-disabled', 'true');
    expect(box).toHaveAttribute('aria-describedby', 'row-hint');
    rerender(<CheckRow id="row" label="Show me" checked={false} onChange={() => {}} />);
    const input = container.querySelector('input')!;
    expect(input.getAttributeNames()).toEqual(['id', 'type', 'checked']);
    expect(input.checked).toBe(false);
  });
});
