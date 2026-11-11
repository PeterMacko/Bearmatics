import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import * as math from './math/engine';
import App from './App';

const facts: math.Exercise[] = [[0, 0, 0], [0, 6, 6], [6, 0, 6], [3, 3, 6], [1, 2, 3]].map(values => ({ level: 0, operation: '+', values: values as unknown as math.Fact, blank: 2 }));
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const enter = (value: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value } });

test('pictures conceal results through invalid wrong edits and final hint, reveal only on success and reset on Next', () => {
  vi.spyOn(math, 'generateSession').mockReturnValue(facts);
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('radio', { name: /Level 0 ·/ }));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' })); click('Let’s count');
  const hidden = () => {
    expect(container.querySelectorAll('.picture-group')).toHaveLength(3);
    const result = container.querySelectorAll('.picture-group')[2];
    expect(result).toHaveAttribute('aria-label', 'Missing amount');
    expect(result.querySelectorAll('svg,[data-picture-pip]')).toHaveLength(0);
    expect(result.outerHTML).not.toMatch(/Count|pirates|data-count/);
  };
  hidden(); expect(screen.getByRole('img', { name: 'First group: pirates. Count: 0. Empty group.' })).toBeInTheDocument();
  enter('abc'); click('Check answer'); hidden();
  enter('9'); click('Check answer'); hidden();
  enter(''); hidden();
  click('Show a hint'); click('Show next hint'); click('Show next hint');
  expect(screen.getByTestId('worked-solution')).toHaveTextContent('0 + 0 = 0');
  click('Close hint'); hidden(); expect(screen.getByRole('textbox')).toHaveValue('');
  enter(' 000 '); click('Check answer');
  expect(screen.getByRole('img', { name: 'Result: pirates. Count: 0. Empty group.' })).toBeInTheDocument();
  click('Next exercise'); hidden();
  expect(screen.getByRole('img', { name: 'Second group: bears. Count: 6.' }).querySelectorAll('svg')).toHaveLength(6);
  expect(Array.from(container.querySelectorAll('[data-term]')).map(e => e.textContent)).toEqual(['0', '6', '']);
});


test('review retains original theme and equation and requeues wrong or hinted attempts without inflating score', () => {
  vi.spyOn(math, 'generateSession').mockReturnValue(facts);
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('radio', { name: /Level 0 ·/ }));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' })); click('Let’s count');
  const original = container.querySelector('.equation')!.getAttribute('aria-label');
  const firstMarkup = container.querySelector('.picture-group')!.innerHTML;
  for (let index = 0; index < 5; index++) {
    if (index === 0) { enter('9'); click('Check answer'); }
    enter(String(facts[index].values[2])); click('Check answer');
    click(index === 4 ? 'Review tricky ones' : 'Next exercise');
  }
  const checkFresh = () => {
    expect(container.querySelector('.equation')).toHaveAttribute('aria-label', original);
    expect(container.querySelector('.picture-group')!.innerHTML).toBe(firstMarkup);
    expect(container.querySelector('.picture-unknown')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText('Review · 1 to practise')).toBeInTheDocument();
  };
  checkFresh(); enter('9'); click('Check answer'); enter('0'); click('Check answer'); click('Next exercise');
  checkFresh(); click('Show a hint'); click('Show next hint'); click('Close hint');
  click('Settings'); click('Slovenčina'); click('Zavrieť nastavenia');
  expect(screen.getByRole('img', { name: 'Chýbajúci počet' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Prvá skupina: piráti. Počet: 0. Prázdna skupina.' })).toBeInTheDocument();
  click('Ukázať pomôcku'); expect(container.querySelector('.hint-step')).toHaveTextContent('2 / 3'); click('Zavrieť pomôcku');
  click('Nastavenia'); click('English'); click('Close settings');
  enter('0'); click('Check answer'); click('Next exercise'); checkFresh();
  enter('x'); click('Check answer'); enter('0'); click('Check answer'); click('See how you did');
  expect(screen.getByText('4 / 5')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
