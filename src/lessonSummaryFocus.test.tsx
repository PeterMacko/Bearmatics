import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App';
import { DEMO_KEYS } from './demoSeen';
import * as bearPath from './logic/bearPath';
import { BACK_MS, STEP_MS } from './logic/LogicPracticeView';
import * as patterns from './logic/patterns';
import type { PatternItem, PatternRow } from './logic/patterns';
import { tap } from './testing/ui';

// SCRUM-335 Wave 0 (review RF-02): when a lesson ends, the summary heading has the focus. Maths,
// Word search and Pexeso assert this already (foundation.spec, wordsearch.spec,
// PexesoLesson.test); this covers the four lessons that had no such check, so the seven
// "focus the summary" effects in App can later become one without losing a case.

const button = (name: string | RegExp) => screen.getByRole('button', { name });
let played: string[] = [];
const lastPlayed = () => played[played.length - 1];

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
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

/** Opens a course from the course choice and picks a level (by its radio name) and 5. */
function openCourse(course: string, level?: RegExp) {
  render(<App />);
  fireEvent.click(button(course));
  if (level) fireEvent.click(screen.getByRole('radio', { name: level }));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
}

/** English Level 1 (listen and choose): every word right first try. */
async function playListen() {
  openCourse('English');
  await act(async () => fireEvent.click(button(/Let’s listen/)));
  for (let i = 0; i < 5; i++) {
    const word = lastPlayed().toLowerCase();
    const option = screen
      .getAllByRole('button')
      .find((b) => b.classList.contains('word-option') && b.textContent!.toLowerCase() === word)!;
    await act(async () => fireEvent.click(option));
    await act(async () => fireEvent.click(button('Check answer')));
    await act(async () => fireEvent.click(button(i < 4 ? /Next word/ : /See how you did/)));
  }
}

/** English Level 3 (listen and write): every word right first try. */
async function playWrite() {
  openCourse('English', /^Level 3 /);
  await act(async () => fireEvent.click(button(/Let’s listen/)));
  for (let i = 0; i < 5; i++) {
    const input = screen.getByRole('textbox', { name: /Write the word you hear|Let’s write/ });
    fireEvent.change(input, { target: { value: lastPlayed() } });
    await act(async () => fireEvent.submit(input.closest('form')!));
    await act(async () => fireEvent.click(button(i < 4 ? /Next word/ : /See how you did/)));
  }
}

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** Logic Level 1 (bear path), demo already seen: right, right, down on every puzzle. */
async function playBearPath() {
  vi.useFakeTimers();
  localStorage.setItem(DEMO_KEYS['bear-path'], '1');
  vi.spyOn(bearPath, 'generateBearSession').mockImplementation((size) =>
    Array.from({ length: size }, () => ({ bear: { row: 1, col: 0 }, honey: { row: 2, col: 2 } })),
  );
  openCourse('Logic');
  tap('Let’s plan');
  for (let i = 0; i < 5; i++) {
    for (const arrow of ['Right', 'Right', 'Down']) tap(arrow);
    tap('Go');
    wait(STEP_MS * 7 + BACK_MS + 200);
    tap(i < 4 ? 'Next exercise' : 'See how you did');
  }
}

/** Logic Level 3 (patterns), demo already seen: the pirate on every row. */
async function playPatterns() {
  vi.useFakeTimers();
  localStorage.setItem(DEMO_KEYS.patterns, '1');
  const m = (motif: 'pirates' | 'bears'): PatternItem => ({ kind: 'motif', motif });
  const row: PatternRow = {
    level: 3,
    type: 'AB',
    places: [
      m('pirates'),
      m('bears'),
      m('pirates'),
      m('bears'),
      m('pirates'),
      m('bears'),
      m('pirates'),
    ],
    gap: 6,
    choices: [m('bears'), { kind: 'motif', motif: 'lollipops' }, m('pirates')],
  };
  vi.spyOn(patterns, 'generatePatternSession').mockImplementation((_level, size) =>
    Array.from({ length: size }, () => row),
  );
  render(<App />);
  fireEvent.click(button('Logic'));
  fireEvent.click(screen.getByRole('radio', { name: /^Level 3 ·/ }));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  tap('Let’s plan');
  for (let i = 0; i < 5; i++) {
    const pirate = screen
      .getAllByRole('button')
      .find(
        (b) => b.classList.contains('pattern-choice') && b.getAttribute('aria-label') === 'Pirate',
      )!;
    fireEvent.click(pirate, { detail: 1 });
    wait(1000);
    tap(i < 4 ? 'Next exercise' : 'See how you did');
  }
}

test.each([
  ['English listen (Level 1)', playListen],
  ['English write (Level 3)', playWrite],
  ['Logic bear path (Level 1)', playBearPath],
  ['Logic patterns (Level 3)', playPatterns],
])(
  '%s: the summary heading has focus when the lesson ends',
  async (_name, play) => {
    await play();
    expect(document.querySelector('.summary')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
  },
  20_000,
);
