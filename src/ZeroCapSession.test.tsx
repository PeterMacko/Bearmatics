import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import * as math from './math/engine';
import App from './App';

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const enter = (value: string) =>
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });

test('real twenty-question generation keeps per-presentation themes and exact zero/repeated-fact review with original score', () => {
  const session = math.generateSession(0, 20, () => 0);
  expect(session.filter((e) => e.values.includes(0))).toHaveLength(1);
  vi.spyOn(math, 'generateSession').mockReturnValue(session);
  const repeated = session.findIndex(
    (e, i) => session.findIndex((other) => other.values.join(',') === e.values.join(',')) !== i,
  );
  const first = session.findIndex((e) => e.values.join(',') === session[repeated].values.join(','));
  const zero = session.findIndex((e) => e.values.includes(0));
  const missed = [first, repeated, zero].sort((a, b) => a - b);
  expect(new Set(missed).size).toBe(3);
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('radio', { name: /Level 0 ·/ }));
  fireEvent.click(screen.getByRole('radio', { name: '20 exercises' }));
  click('Let’s count');
  const equations = new Map<number, string>();
  const themes = ['pirates', 'bears', 'lollipops', 'boats', 'aircraft'];
  const checkPresentation = (index: number) => {
    expect(
      screen.getByRole('img', {
        name: `First group: ${themes[index % 5]}. Count: ${session[index].values[0]}.${session[index].values[0] === 0 ? ' Empty group.' : ''}`,
      }),
    ).toBeInTheDocument();
    expect(container.querySelector('.picture-unknown')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
  };
  for (let i = 0; i < 20; i++) {
    expect(screen.getByText(`Exercise ${i + 1} of 20`)).toBeInTheDocument();
    checkPresentation(i);
    if (missed.includes(i)) {
      equations.set(i, container.querySelector('.equation')!.getAttribute('aria-label')!);
      enter('99');
      click('Check answer');
    }
    enter(String(session[i].values[2]));
    click('Check answer');
    click(i === 19 ? 'Review tricky ones' : 'Next exercise');
  }
  const checkReview = (index: number, remaining: number) => {
    expect(screen.getByText(`Review · ${remaining} to practise`)).toBeInTheDocument();
    expect(container.querySelector('.equation')).toHaveAttribute(
      'aria-label',
      equations.get(index),
    );
    checkPresentation(index);
  };
  checkReview(missed[0], 3);
  enter('99');
  click('Check answer');
  enter(String(session[missed[0]].values[2]));
  click('Check answer');
  click('Next exercise');
  const order = [missed[1], missed[2], missed[0]];
  for (const [i, index] of order.entries()) {
    checkReview(index, 3 - i);
    enter('abc');
    click('Check answer');
    enter(String(session[index].values[2]));
    click('Check answer');
    click(i === 2 ? 'See how you did' : 'Next exercise');
  }
  expect(screen.getByText('20 exercises completed')).toBeInTheDocument();
  expect(screen.getByText('17 / 20')).toBeInTheDocument();
});
