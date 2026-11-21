import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App';
import { LESSON_START_KEY } from './lessonTime';
import * as math from './math/engine';
import { fakeServer, reply } from './testing/fakeServer';
import { openMathematics, openSmallMaths } from './testing/openMathematics';
import { tap } from './testing/ui';

// SCRUM-211: lesson time and average time per exercise on the summary. A fake clock (Date.now)
// moves only where the test says so.

const realGenerate = math.generateSession;
let now = 0;
let played: string[] = [];
beforeEach(() => {
  now = 1_700_000_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

/** The summary's own Choose level button (the bar has a Back with the same name). */
const summaryBack = () =>
  fireEvent.click(
    within(document.querySelector<HTMLElement>('.summary')!).getByRole('button', {
      name: 'Choose level',
    }),
    { detail: 1 },
  );
const timeLine = () => document.querySelector('.lesson-time');
const stored = () => JSON.parse(sessionStorage.getItem(LESSON_START_KEY) ?? 'null');
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const summaryHeading = () => screen.queryByRole('heading', { name: 'Look how far you’ve come!' });

/** Answers every maths exercise right (records the real generated lesson to know the answers). */
function playMaths(size: number, elapsedPerExample: number) {
  const generated: math.Exercise[][] = [];
  vi.spyOn(math, 'generateSession').mockImplementation((...args) => {
    const exercises = realGenerate(...args);
    generated.push([...exercises]);
    return exercises;
  });
  fireEvent.click(screen.getByRole('radio', { name: `${size} exercises` }));
  tap('Let’s count');
  const exercises = generated.at(-1)!;
  expect(exercises).toHaveLength(size);
  expect(stored()).toEqual({ startedAt: now, size });
  for (let i = 0; i < size; i++) {
    now += elapsedPerExample;
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: String(math.solveBlank(exercises[i])) },
    });
    tap('Check answer');
    tap(i < size - 1 ? 'Next exercise' : 'See how you did');
  }
  expect(summaryHeading()).toBeInTheDocument();
}

describe('maths: total and average for 5, 10 and 20', () => {
  for (const [size, perExample, shown, spoken] of [
    [
      5,
      41_000,
      'Time 3:25 · about 41 s per exercise',
      'Time 3 minutes 25 seconds, about 41 seconds per exercise',
    ],
    [
      10,
      20_500,
      'Time 3:25 · about 21 s per exercise',
      'Time 3 minutes 25 seconds, about 21 seconds per exercise',
    ],
    [
      20,
      10_250,
      'Time 3:25 · about 10 s per exercise',
      'Time 3 minutes 25 seconds, about 10 seconds per exercise',
    ],
  ] as const) {
    test(`${size} exercises`, () => {
      render(<App />);
      openMathematics();
      playMaths(size, perExample);
      expect(timeLine()).toHaveTextContent(shown);
      expect(timeLine()!.querySelector('[aria-hidden="true"]')).toHaveTextContent(shown);
      expect(timeLine()!.querySelector('.sr-only')).toHaveTextContent(spoken);
    });
  }
});

test('a review round does not change the divisor; the line sits under the first-try score', () => {
  vi.spyOn(math, 'generateSession').mockReturnValue(
    Array(5).fill({ level: 1, operation: '+', values: [1, 2, 3], blank: 2 }),
  );
  render(<App />);
  openMathematics();
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  tap('Let’s count');
  expect(stored()).toEqual({ startedAt: now, size: 5 });
  const solve = (value: string) => {
    fireEvent.change(screen.getByRole('textbox'), { target: { value } });
    tap('Check answer');
  };
  // 5 exercises, one wrong: 6 presentations, but the average divides by the chosen 5.
  for (let i = 0; i < 5; i++) {
    now += 10_000;
    if (i === 2) solve('9');
    solve('3');
    tap(i < 4 ? 'Next exercise' : 'Review tricky ones');
  }
  now += 50_000;
  solve('3');
  tap('See how you did');
  expect(screen.getByText('4 / 5')).toBeInTheDocument();
  expect(timeLine()).toHaveTextContent('Time 1:40 · about 20 s per exercise');
  expect(document.querySelector('.first-try')!.nextElementSibling).toBe(timeLine());
});

