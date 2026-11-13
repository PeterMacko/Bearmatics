import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from '../App';
import { WordPlayer, type AudioLike } from './wordPlayer';

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

const lastPlayed = () => played[played.length - 1];
const wordButtons = () =>
  screen.getAllByRole('button').filter((b) => b.classList.contains('word-option'));
const wordButton = (word: string) =>
  wordButtons().find((b) => b.textContent!.toLowerCase() === word)!;

async function startEnglish(size = '5 exercises', level?: RegExp) {
  render(<App />);
  fireEvent.click(button('English'));
  if (level) fireEvent.click(screen.getByRole('radio', { name: level }));
  fireEvent.click(screen.getByRole('radio', { name: size }));
  await act(async () => fireEvent.click(button(/Let’s listen/)));
}

/** The spoken target is the word played when the question appeared. */
function currentTarget(): string {
  return lastPlayed();
}

async function answer(word: string) {
  await act(async () => fireEvent.click(wordButton(word)));
  await act(async () => fireEvent.click(button('Check answer')));
}

test('starting plays the first word; screen shows speaker, four words and Check, never the target', async () => {
  await startEnglish();
  const target = currentTarget();
  expect(played).toEqual([target]);
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Listen and choose the word');
  expect(screen.getByRole('progressbar')).toHaveAttribute('max', '5');
  expect(screen.getByText('Word 1 of 5')).toBeInTheDocument();
  expect(button('Play the word again')).toHaveFocus();
  expect(wordButtons()).toHaveLength(4);
  expect(wordButtons().map((b) => b.textContent!.toLowerCase())).toContain(target.toLowerCase());
  // Only the word buttons may contain the target text; heading, status and labels must not.
  const outside = document.body.textContent!.replace(
    wordButtons()
      .map((b) => b.textContent)
      .join(''),
    '',
  );
  expect(outside.toLowerCase()).not.toContain(` ${target.toLowerCase()} `);
  expect(button('Play the word again')).not.toHaveAccessibleName(new RegExp(target, 'i'));
});

test('speaker replays the target; tapping a word plays and selects it (one at a time)', async () => {
  await startEnglish();
  const target = currentTarget();
  await act(async () => fireEvent.click(button('Play the word again')));
  expect(lastPlayed()).toBe(target.toLowerCase());
  const [first, second] = wordButtons();
  await act(async () => fireEvent.click(first));
  expect(lastPlayed()).toBe(first.textContent!.toLowerCase());
  expect(first).toHaveAttribute('aria-pressed', 'true');
  await act(async () => fireEvent.click(second));
  expect(first).toHaveAttribute('aria-pressed', 'false');
  expect(second).toHaveAttribute('aria-pressed', 'true');
});

test('Check without a word asks to choose first and is not a mistake', async () => {
  await startEnglish();
  await act(async () => fireEvent.click(button('Check answer')));
  expect(screen.getByRole('status')).toHaveTextContent('Choose a word first.');
  await answer(currentTarget());
  expect(screen.getByRole('status')).toHaveTextContent('That’s it! Nicely done.');
});

test('wrong answer: try again, word returns in review; score counts first tries only', async () => {
  await startEnglish();
  const missed = currentTarget();
  const wrong = wordButtons().find((b) => b.textContent!.toLowerCase() !== missed.toLowerCase())!;
  await answer(wrong.textContent!.toLowerCase());
  expect(screen.getByRole('status')).toHaveTextContent('Not quite. Have another try');
  expect(wrong).toHaveAttribute('data-state', 'incorrect');
  await answer(missed.toLowerCase());
  expect(button(/Next word/)).toHaveFocus();
  for (let i = 2; i <= 5; i++) {
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /Next word|Review tricky ones/ })),
    );
    if (i <= 5 && screen.queryByText(`Word ${i} of 5`)) await answer(currentTarget().toLowerCase());
  }
  await act(async () => fireEvent.click(button(/Review tricky ones/)));
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
    'Let’s listen to these again',
  );
  expect(currentTarget().toLowerCase()).toBe(missed.toLowerCase());
  await answer(missed.toLowerCase());
  await act(async () => fireEvent.click(button(/See how you did/)));
  expect(screen.getByText('4 / 5')).toBeInTheDocument();
  expect(screen.getByText('5 words completed')).toBeInTheDocument();
  expect(screen.getByText('Your English course')).toBeInTheDocument();
});

test('muting feedback sounds does not mute the words', async () => {
  await startEnglish();
  fireEvent.click(button('Settings'));
  await act(async () => fireEvent.click(document.querySelector('.sound-toggle')!));
  expect(document.querySelector('.sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(button('Close settings'));
  const before = played.length;
  await act(async () => fireEvent.click(button('Play the word again')));
  expect(played.length).toBe(before + 1);
});

test('Back with progress asks before leaving; leaving stops the word and returns to the English home', async () => {
  await startEnglish();
  await act(async () => fireEvent.click(wordButtons()[0]));
  fireEvent.click(button('Choose level'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(button('Choose a new trail'));
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Which level shall we try?');
  expect(screen.queryByRole('progressbar')).toBeNull();
});

test('level 2 uses the similar-sounding alternatives', async () => {
  await startEnglish('5 exercises', /^Level 2 /);
  expect(screen.getByText('Level 2')).toBeInTheDocument();
});

function fakeAudio() {
  const listeners = new Map<string, Set<() => void>>();
  const audio = {
    src: '',
    currentTime: 0,
    preload: '',
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(() => listeners.get('pause')?.forEach((l) => l())),
    addEventListener: (type: string, l: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(l);
    },
    removeEventListener: (type: string, l: () => void) => listeners.get(type)?.delete(l),
    fire: (type: string) => [...(listeners.get(type) ?? [])].forEach((l) => l()),
  };
  return audio as unknown as AudioLike & {
    fire: (type: string) => void;
    play: ReturnType<typeof vi.fn>;
  };
}

test('WordPlayer: a new word stops the playing one; end and failure update the state', async () => {
  const audio = fakeAudio();
  const player = new WordPlayer(() => audio);
  const states: { playing: string | null; failed: boolean }[] = [];
  player.subscribe((s) => states.push(s));
  await player.play('cat');
  expect(audio.src).toMatch(/audio\/words\/cat\.mp3$/);
  await player.play('Suzy');
  expect(audio.src).toMatch(/audio\/words\/suzy\.mp3$/);
  expect(states.at(-1)).toEqual({ playing: 'Suzy', failed: false });
  audio.fire('ended');
  expect(states.at(-1)).toEqual({ playing: null, failed: false });
  audio.play.mockImplementationOnce(() => Promise.reject(new Error('blocked')));
  expect(await player.play('dog')).toBe(false);
  expect(states.at(-1)).toEqual({ playing: null, failed: true });
});

test('playing the target never highlights its button; tapping a word never animates the speaker', async () => {
  await startEnglish();
  const target = currentTarget();
  const speaker = button('Play the word again');
  expect(speaker).toHaveAttribute('data-playing', 'true');
  for (const b of wordButtons()) expect(b).toHaveAttribute('data-playing', 'false');
  await act(async () => fireEvent.click(speaker));
  for (const b of wordButtons()) expect(b).toHaveAttribute('data-playing', 'false');
  await act(async () => fireEvent.click(wordButton(target.toLowerCase())));
  expect(speaker).toHaveAttribute('data-playing', 'false');
  expect(wordButton(target.toLowerCase())).toHaveAttribute('data-playing', 'true');
});
