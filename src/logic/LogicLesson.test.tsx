import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from '../App';
import { fakeServer, reply } from '../testing/fakeServer';
import { tap } from '../testing/ui';
import * as bearPath from './bearPath';
import type { BearPuzzle } from './bearPath';
import { DEMO_MS } from './LogicDemo';
import { BACK_MS, STEP_MS } from './LogicPracticeView';
import { multiplierFor } from '../progress/multipliers';
import { FeedbackAudio } from '../audio';

// SCRUM-262: Logic course, level 1 "Bear goes to the honey".

const at = (row: number, col: number) => ({ row, col });
/** Bear at row 2, column 1; honey at row 3, column 3 (1-based): right, right, down. */
const PUZZLE: BearPuzzle = { bear: at(1, 0), honey: at(2, 2) };
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const exact = (name: string) => screen.getByRole('button', { name });
const heading = () => screen.getByRole('heading', { level: 2 });
const board = () => document.querySelector<HTMLElement>('.logic-board')!;
const bear = () => document.querySelector<HTMLElement>('.logic-bear')!;
const bearCell = () => [
  bear().style.getPropertyValue('--row'),
  bear().style.getPropertyValue('--col'),
];
const slots = () => screen.getByRole('list', { name: /^Arrows:/ });
const feedback = () => document.getElementById('answer-feedback')!;
const paws = () => document.querySelectorAll('.logic-cell[data-paw]').length;
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const key = (k: string, target: Element = document.body) => fireEvent.keyDown(target, { key: k });

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(bearPath, 'generateBearSession').mockImplementation((size) =>
    Array.from({ length: size }, () => PUZZLE),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openLogic() {
  render(<App />);
  fireEvent.click(exact('Logic'));
}
/** Starts a lesson and lets the demo finish. */
function startLesson(size = '5 exercises') {
  openLogic();
  fireEvent.click(screen.getByRole('radio', { name: size }));
  tap('Let’s plan');
  wait(DEMO_MS + 10);
}
function plan(...arrows: string[]) {
  for (const arrow of arrows) tap(arrow);
}
/** Go, then the whole walk (and the walk back after a wrong try). */
function go() {
  tap('Go');
  wait(STEP_MS * 7 + BACK_MS + 200);
}

test('course choice: Small maths, Logic, Maths, English, Word search with the Logic card text (EN and SK)', () => {
  render(<App />);
  const titles = [...document.querySelectorAll('.course-title')].map((e) => e.textContent);
  expect(titles).toEqual(['Small maths', 'Logic', 'Maths', 'English', 'Word search']);
  // SCRUM-324: the card text also mentions the pairs (Pexeso, Levels 6-8).
  expect(exact('Logic')).toHaveAccessibleDescription(
    'Think ahead: guide the bear to the honey, find the pairs',
  );
  expect(document.querySelector('.course-logic .course-icon svg')).not.toBeNull();
  fireEvent.click(button('Settings'));
  fireEvent.click(button('Slovenčina'));
  fireEvent.click(button('Zavrieť nastavenia'));
  expect(exact('Logika')).toHaveAccessibleDescription(
    'Mysli dopredu: priveď medveďa k medu, nájdi dvojice',
  );
});

test('Logic menu: Level 1, sizes 5/10/20 (10 first), Levels 6-8 Pexeso, heading focused; Back returns to courses', () => {
  openLogic();
  expect(heading()).toHaveTextContent('Which puzzle shall we try?');
  expect(document.activeElement).toBe(heading());
  const level = screen.getByRole('radio', { name: /^Level 1 · Bear goes to the honey/ });
  expect(level).toBeChecked();
  // SCRUM-289: Level 2 "Around the stones" follows Level 1; SCRUM-299: the picture patterns
  // are Levels 3-5 after the bear levels.
  expect(
    screen.getAllByRole('radio', { name: /^Level / }).map((r) => r.closest('label')!.textContent),
  ).toEqual([
    expect.stringMatching(/^1.*Bear goes to the honey.*Plan the way with arrows, up to 4 steps/),
    expect.stringMatching(/^2.*Around the stones.*Find the free way, up to 6 steps/),
    expect.stringMatching(/^3.*What comes next\?.*Two pictures take turns: pick the next one/),
    expect.stringMatching(/^4.*What is missing\?.*Find the picture that belongs in the gap/),
    expect.stringMatching(
      /^5.*Growing and turning.*More, fewer or a turning arrow: pick the next one/,
    ),
    // SCRUM-324: Pexeso / Matching pairs as Levels 6-8 (6 / 10 / 15 pictures).
    expect.stringMatching(/^6.*Matching pairs.*6 pictures: turn two cards and find the pairs/),
    expect.stringMatching(/^7.*Matching pairs.*10 pictures: turn two cards and find the pairs/),
    expect.stringMatching(/^8.*Matching pairs.*15 pictures: turn two cards and find the pairs/),
  ]);
  expect(screen.getByText('Plan the way with arrows, up to 4 steps')).toBeInTheDocument();
  expect(
    screen
      .getAllByRole('radio', { name: /exercises$/ })
      .map((r) => r.closest('label')!.textContent),
  ).toEqual(['5 exercises', '10 exercises', '20 exercises']);
  expect(screen.getByRole('radio', { name: '10 exercises' })).toBeChecked();
  fireEvent.click(button('Back to courses'));
  expect(heading()).toHaveTextContent('What shall we learn today?');
});

test('Slovak level menu and lesson texts', () => {
  render(<App />);
  fireEvent.click(button('Settings'));
  fireEvent.click(button('Slovenčina'));
  fireEvent.click(button('Zavrieť nastavenia'));
  fireEvent.click(exact('Logika'));
  expect(screen.getByRole('radio', { name: /^Úroveň 1 · Medveď ide po med/ })).toBeChecked();
  expect(screen.getByText('Naplánuj cestu šípkami, najviac 4 kroky')).toBeInTheDocument();
  tap('Poďme plánovať');
  wait(DEMO_MS + 10);
  expect(board()).toHaveAccessibleName('Medveď: riadok 2, stĺpec 1. Med: riadok 3, stĺpec 3.');
  for (const name of [
    'Hore',
    'Dole',
    'Vľavo',
    'Vpravo',
    'Zmazať poslednú šípku',
    'Choď',
    'Ukáž mi',
  ])
    expect(exact(name)).toBeInTheDocument();
  plan('Vpravo', 'Vpravo', 'Dole');
  expect(screen.getByRole('list', { name: 'Šípky: vpravo, vpravo, dole' })).toBeInTheDocument();
});

test('the demo plays first and locks the lesson; then the board is focused and read out', () => {
  openLogic();
  tap('Let’s plan');
  expect(
    screen.getByRole('img', {
      name: 'Demo: tap an arrow, then Go, and the bear walks to the honey',
    }),
  ).toBeInTheDocument();
  expect(document.querySelector('.logic-board')).toBeNull();
  plan('Right');
  key('ArrowRight');
  expect(slots()).toHaveAccessibleName('Arrows: none yet');
  wait(DEMO_MS + 10);
  expect(screen.queryByRole('img', { name: /^Demo/ })).toBeNull();
  expect(board()).toHaveAccessibleName('Bear: row 2, column 1. Honey: row 3, column 3.');
  expect(board()).toHaveFocus();
  expect(screen.getByText('Exercise 1 of 10')).toBeInTheDocument();
  expect(heading()).toHaveTextContent('Guide the bear to the honey');
});

test('arrow slots: up to 4, the bear does not move before Go, Remove last; Go needs an arrow', () => {
  startLesson();
  expect(exact('Go')).toHaveAttribute('aria-disabled', 'true');
  tap('Go'); // not an attempt: nothing happens
  wait(3000);
  expect(feedback()).toHaveTextContent('');
  expect(bear().querySelector('svg')).toHaveAttribute('data-mood', 'neutral');
  plan('Right', 'Right', 'Down');
  expect(slots()).toHaveAccessibleName('Arrows: right, right, down');
  expect(bearCell()).toEqual(['1', '0']);
  plan('Up', 'Left');
  expect(slots()).toHaveAccessibleName('Arrows: right, right, down, up');
  expect(exact('Up')).toHaveAttribute('aria-disabled', 'true');
  tap('Remove last arrow');
  expect(slots()).toHaveAccessibleName('Arrows: right, right, down');
  expect(exact('Go')).toHaveAttribute('aria-disabled', 'false');
  expect(bearCell()).toEqual(['1', '0']);
});

test('right: the bear walks cell by cell (current slot marked) and ends on the honey', () => {
  startLesson();
  plan('Right', 'Down', 'Right');
  tap('Go');
  wait(160);
  expect(bearCell()).toEqual(['1', '1']);
  expect(document.querySelector('.arrow-slot[data-current]')).toBe(
    document.querySelectorAll('.arrow-slot')[0],
  );
  // Locked during the walk: arrows, Remove last and a second Go do nothing.
  plan('Up');
  tap('Remove last arrow');
  expect(slots()).toHaveAccessibleName('Arrows: right, down, right');
  wait(STEP_MS);
  expect(bearCell()).toEqual(['2', '1']);
  wait(STEP_MS);
  expect(bearCell()).toEqual(['2', '2']);
  expect(feedback()).toHaveTextContent('');
  wait(STEP_MS);
  expect(feedback()).toHaveTextContent('The bear found the honey! Well done.');
  expect(exact('Next exercise')).toHaveFocus();
  expect(paws()).toBe(0);
});

test('wrong (ends elsewhere): paw dots, the bear goes back, arrows stay; a change clears dots', () => {
  startLesson();
  plan('Right', 'Down');
  tap('Go');
  wait(STEP_MS * 2 + 200);
  expect(feedback()).toHaveTextContent(
    'The bear is not at the honey. Fix the arrows and try again.',
  );
  expect(paws()).toBe(2);
  expect(bearCell()).toEqual(['2', '1']);
  wait(BACK_MS);
  expect(bearCell()).toEqual(['1', '0']);
  expect(slots()).toHaveAccessibleName('Arrows: right, down');
  plan('Right');
  expect(paws()).toBe(0);
  expect(feedback()).toHaveTextContent('');
  go();
  expect(feedback()).toHaveTextContent('The bear found the honey!');
});

test('QA271-01: input works as soon as the retry text shows; the bear is on the start, no stale walk back', () => {
  startLesson();
  plan('Right', 'Down');
  tap('Go');
  wait(STEP_MS * 2 + 200);
  expect(feedback()).toHaveTextContent('The bear is not at the honey.');
  expect(bearCell()).toEqual(['2', '1']);
  // At once (no wait for the walk back): the tap adds an arrow and the bear is on the start.
  tap('Right');
  expect(slots()).toHaveAccessibleName('Arrows: right, down, right');
  expect(bearCell()).toEqual(['1', '0']);
  expect(paws()).toBe(0);
  // Go right away: one walk, and the old walk back never pulls the bear to the start mid-walk.
  tap('Go');
  wait(160);
  expect(bearCell()).toEqual(['1', '1']);
  wait(STEP_MS);
  expect(bearCell()).toEqual(['2', '1']);
  wait(200); // past the old walk back (BACK_MS after the retry text): it must not fire
  expect(bearCell()).toEqual(['2', '1']);
  wait(STEP_MS);
  expect(bearCell()).toEqual(['2', '2']);
  wait(STEP_MS);
  expect(feedback()).toHaveTextContent('The bear found the honey!');
});

test('QA271-01: keys, Remove, Go and Show me work right after a wrong walk', () => {
  startLesson();
  plan('Down');
  go();
  key('ArrowRight'); // nothing waits: the walk back was already over
  expect(slots()).toHaveAccessibleName('Arrows: down, right');
  tap('Go');
  wait(STEP_MS * 2 + 200);
  expect(feedback()).toHaveTextContent('The bear is not at the honey.');
  key('ArrowRight');
  expect(slots()).toHaveAccessibleName('Arrows: down, right, right');
  tap('Remove last arrow');
  expect(slots()).toHaveAccessibleName('Arrows: down, right');
  expect(bearCell()).toEqual(['1', '0']);
  tap('Go');
  wait(STEP_MS * 2 + 200);
  expect(feedback()).toHaveTextContent('The bear is not at the honey.');
  expect(bearCell()).toEqual(['2', '1']);
  // Go again with the same plan straight after the result: the bear starts from the start.
  tap('Go');
  expect(bearCell()).toEqual(['1', '0']);
  expect(bear()).toHaveAttribute('data-snap', 'true');
  wait(160);
  expect(bearCell()).toEqual(['2', '0']);
  wait(STEP_MS * 2);
  expect(feedback()).toHaveTextContent('The bear is not at the honey.');
  expect(bearCell()).toEqual(['2', '1']);
  tap('Show me');
  expect(screen.getByRole('img', { name: /^Demo/ })).toBeInTheDocument();
  wait(DEMO_MS + 10);
  expect(bearCell()).toEqual(['1', '0']);
  expect(slots()).toHaveAccessibleName('Arrows: down, right');
  wait(BACK_MS * 2);
  expect(bearCell()).toEqual(['1', '0']);
});

test('wrong: passing over the honey but ending elsewhere is not right', () => {
  startLesson();
  plan('Right', 'Right', 'Down', 'Right');
  go();
  expect(feedback()).toHaveTextContent('The bear is not at the honey.');
  expect(paws()).toBe(4);
});

test('wrong: an arrow off the grid stops the bear at the edge', () => {
  startLesson();
  plan('Left', 'Right', 'Right', 'Down');
  tap('Go');
  wait(200);
  expect(bearCell()).toEqual(['1', '0']);
  expect(bear()).toHaveAttribute('data-bump', 'left');
  wait(STEP_MS + 50);
  expect(feedback()).toHaveTextContent(
    'The bear bumped into the edge. Fix the arrows and try again.',
  );
  expect(paws()).toBe(0);
});

test('keyboard: arrows add, Backspace removes, Enter goes; Enter on a button keeps its meaning', () => {
  startLesson();
  key('ArrowRight');
  key('ArrowRight');
  key('ArrowUp');
  expect(slots()).toHaveAccessibleName('Arrows: right, right, up');
  key('Backspace');
  key('ArrowDown');
  // Enter on a focused button (Show me) is that button's, not Go.
  key('Enter', exact('Show me'));
  wait(STEP_MS * 4 + BACK_MS);
  expect(bearCell()).toEqual(['1', '0']);
  expect(feedback()).toHaveTextContent('');
  // Keys are off while a dialog is open.
  fireEvent.click(button('Settings'));
  key('ArrowLeft');
  fireEvent.click(button('Close settings'));
  expect(slots()).toHaveAccessibleName('Arrows: right, right, down');
  key('Enter');
  wait(160);
  expect(bearCell()).toEqual(['1', '1']);
  key('ArrowLeft'); // ignored during the walk
  wait(STEP_MS * 3);
  expect(feedback()).toHaveTextContent('The bear found the honey!');
  expect(slots()).toHaveAccessibleName('Arrows: right, right, down');
});

test('a double tap on Go walks once; Show me replays the demo without touching the plan', () => {
  startLesson();
  plan('Right', 'Down');
  const goButton = exact('Go');
  fireEvent.click(goButton, { detail: 1 });
  fireEvent.click(goButton, { detail: 2 });
  wait(STEP_MS * 2 + BACK_MS + 300);
  expect(feedback()).toHaveTextContent('The bear is not at the honey.');
  tap('Show me');
  expect(screen.getByRole('img', { name: /^Demo/ })).toBeInTheDocument();
  wait(DEMO_MS + 10);
  expect(slots()).toHaveAccessibleName('Arrows: right, down');
  expect(board()).toHaveAccessibleName('Bear: row 2, column 1. Honey: row 3, column 3.');
});

test('first try counts only a right first Go; missed puzzles come back in review (same cells)', () => {
  startLesson();
  for (let i = 0; i < 5; i++) {
    if (i === 1) {
      plan('Down');
      go();
      tap('Remove last arrow');
    }
    plan('Right', 'Right', 'Down');
    go();
    tap(i < 4 ? 'Next exercise' : 'Review tricky ones');
  }
  expect(screen.getByText('Review · 1 to practise')).toBeInTheDocument();
  expect(heading()).toHaveTextContent('Let’s try these paths again');
  expect(board()).toHaveAccessibleName('Bear: row 2, column 1. Honey: row 3, column 3.');
  expect(slots()).toHaveAccessibleName('Arrows: none yet');
  plan('Down', 'Right', 'Right');
  go();
  tap('See how you did');
  expect(screen.getByText('4 / 5')).toBeInTheDocument();
  expect(screen.getByText('5 exercises completed')).toBeInTheDocument();
});

test('leaving with planned arrows asks first; Back with nothing planned leaves at once', () => {
  startLesson();
  plan('Right');
  fireEvent.click(button('Choose level'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(button('Keep practising'));
  tap('Remove last arrow');
  fireEvent.click(button('Choose level'));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(heading()).toHaveTextContent('Which puzzle shall we try?');
});

test('points: Logic has no multiplier row (always x1)', () => {
  for (let play = 1; play <= 8; play++) expect(multiplierFor('logic', 1, play)).toBe(1);
});

test('signed in: the finished lesson saves its first-try points and shows them without a multiplier', async () => {
  vi.useRealTimers();
  let total = 7;
  const calls = fakeServer(({ path, body }) => {
    if (path === '/api/me')
      return reply({
        account: {
          kind: 'password',
          username: 'kid',
          nickname: 'Kid',
          look: { fur: 0, background: 0, head: 0, neck: 0, eyes: 0 },
          email: null,
          leaderboard: true,
        },
      });
    if (path === '/api/progress') return reply({ points: total });
    if (path === '/api/progress/lessons') return reply({ lessonId: 'b'.repeat(32) }, 201);
    if (path === '/api/progress/lessons/finish') {
      total += (body as { points: number }).points;
      return reply({ points: total, added: (body as { points: number }).points });
    }
    return reply({ error: 'not_found' }, 404);
  });
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Leaderboard/ })).toBeInTheDocument(),
  );
  fireEvent.click(exact('Logic'));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  tap('Let’s plan');
  wait(DEMO_MS + 10);
  for (let i = 0; i < 5; i++) {
    plan('Right', 'Right', 'Down');
    go();
    tap(i < 4 ? 'Next exercise' : 'See how you did');
  }
  await waitFor(() =>
    expect(calls.find((c) => c.path === '/api/progress/lessons/finish')?.body).toMatchObject({
      points: 5,
    }),
  );
  const summary = document.querySelector<HTMLElement>('.summary')!;
  await waitFor(() => expect(within(summary).getByText('+5 points')).toBeInTheDocument());
  expect(summary.querySelector('.points-multiplied')).toBeNull();
});