test('h:mm:ss from one hour; an average from one minute is m:ss', () => {
  render(<App />);
  openMathematics();
  playMaths(5, 745_000); // 62:05 in total
  expect(timeLine()).toHaveTextContent('Time 1:02:05 · about 12:25 per exercise');
  expect(timeLine()!.querySelector('.sr-only')).toHaveTextContent(
    'Time 1 hour 2 minutes 5 seconds, about 12 minutes 25 seconds per exercise',
  );
});

test('the time is taken when the summary appears; switching language later keeps it', () => {
  render(<App />);
  openMathematics();
  playMaths(5, 16_000); // 1:20
  now += 3_600_000; // the child looks at the summary for an hour
  fireEvent.click(button('Settings'));
  fireEvent.click(button('Slovenčina'));
  fireEvent.click(button('Zavrieť nastavenia'));
  expect(timeLine()).toHaveTextContent('Čas 1:20 · asi 16 s na príklad');
  expect(timeLine()!.querySelector('.sr-only')).toHaveTextContent(
    'Čas 1 minúta 20 sekúnd, asi 16 sekúnd na príklad',
  );
});

test('missing start: no time line, summary otherwise unchanged, no error', () => {
  const errors = vi.spyOn(console, 'error');
  render(<App />);
  openMathematics();
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  const generate = vi.spyOn(math, 'generateSession');
  generate.mockReturnValue(
    Array(5).fill({ level: 1, operation: '+', values: [1, 2, 3], blank: 2 }),
  );
  tap('Let’s count');
  sessionStorage.removeItem(LESSON_START_KEY);
  for (let i = 0; i < 5; i++) {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
    tap('Check answer');
    tap(i < 4 ? 'Next exercise' : 'See how you did');
  }
  expect(summaryHeading()).toBeInTheDocument();
  expect(screen.getByText('5 / 5')).toBeInTheDocument();
  expect(timeLine()).toBeNull();
  expect(button('Play again')).toBeInTheDocument();
  expect(errors).not.toHaveBeenCalled();
});

test('negative difference (clock moved back): no time line, no error', () => {
  render(<App />);
  openMathematics();
  playMaths(5, -10_000);
  expect(screen.getByText('5 / 5')).toBeInTheDocument();
  expect(timeLine()).toBeNull();
});

test('Play again overwrites the start; Choose level and the leave dialog remove it', () => {
  render(<App />);
  openMathematics();
  playMaths(5, 1_000);
  now += 60_000;
  tap('Play again');
  expect(stored()).toEqual({ startedAt: now, size: 5 });
  // Leaving through the leave dialog (progress exists).
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });
  fireEvent.click(button('Choose level'));
  fireEvent.click(button('Keep practising'));
  expect(stored()).not.toBeNull();
  fireEvent.click(button('Choose level'));
  fireEvent.click(button('Choose a new trail'));
  expect(stored()).toBeNull();
  // A new level overwrites; leaving from the summary removes it.
  fireEvent.click(screen.getByRole('radio', { name: /^Level 4 / }));
  playMaths(10, 1_000);
  expect(stored()).toEqual({ startedAt: now - 10_000, size: 10 });
  summaryBack();
  expect(stored()).toBeNull();
  // Back without progress leaves at once and removes it too.
  tap('Let’s count');
  expect(stored()).not.toBeNull();
  fireEvent.click(button('Choose level'));
  expect(stored()).toBeNull();
});

