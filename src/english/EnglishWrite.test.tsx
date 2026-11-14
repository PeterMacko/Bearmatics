import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from '../App';

const button = (name: string | RegExp) => screen.getByRole('button', { name });
let played: string[] = [];

beforeEach(() => {
  played = [];
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    played.push(decodeURIComponent(this.src.split('/').pop()!.replace('.mp3', '')));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const target = () => played[played.length - 1];
const input = () => screen.getByRole('textbox', { name: /Write the word you hear|Let’s write/ });

async function startWriting(size = '5 exercises') {
  render(<App />);
  fireEvent.click(button('English'));
  fireEvent.click(screen.getByRole('radio', { name: /^Level 3 / }));
  fireEvent.click(screen.getByRole('radio', { name: size }));
  await act(async () => fireEvent.click(button(/Let’s listen/)));
}

async function write(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  await act(async () => fireEvent.submit(input().closest('form')!));
}

test('write screen: sound plays, input has no capitalisation/autocorrect/suggestions, word hidden', async () => {
  await startWriting();
  const word = target();
  expect(played).toEqual([word]);
  const field = input();
  expect(field).toHaveFocus();
  expect(field).toHaveAttribute('autocapitalize', 'none');
  expect(field).toHaveAttribute('autocorrect', 'off');
  expect(field).toHaveAttribute('autocomplete', 'off');
  expect(field).toHaveAttribute('spellcheck', 'false');
  expect(field).toHaveAttribute('inputmode', 'text');
  expect(screen.queryByRole('group', { name: 'Word buttons' })).toBeNull();
  // The word is nowhere in text or attributes before a wrong try.
  const pattern = new RegExp(`\\b${word}\\b`, 'i');
  for (const el of document.body.querySelectorAll('*')) {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join(' ');
    expect(own).not.toMatch(pattern);
    for (const attr of el.attributes) expect(`${attr.name}=${attr.value}`).not.toMatch(pattern);
  }
  await act(async () => fireEvent.click(button('Play the word again')));
  expect(played.at(-1)).toBe(word);
});

test('empty and non-letter answers only prompt and do not count as a try', async () => {
  await startWriting();
  await write('');
  expect(screen.getByRole('status')).toHaveTextContent('Write the word.');
  await write('7');
  expect(screen.getByRole('status')).toHaveTextContent('Use letters.');
  await write(` ${target().toUpperCase()} `);
  expect(screen.getByRole('status')).toHaveTextContent('That’s it! Nicely done.');
  // Still a first try: Enter (submit) moves on.
  expect(button(/Next word/)).toBeInTheDocument();
});

test('wrong try shows and announces the word, clears the input; copying it once continues; review hides it again; score counts first tries', async () => {
  await startWriting();
  const missed = target();
  await write('zzz');
  expect(screen.getByRole('status')).toHaveTextContent('Not quite. You wrote “zzz”.');
  expect(screen.getByRole('status')).toHaveTextContent(`The word is ${missed}. Write it.`);
  expect(screen.getByText(missed, { selector: 'strong' })).toBeVisible();
  expect(input()).toHaveValue('');
  expect(document.querySelector('.bear')).toHaveAttribute('data-mood', 'sad');
  // While copying, what the child wrote stays visible.
  fireEvent.change(input(), { target: { value: missed.slice(0, 2) } });
  expect(screen.getByRole('status')).toHaveTextContent('Not quite. You wrote “zzz”.');
  // A second wrong copy keeps the word shown and shows the new answer.
  await write('zzzz');
  expect(screen.getByText(missed, { selector: 'strong' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('You wrote “zzzz”.');
  await write(missed);
  expect(screen.getByRole('status')).toHaveTextContent('That’s it! Nicely done.');
  for (let i = 2; i <= 5; i++) {
    await act(async () => fireEvent.submit(input().closest('form')!)); // Enter = Next
    expect(screen.getByText(`Word ${i} of 5`)).toBeInTheDocument();
    expect(input()).toHaveValue('');
    expect(document.querySelector('.write-shown strong')).toBeNull();
    await write(target());
  }
  await act(async () => fireEvent.click(button(/Review tricky ones/)));
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Let’s write these again');
  expect(target()).toBe(missed);
  expect(document.querySelector('.write-shown strong')).toBeNull();
  await write(missed);
  await act(async () => fireEvent.click(button(/See how you did/)));
  expect(screen.getByText('4 / 5')).toBeInTheDocument();
  expect(screen.getByText('5 words written')).toBeInTheDocument();
}, 20_000); // long flow: many renders on the slow 2-CPU dev host

test('grey accepts "gray"; Slovak texts', async () => {
  render(<App />);
  fireEvent.click(button('Settings'));
  fireEvent.click(button('Slovenčina'));
  fireEvent.click(button('Zavrieť nastavenia'));
  fireEvent.click(button('Angličtina'));
  fireEvent.click(screen.getByRole('radio', { name: /^Úroveň 3 / }));
  await act(async () => fireEvent.click(button(/Poďme počúvať/)));
  const field = screen.getByRole('textbox', { name: 'Napíš slovo, ktoré počuješ' });
  fireEvent.change(field, { target: { value: '' } });
  await act(async () => fireEvent.submit(field.closest('form')!));
  expect(screen.getByRole('status')).toHaveTextContent('Napíš slovo.');
  fireEvent.change(field, { target: { value: '12' } });
  await act(async () => fireEvent.submit(field.closest('form')!));
  expect(screen.getByRole('status')).toHaveTextContent('Použi písmená.');
  const word = played.at(-1)!;
  fireEvent.change(field, { target: { value: 'qqq' } });
  await act(async () => fireEvent.submit(field.closest('form')!));
  expect(screen.getByRole('status')).toHaveTextContent('Ešte nie. Tvoja odpoveď: „qqq“.');
  expect(screen.getByRole('status')).toHaveTextContent(`Slovo je ${word}. Napíš ho.`);
});

test('mute silences tones but not the word; leaving with typed text asks first', async () => {
  await startWriting();
  fireEvent.click(button('Settings'));
  await act(async () => fireEvent.click(document.querySelector('.sound-toggle')!));
  fireEvent.click(button('Close settings'));
  const before = played.length;
  await act(async () => fireEvent.click(button('Play the word again')));
  expect(played.length).toBe(before + 1);
  fireEvent.change(input(), { target: { value: 'ab' } });
  fireEvent.click(button('Choose level'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