test('one soft step sound per arrow; Go or Enter again during the walk starts no second walk', async () => {
  vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockResolvedValue(true);
  const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
  openLogic();
  await act(async () => tap('Let’s plan'));
  wait(DEMO_MS + 10);
  plan('Right', 'Down');
  tap('Go');
  wait(200);
  tap('Go'); // a deliberate second tap (detail 1) while the bear walks
  key('Enter');
  wait(STEP_MS * 6 + BACK_MS * 2);
  expect(play.mock.calls.filter(([sound]) => sound === 'step')).toHaveLength(2);
  expect(play.mock.calls.filter(([sound]) => sound === 'incorrect')).toHaveLength(1);
});

// ---------------------------------------------------------------------------------------------
// SCRUM-289 / SCRUM-293: Level 2 "Around the stones".

/** One stone between bear (row 2, column 1) and honey (row 2, column 3). */
const ONE_STONE: BearPuzzle = { bear: at(1, 0), honey: at(1, 2), stones: [at(1, 1)] };
/** Two stones beside the honey's corner: the only ways round take 6 arrows (URRDDL). */
const TWO_STONES: BearPuzzle = { bear: at(1, 1), honey: at(2, 2), stones: [at(1, 2), at(2, 1)] };

function startLevel2(puzzles: readonly BearPuzzle[], size = '5 exercises') {
  vi.spyOn(bearPath, 'generateStoneSession').mockImplementation((n) =>
    Array.from({ length: n }, (_, i) => puzzles[i % puzzles.length]),
  );
  openLogic();
  fireEvent.click(screen.getByRole('radio', { name: /^Level 2 · Around the stones/ }));
  fireEvent.click(screen.getByRole('radio', { name: size }));
  tap('Let’s plan');
  wait(DEMO_MS + 10);
}

