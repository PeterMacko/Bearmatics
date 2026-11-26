import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from '../App';
import { FeedbackAudio } from '../audio';
import { fakeServer, reply } from '../testing/fakeServer';
import { seeded } from '../testing/seeded';
import * as grid from './grid';
import type { Puzzle } from './grid';

// SCRUM-241/245: the Word search course in the app (menu, lesson, scoring, sounds, SR mode).

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const exact = (name: string) => screen.getByRole('button', { name, exact: true } as never);
const heading = () => screen.getByRole('heading', { level: 2 });
let played: string[] = [];
let feedback: ReturnType<typeof vi.fn>;
let lesson: readonly Puzzle[] = [];

beforeEach(() => {
  played = [];
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    played.push(decodeURIComponent(this.src.split('/').pop()!.replace('.mp3', '')));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockResolvedValue(true);
  feedback = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true) as never;
  const original = grid.generateSearchLesson;
  vi.spyOn(grid, 'generateSearchLesson').mockImplementation((level, size) => {
    lesson = original(level, size, seeded(size * 10 + level));
    return lesson;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });
const pops = () => feedback.mock.calls.filter(([sound]) => sound === 'pop').length;
const melodies = () =>
  feedback.mock.calls.filter(([sound]) => sound === 'correct' || sound === 'incorrect').length;

/** The cell button at (row, col), 0-based. */
const cellButton = (row: number, col: number) =>
  document.querySelectorAll<HTMLButtonElement>('.ws-cell')[row * 6 + col];
const tapCell = (cell: grid.Cell, detail = 1) =>
  fireEvent.click(cellButton(cell.row, cell.col), { detail });
/** Taps the first and the last letter of word `i` of grid `p` (default: the one on screen). */
function find(i: number, p = 0) {
  const { cells } = lesson[p].words[i];
  tapCell(cells[0]);
  tapCell(cells[cells.length - 1]);
}
function wrongPair(p = 0): [grid.Cell, grid.Cell] {
  for (let a = 0; a < 36; a++)
    for (let b = a + 1; b < 36; b++) {
      const first = { row: Math.floor(a / 6), col: a % 6 };
      const last = { row: Math.floor(b / 6), col: b % 6 };
      if (grid.checkSelection(lesson[p], first, last) === null) return [first, last];
    }
  throw new Error('none');
}

async function start({
  level = 1,
  size = 5,
  sk = false,
}: { level?: 1 | 2 | 3; size?: 5 | 10 | 20; sk?: boolean } = {}) {
  render(<App />);
  if (sk) {
    fireEvent.click(button('Settings'));
    fireEvent.click(button('Slovenčina'));
    fireEvent.click(button('Zavrieť nastavenia'));
  }
  fireEvent.click(exact(sk ? 'Osemsmerovka' : 'Word search'));
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^(Level|Úroveň) ${level} `) }));
  fireEvent.click(screen.getByRole('radio', { name: `${size} ${sk ? 'príkladov' : 'exercises'}` }));
  await act(async () => fireEvent.click(button(sk ? /Poďme hľadať/ : /Let’s search/)));
}

test('menu: three levels with their names, details and ages (SCRUM-308), sizes 5/10/20, heading focused (EN/SK)', () => {
  render(<App />);
  fireEvent.click(exact('Word search'));
  expect(heading()).toHaveTextContent('Which word search shall we try?');
  expect(document.activeElement).toBe(heading());
  const levels = screen
    .getAllByRole('radio', { name: /^Level / })
    .map((r) => r.closest('label')!.textContent);
  expect(levels).toEqual([
    '1Level 1 · Find the wordsRead the words, then find them left to right or top to bottomAges 5 to 95–9',
    '2Level 2 · Listen and findListen to each word, then find itAges 7 to 97–9',
    '3Level 3 · All directionsWords can also go backwards and diagonallyAges 8 to 98–9',
  ]);
  expect(screen.getByRole('radio', { name: /^Level 1 / })).toBeChecked();
  expect(screen.getByRole('radio', { name: '10 exercises' })).toBeChecked();
  fireEvent.click(button('Back to courses'));
  fireEvent.click(button('Settings'));
  fireEvent.click(button('Slovenčina'));
  fireEvent.click(button('Zavrieť nastavenia'));
  fireEvent.click(exact('Osemsmerovka'));
  expect(heading()).toHaveTextContent('Ktorú osemsmerovku skúsime?');
  expect(
    screen.getAllByRole('radio', { name: /^Úroveň / }).map((r) => r.closest('label')!.textContent),
  ).toEqual([
    '1Úroveň 1 · Nájdi slováPrečítaj si slová a nájdi ich zľava doprava alebo zhora nadolVek 5 až 9 rokov5–9',
    '2Úroveň 2 · Počúvaj a nájdiVypočuj si každé slovo a potom ho nájdiVek 7 až 9 rokov7–9',
    '3Úroveň 3 · Všetky smerySlová môžu ísť aj odzadu a šikmoVek 8 až 9 rokov8–9',
  ]);
});

test('level 1: 36 letter buttons named by row, column and letter; the words below play when tapped', async () => {
  await start();
  expect(grid.generateSearchLesson).toHaveBeenCalledWith(1, 5);
  const cells = screen.getAllByRole('button', { name: /^Row \d, column \d, [A-Z]$/ });
  expect(cells).toHaveLength(36);
  expect(cells[0]).toHaveAccessibleName(`Row 1, column 1, ${lesson[0].rows[0][0]}`);
  expect(cells[35]).toHaveAccessibleName(`Row 6, column 6, ${lesson[0].rows[5][5]}`);
  expect(screen.getByText('Word search 1 of 1')).toBeInTheDocument();
  expect(heading()).toHaveTextContent('Find the words');
  expect(played).toEqual([]); // nothing plays by itself
  const list = screen.getByRole('list', { name: 'Words to find' });
  const words = within(list).getAllByRole('button');
  expect(words.map((b) => b.textContent)).toEqual(lesson[0].words.map((w) => w.word.toUpperCase()));
  fireEvent.click(words[2]);
  expect(played).toEqual([lesson[0].words[2].word.toLowerCase()]);
  expect(words[2]).toHaveAttribute('data-playing');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Tap the first letter of a word, then its last letter.',
  );
});

test('first tap marks the letter (aria-pressed), a second tap on it cancels; double tap keeps it', async () => {
  await start();
  let now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const [a, b] = wrongPair();
  tapCell(a);
  expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Now tap the last letter of the word.');
  // The second click of a double tap on the same letter is ignored...
  tapCell(a, 2);
  expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'true');
  // ...a deliberate (slower) second tap cancels.
  now += 600;
  tapCell(a);
  expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'false');
  // A quick tap on a different letter right after is a real second tap.
  now += 600;
  tapCell(a);
  tapCell(b, 2);
  expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('status')).toHaveTextContent(
    'That is not a word from the list. Try again.',
  );
});

test('QA247-04: a quick second tap with detail 1 (Firefox touch) keeps the letter marked; a slow one cancels', async () => {
  await start();
  let now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const [a, b] = wrongPair();
  tapCell(a);
  now += 150;
  tapCell(a); // the second touch of a quick double tap, reported as detail 1
  expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'true');
  now += 340; // still within 500 ms of the tap that marked it
  tapCell(a);
  expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'true');
  now += 20; // 510 ms after the marking tap: a deliberate tap cancels
  tapCell(a);
  expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'false');
  // Cancelled: the next quick tap marks it again (it is not swallowed by the guard).
  now += 50;
  tapCell(a);
  expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'true');
  // A quick tap on a different letter always goes through.
  now += 50;
  tapCell(b);
  expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('status')).toHaveTextContent(
    'That is not a word from the list. Try again.',
  );
  // Keyboard (Enter/Space, detail 0): a second press right away still cancels.
  now += 50;
  tapCell(a, 0);
  expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'true');
  tapCell(a, 0);
  expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'false');
});

test('a found word: coloured, struck through, a pop and the word plays again; no answer melody', async () => {
  await start();
  const word = lesson[0].words[1];
  await act(async () => find(1));
  expect(pops()).toBe(1);
  expect(melodies()).toBe(0);
  expect(played).toEqual([word.word.toLowerCase()]);
  const item = screen.getByRole('button', { name: `${word.word.toUpperCase()}, found` });
  expect(item.querySelector('s')).toHaveTextContent(word.word.toUpperCase());
  for (const cell of word.cells) {
    expect(cellButton(cell.row, cell.col)).toHaveAttribute('data-word', '1');
    expect(cellButton(cell.row, cell.col).getAttribute('aria-label')).toMatch(/, found$/);
  }
  expect(screen.getByRole('status')).toHaveTextContent(
    `Well done, you found ${word.word.toUpperCase()}!`,
  );
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
  expect(screen.getByRole('progressbar')).toHaveAttribute('max', '5');
  // Tapping its ends again does nothing (not wrong).
  await act(async () => find(1));
  expect(pops()).toBe(1);
  expect(screen.getByRole('status')).not.toHaveTextContent('Try again');
});

test('a wrong pair flashes softly and clears (no sound); the next word found loses its point', async () => {
  vi.useFakeTimers();
  try {
    await start();
    const [a, b] = wrongPair();
    tapCell(a);
    tapCell(b);
    expect(cellButton(a.row, a.col)).toHaveAttribute('data-flash');
    expect(cellButton(b.row, b.col)).toHaveAttribute('data-flash');
    expect(cellButton(a.row, a.col)).toHaveAttribute('aria-pressed', 'false');
    expect(feedback).not.toHaveBeenCalledWith('incorrect');
    act(() => vi.advanceTimersByTime(700));
    expect(cellButton(a.row, a.col)).not.toHaveAttribute('data-flash');
    for (let i = 0; i < 5; i++) await act(async () => find(i));
    // Finish: 4 of 5 on the first try (word 0 came after the wrong pair).
    await act(async () => fireEvent.click(button(/See how you did/)));
  } finally {
    vi.useRealTimers();
  }
  expect(screen.getByText('5 words found')).toBeInTheDocument();
  expect(screen.getByText('First try, without hints').parentElement).toHaveTextContent('4 / 5');
  expect(feedback).toHaveBeenCalledWith('complete');
});

test.each([
  [5, 1],
  [10, 2],
  [20, 4],
] as const)(
  'a lesson of %i words is %i grid(s); Next shows after each solved grid',
  async (size, grids) => {
    await start({ size });
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', String(size));
    for (let p = 0; p < grids; p++) {
      expect(screen.getByText(`Word search ${p + 1} of ${grids}`)).toBeInTheDocument();
      for (let i = 0; i < 5; i++) await act(async () => find(i, p));
      expect(screen.getByRole('status')).toHaveTextContent('You found all the words! Well done.');
      const next = button(p === grids - 1 ? /See how you did/ : /Next word search/);
      expect(next).toHaveFocus();
      await act(async () => fireEvent.click(next, { detail: 1 }));
    }
    expect(screen.getByText(`${size} words found`)).toBeInTheDocument();
    expect(screen.getByText('First try, without hints').parentElement).toHaveTextContent(
      `${size} / ${size}`,
    );
  },
);

test('level 2: speakers named "Word 1".."Word 5"; the word appears nowhere before it is found', async () => {
  await start({ level: 2 });
  expect(heading()).toHaveTextContent('Listen and find the words');
  const list = screen.getByRole('list', { name: 'Words to find' });
  const speakers = within(list).getAllByRole('button');
  expect(speakers.map((s) => s.getAttribute('aria-label'))).toEqual([
    'Word 1',
    'Word 2',
    'Word 3',
    'Word 4',
    'Word 5',
  ]);
  // Outside the letter grid, no text or attribute names a word of the grid (as a whole word).
  const outside = document.querySelector('.wordsearch-practice')!.cloneNode(true) as HTMLElement;
  outside.querySelector('.ws-board')!.remove();
  const texts = [
    outside.textContent!,
    ...[...outside.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.value)),
  ];
  for (const { word } of lesson[0].words)
    for (const text of texts) expect(text).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
  fireEvent.click(speakers[3]);
  expect(played).toEqual([lesson[0].words[3].word.toLowerCase()]);
  expect(speakers[3]).toHaveAttribute('data-playing');
  await act(async () => find(3));
  const word = lesson[0].words[3].word.toUpperCase();
  expect(speakers[3]).toHaveAccessibleName(`Word 4: ${word}, found`);
  expect(within(list).getAllByRole('listitem')[3].querySelector('s')).toHaveTextContent(word);
  // The found word played again; the speaker's highlight belongs to the speaker's own taps.
  expect(played.at(-1)).toBe(lesson[0].words[3].word.toLowerCase());
  expect(speakers[3]).not.toHaveAttribute('data-playing');
});

test('level 3: the words are listed like level 1; the grid uses the all-direction generator', async () => {
  await start({ level: 3, size: 10 });
  expect(grid.generateSearchLesson).toHaveBeenCalledWith(3, 10);
  expect(heading()).toHaveTextContent('Find the words in all directions');
  expect(
    within(screen.getByRole('list', { name: 'Words to find' }))
      .getAllByRole('button')
      .map((b) => b.textContent),
  ).toEqual(lesson[0].words.map((w) => w.word.toUpperCase()));
});

test('Mute: no pop, but the found word still plays', async () => {
  await start();
  fireEvent.click(button('Settings'));
  await act(async () => fireEvent.click(button('Sound on')));
  fireEvent.click(button('Close settings'));
  await act(async () => find(0));
  expect(pops()).toBe(0);
  expect(played).toEqual([lesson[0].words[0].word.toLowerCase()]);
});

test('screen-reader alternative: choose the letters in order finds the word; a wrong letter is a wrong try', async () => {
  await start();
  const toggle = button('Choose the letters in order');
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const target = lesson[0].words[0].word.toUpperCase();
  expect(screen.getByText(`Word 1 of 5: ${target}`)).toBeInTheDocument();
  const letters = screen.getByRole('group', { name: 'Letter buttons' });
  const wrong = within(letters)
    .getAllByRole('button')
    .find((b) => !target.includes(b.textContent!))!;
  fireEvent.click(wrong);
  expect(screen.getByRole('status')).toHaveTextContent('Not this letter. Try again.');
  for (const letter of target)
    await act(async () => fireEvent.click(within(letters).getByRole('button', { name: letter })));
  expect(pops()).toBe(1);
  expect(button(`${target}, found`)).toBeInTheDocument();
  // The next word is offered; its point is earned.
  expect(
    screen.getByText(`Word 2 of 5: ${lesson[0].words[1].word.toUpperCase()}`),
  ).toBeInTheDocument();
  for (let i = 1; i < 5; i++) await act(async () => find(i));
  await act(async () => fireEvent.click(button(/See how you did/)));
  expect(screen.getByText('First try, without hints').parentElement).toHaveTextContent('4 / 5');
});

test('keyboard: one Tab stop in the grid; arrow keys move between the letters', async () => {
  await start();
  const cells = [...document.querySelectorAll<HTMLButtonElement>('.ws-cell')];
  expect(cells.filter((c) => c.tabIndex === 0)).toHaveLength(1);
  expect(cells[0]).toHaveFocus();
  fireEvent.keyDown(cells[0], { key: 'ArrowRight' });
  expect(cells[1]).toHaveFocus();
  fireEvent.keyDown(cells[1], { key: 'ArrowDown' });
  expect(cells[7]).toHaveFocus();
  expect(cells[7].tabIndex).toBe(0);
  expect(cells[0].tabIndex).toBe(-1);
  fireEvent.keyDown(cells[7], { key: 'ArrowLeft' });
  fireEvent.keyDown(cells[6], { key: 'ArrowLeft' });
  expect(cells[6]).toHaveFocus(); // stops at the edge
  expect(screen.getByRole('group', { name: 'Letters' })).toHaveAccessibleDescription(
    'Arrow keys move between the letters; Enter or Space taps a letter.',
  );
});

test('leaving asks once a letter is marked or a word found; before that Back leaves at once', async () => {
  await start();
  fireEvent.click(button('Choose level'));
  expect(heading()).toHaveTextContent('Which word search shall we try?');
  await act(async () => fireEvent.click(button(/Let’s search/)));
  tapCell(lesson[0].words[0].cells[0]);
  fireEvent.click(button('Choose level'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(button('Keep practising'));
  await act(async () => find(2));
  fireEvent.click(button('Choose level'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('Slovak lesson: grid, words and messages in Slovak', async () => {
  await start({ sk: true });
  expect(screen.getByText('Osemsmerovka 1 z 1')).toBeInTheDocument();
  expect(cellButton(0, 0)).toHaveAccessibleName(`Riadok 1, stĺpec 1, ${lesson[0].rows[0][0]}`);
  expect(screen.getByRole('list', { name: 'Slová na hľadanie' })).toBeInTheDocument();
  await act(async () => find(0));
  expect(screen.getByRole('status')).toHaveTextContent(
    `Výborne, slovo ${lesson[0].words[0].word.toUpperCase()} je nájdené!`,
  );
});

test('signed in: the lesson is saved like other lessons, course wordsearch x1, first-try points', async () => {
  const account = {
    kind: 'password',
    username: 'kid',
    nickname: 'Kid',
    look: { fur: 0, background: 0, head: 3, neck: 0, eyes: 0 },
    email: null,
  };
  let total = 7;
  const calls = fakeServer(({ path, body }) => {
    if (path === '/api/me') return reply({ account });
    if (path === '/api/auth/google') return reply({ available: false });
    if (path === '/api/progress') return reply({ points: total });
    if (path === '/api/progress/lessons') return reply({ lessonId: 'b'.repeat(32) }, 201);
    if (path === '/api/progress/lessons/finish') {
      total += (body as { points: number }).points;
      return reply({ points: total, added: (body as { points: number }).points });
    }
    return reply({ error: 'not_found' }, 404);
  });
  render(<App />);
  await flush();
  fireEvent.click(exact('Word search'));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  await act(async () => fireEvent.click(button(/Let’s search/)));
  await waitFor(() =>
    expect(calls.find((c) => c.path === '/api/progress/lessons')?.body).toEqual({ size: 5 }),
  );
  const [a, b] = wrongPair();
  tapCell(a);
  tapCell(b);
  for (let i = 0; i < 5; i++) await act(async () => find(i));
  await act(async () => fireEvent.click(button(/See how you did/)));
  await waitFor(() =>
    expect(calls.find((c) => c.path === '/api/progress/lessons/finish')?.body).toMatchObject({
      points: 4,
    }),
  );
  expect(JSON.parse(localStorage.getItem('bearmatics-plays')!)['password:kid'].counts).toEqual({
    'wordsearch:1': 1,
  });
});