test('every Maths and Small maths level stores the start with the chosen size', () => {
  render(<App />);
  openMathematics();
  for (const level of [1, 2, 3, 4, 5, 6, 7]) {
    for (const size of [5, 10, 20]) {
      now += 1_000;
      fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^Level ${level} `) }));
      fireEvent.click(screen.getByRole('radio', { name: `${size} exercises` }));
      tap('Let’s count');
      expect(document.querySelector('.level-pill')).toHaveTextContent(`Level ${level}`);
      expect(stored()).toEqual({ startedAt: now, size });
      fireEvent.click(button('Choose level'));
      expect(stored()).toBeNull();
    }
  }
  fireEvent.click(button('Back to courses'));
  openSmallMaths();
  for (const level of [1, 2, 3]) {
    now += 1_000;
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^Level ${level} `) }));
    fireEvent.click(screen.getByRole('radio', { name: '20 exercises' }));
    tap('Let’s count');
    expect(stored()).toEqual({ startedAt: now, size: 20 });
    fireEvent.click(button('Choose level'));
  }
});

test.each([1, 2, 3])('Small maths level %i: time on the summary', (level) => {
  render(<App />);
  openSmallMaths();
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^Level ${level} `) }));
  playMaths(5, 7_000);
  expect(timeLine()).toHaveTextContent('Time 0:35 · about 7 s per exercise');
});

test.each([1, 2, 3, 4, 5, 6, 7])('Maths level %i: time on the summary', (level) => {
  render(<App />);
  openMathematics();
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^Level ${level} `) }));
  playMaths(5, 12_000);
  expect(timeLine()).toHaveTextContent('Time 1:00 · about 12 s per exercise');
});

async function playEnglish(level: 1 | 2 | 3, size: number, perExample: number) {
  fireEvent.click(button('English'));
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^Level ${level} `) }));
  fireEvent.click(screen.getByRole('radio', { name: `${size} exercises` }));
  await act(async () => fireEvent.click(button(/Let’s listen/)));
  expect(stored()).toEqual({ startedAt: now, size });
  for (let i = 0; i < size; i++) {
    now += perExample;
    const target = played.at(-1)!;
    if (level === 3) {
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: target } });
      await act(async () => fireEvent.submit(input.closest('form')!));
    } else {
      const word = [...document.querySelectorAll<HTMLButtonElement>('.word-option')].find(
        (b) => b.textContent!.toLowerCase() === target.toLowerCase(),
      )!;
      await act(async () => fireEvent.click(word));
      await act(async () => fireEvent.click(button('Check answer')));
    }
    await act(async () =>
      fireEvent.click(button(i < size - 1 ? /Next word/ : /See how you did/), { detail: 1 }),
    );
  }
  expect(summaryHeading()).toBeInTheDocument();
}

test.each([1, 2, 3] as const)('English level %i: time on the summary', async (level) => {
  render(<App />);
  await playEnglish(level, 5, 9_000);
  expect(timeLine()).toHaveTextContent('Time 0:45 · about 9 s per exercise');
  summaryBack();
  expect(stored()).toBeNull();
});

test('signed in: the time line sits between the first-try score and the points', async () => {
  const ACCOUNT = { kind: 'password', username: 'kid', nickname: 'Kid', bear: 1, email: null };
  const calls = fakeServer(({ path }) => {
    if (path === '/api/me') return reply({ account: ACCOUNT });
    if (path === '/api/auth/google') return reply({ available: false });
    if (path === '/api/progress') return reply({ points: 0 });
    if (path === '/api/progress/lessons') return reply({ lessonId: 'a'.repeat(32) }, 201);
    if (path === '/api/progress/lessons/finish') return reply({ points: 5, added: 5 });
    return reply({ error: 'not_found' }, 404);
  });
  render(<App />);
  await act(async () => {});
  openMathematics();
  playMaths(5, 20_000);
  await act(async () => {});
  expect(timeLine()).toHaveTextContent('Time 1:40 · about 20 s per exercise');
  expect(document.querySelector('.first-try')!.nextElementSibling).toBe(timeLine());
  expect(document.querySelector('.summary-points')).not.toBeNull();
  // Not saved anywhere else: nothing about time goes to the server.
  for (const call of calls)
    for (const key of Object.keys(call.body ?? {}))
      expect(['lessonId', 'size', 'points']).toContain(key);
  expect(calls.map((call) => call.path)).not.toContain('/api/progress/time');
});