test('Level 2: stones on the board and in its text (one / two), 6 arrow slots, no 7th arrow', () => {
  startLevel2([TWO_STONES, ONE_STONE]);
  expect(screen.getByText('Level 2')).toBeInTheDocument();
  expect(board()).toHaveAccessibleName(
    'Bear: row 2, column 2. Honey: row 3, column 3. Stones: row 2, column 3 and row 3, column 2.',
  );
  expect(document.querySelectorAll('.logic-cell .logic-stone')).toHaveLength(2);
  const cells = [...document.querySelectorAll('.logic-cell')];
  expect(cells.flatMap((c, i) => (c.querySelector('.logic-stone') ? [i] : []))).toEqual([6, 9]);
  expect(document.querySelectorAll('.arrow-slot')).toHaveLength(6);
  plan('Up', 'Right', 'Right', 'Down', 'Down', 'Left');
  expect(slots()).toHaveAccessibleName('Arrows: up, right, right, down, down, left');
  for (const name of ['Up', 'Down', 'Left', 'Right'])
    expect(exact(name)).toHaveAttribute('aria-disabled', 'true');
  plan('Up');
  key('ArrowUp');
  expect(slots()).toHaveAccessibleName('Arrows: up, right, right, down, down, left');
  go();
  expect(feedback()).toHaveTextContent('The bear found the honey! Well done.');
  tap('Next exercise');
  expect(board()).toHaveAccessibleName(
    'Bear: row 2, column 1. Honey: row 2, column 3. Stone: row 2, column 2.',
  );
  expect(document.querySelectorAll('.logic-cell .logic-stone')).toHaveLength(1);
});

test('Level 2: an arrow into a stone bumps and stops the bear = wrong, announced; arrows kept', () => {
  startLevel2([ONE_STONE]);
  plan('Right', 'Right');
  tap('Go');
  wait(200);
  expect(bearCell()).toEqual(['1', '0']);
  expect(bear()).toHaveAttribute('data-bump', 'right');
  wait(STEP_MS + 50);
  // The feedback line is the polite status that screen readers announce.
  expect(feedback()).toHaveTextContent(
    'The bear bumped into a stone. Fix the arrows and try again.',
  );
  expect(feedback().closest('[role="status"], [aria-live]')).not.toBeNull();
  expect(paws()).toBe(0);
  wait(BACK_MS);
  expect(bearCell()).toEqual(['1', '0']);
  expect(slots()).toHaveAccessibleName('Arrows: right, right');
  // A bump after some steps leaves paw dots on the walked cells, like the edge.
  tap('Remove last arrow');
  tap('Remove last arrow');
  plan('Up', 'Right', 'Down', 'Down');
  go();
  expect(feedback()).toHaveTextContent('The bear bumped into a stone.');
  expect(paws()).toBe(2);
  // The edge keeps its own text on Level 2.
  tap('Remove last arrow');
  tap('Remove last arrow');
  tap('Remove last arrow');
  tap('Remove last arrow');
  plan('Left');
  go();
  expect(feedback()).toHaveTextContent('The bear bumped into the edge.');
});

test('Level 2 in Slovak: stone texts (kameň / kamene) and the bump into a stone', () => {
  vi.spyOn(bearPath, 'generateStoneSession').mockImplementation((n) =>
    Array.from({ length: n }, (_, i) => [TWO_STONES, ONE_STONE][i % 2]),
  );
  render(<App />);
  fireEvent.click(button('Settings'));
  fireEvent.click(button('Slovenčina'));
  fireEvent.click(button('Zavrieť nastavenia'));
  fireEvent.click(exact('Logika'));
  fireEvent.click(screen.getByRole('radio', { name: /^Úroveň 2 · Okolo kameňov/ }));
  expect(screen.getByText('Nájdi voľnú cestu, najviac 6 krokov')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: '5 príkladov' }));
  tap('Poďme plánovať');
  wait(DEMO_MS + 10);
  expect(board()).toHaveAccessibleName(
    'Medveď: riadok 2, stĺpec 2. Med: riadok 3, stĺpec 3. Kamene: riadok 2, stĺpec 3 a riadok 3, stĺpec 2.',
  );
  const choď = () => {
    tap('Choď');
    wait(STEP_MS * 7 + BACK_MS + 200);
  };
  plan('Vpravo');
  choď();
  expect(feedback()).toHaveTextContent('Medveď narazil na kameň. Oprav šípky a skús znova.');
  tap('Zmazať poslednú šípku');
  plan('Hore', 'Vpravo', 'Vpravo', 'Dole', 'Dole', 'Vľavo');
  choď();
  tap('Ďalší príklad');
  expect(board()).toHaveAccessibleName(
    'Medveď: riadok 2, stĺpec 1. Med: riadok 2, stĺpec 3. Kameň: riadok 2, stĺpec 2.',
  );
});

test('Level 2: first try, review round and summary like Level 1', () => {
  startLevel2([ONE_STONE]);
  for (let i = 0; i < 5; i++) {
    if (i === 2) {
      plan('Right');
      go();
      tap('Remove last arrow');
    }
    plan('Up', 'Right', 'Right', 'Down');
    go();
    expect(feedback()).toHaveTextContent('The bear found the honey!');
    tap(i < 4 ? 'Next exercise' : 'Review tricky ones');
  }
  expect(screen.getByText('Review · 1 to practise')).toBeInTheDocument();
  expect(board()).toHaveAccessibleName(
    'Bear: row 2, column 1. Honey: row 2, column 3. Stone: row 2, column 2.',
  );
  plan('Down', 'Right', 'Right', 'Up');
  go();
  tap('See how you did');
  expect(screen.getByText('4 / 5')).toBeInTheDocument();
});

test('Level 2 points: x1 (no multiplier row) and the play is counted as logic level 2', async () => {
  for (let play = 1; play <= 8; play++) expect(multiplierFor('logic', 2, play)).toBe(1);
  vi.useRealTimers();
  localStorage.clear();
  let total = 7;
  const calls = fakeServer(({ path, body }) => {
    if (path === '/api/me')
      return reply({
        account: {
          kind: 'password',
          username: 'kid',
          nickname: 'Kid',
          look: { fur: 0, background: 0, head: 0, neck: 0, eyes: 0 },
          email: null,
          leaderboard: true,
        },
      });
    if (path === '/api/progress') return reply({ points: total });
    if (path === '/api/progress/lessons') return reply({ lessonId: 'c'.repeat(32) }, 201);
    if (path === '/api/progress/lessons/finish') {
      total += (body as { points: number }).points;
      return reply({ points: total, added: (body as { points: number }).points });
    }
    return reply({ error: 'not_found' }, 404);
  });
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(bearPath, 'generateStoneSession').mockImplementation((n) =>
    Array.from({ length: n }, () => ONE_STONE),
  );
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Leaderboard/ })).toBeInTheDocument(),
  );
  fireEvent.click(exact('Logic'));
  fireEvent.click(screen.getByRole('radio', { name: /^Level 2 · Around the stones/ }));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  tap('Let’s plan');
  wait(DEMO_MS + 10);
  for (let i = 0; i < 5; i++) {
    plan('Up', 'Right', 'Right', 'Down');
    go();
    tap(i < 4 ? 'Next exercise' : 'See how you did');
  }
  await waitFor(() =>
    expect(calls.find((c) => c.path === '/api/progress/lessons/finish')?.body).toMatchObject({
      points: 5,
    }),
  );
  const summary = document.querySelector<HTMLElement>('.summary')!;
  await waitFor(() => expect(within(summary).getByText('+5 points')).toBeInTheDocument());
  expect(summary.querySelector('.points-multiplied')).toBeNull();
  expect(localStorage.getItem('bearmatics-plays')).toMatch(/"logic:2":1/);
});
