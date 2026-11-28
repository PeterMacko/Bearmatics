import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import App from '../App';
import { FeedbackAudio } from '../audio';
import { PLAYS_KEY, deviceSlovakDay } from '../progress/playCounts';
import { fakeServer, reply, type Call } from '../testing/fakeServer';
import { tap } from '../testing/ui';
import * as pexeso from './pexeso';
import { PEXESO_PICTURES, gameFromCards, type PexesoPicture } from './pexeso';
import { openLogic } from '../testing/openCourse';

// SCRUM-324: Pexeso (Logic Levels 6-8) in the app: menu, turns, guards, chip and hearts,
// messages, summary, points, leaving and the 1.5 s close timer.

const P = PEXESO_PICTURES;
/** a b c d e f ... then the same again: card i and i + pairs are a pair. */
const twoRows = (pairs: number): PexesoPicture[] => [...P.slice(0, pairs), ...P.slice(0, pairs)];

let now = 1000;
/** Time for performance.now (the tap guards) and the fake timers (the 1.5 s close). */
const wait = (ms: number) => {
  now += ms;
  act(() => vi.advanceTimersByTime(ms));
};
/** Switches fake/real timers; the performance clock stays the test's `now` either way. */
const timers = (fake: boolean) => {
  if (fake) vi.useFakeTimers();
  else vi.useRealTimers();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
};
beforeEach(() => {
  now = 1000;
  timers(true);
  vi.spyOn(pexeso, 'newGame').mockImplementation((pairs) => gameFromCards(twoRows(pairs)));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const exact = (name: string) => screen.getByRole('button', { name });
const board = () => screen.getByRole('group', { name: /^(Cards|Karty)$/ });
const cards = () => within(board()).getAllByRole('button');
const card = (n: number) => cards()[n - 1];
const names = () => cards().map((c) => c.getAttribute('aria-label'));
const message = () => document.querySelector('.pexeso-message')!.textContent;
/** A deliberate tap on card n (detail 1), after the guards' time has passed. */
const flip = (n: number) => {
  wait(310);
  fireEvent.click(card(n), { detail: 1 });
};

function start(level: 6 | 7 | 8, lang: 'en' | 'sk' = 'en') {
  const word = lang === 'sk' ? 'Úroveň' : 'Level';
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^${word} ${level} ·`) }));
  tap(lang === 'sk' ? 'Poďme plánovať' : 'Let’s plan');
  wait(700); // the board's first 600 ms ignore taps (the rest of the Start tap)
}
/** Finds every pair of a twoRows board in order (no misses). */
function solve(pairs: number) {
  for (let i = 1; i <= pairs; i++) {
    flip(i);
    flip(i + pairs);
  }
}

describe('menu (AC 1)', () => {
  test('Levels 6-8 have no exercise-count choice; other Logic levels keep it', () => {
    openLogic();
    // The count keeps its room (invisible, aria-hidden, inert) so the menu does not move.
    const count = () =>
      document.querySelector('.selection .session-options:not(.session-options-off)');
    const radios = () => screen.queryAllByRole('radio', { name: /exercises$/ });
    expect(radios()).toHaveLength(3);
    expect(count()).not.toBeNull();
    for (const level of [6, 7, 8]) {
      fireEvent.click(
        screen.getByRole('radio', { name: new RegExp(`^Level ${level} · Matching pairs`) }),
      );
      expect(count(), `level ${level}`).toBeNull();
      expect(radios(), `level ${level}`).toHaveLength(0);
      expect(document.querySelector('.session-options-off')).toHaveAttribute('inert');
    }
    fireEvent.click(screen.getByRole('radio', { name: /^Level 5 ·/ }));
    expect(count()).not.toBeNull();
  });
  test('each level starts its board: 12 / 20 / 30 cards, the pair count as the lesson size', () => {
    openLogic();
    for (const [level, pairs] of [
      [6, 6],
      [7, 10],
      [8, 15],
    ] as const) {
      start(level);
      expect(pexeso.newGame).toHaveBeenLastCalledWith(pairs, Math.random);
      expect(cards()).toHaveLength(pairs * 2);
      expect(document.querySelector('.level-pill')).toHaveTextContent(`Level ${level}`);
      fireEvent.click(exact('Choose level'));
    }
  });
});

describe('turns (AC 4, 11)', () => {
  test('heading focused; card names; a pair stays found with a polite message', () => {
    openLogic();
    start(6);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Find the pairs');
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
    expect(names()).toEqual(Array.from({ length: 12 }, (_, i) => `Card ${i + 1}, face down`));
    // The picture is not in the DOM before the card is opened.
    expect(board().querySelectorAll('[data-picture]')).toHaveLength(0);
    flip(1);
    expect(card(1)).toHaveAccessibleName('Card 1, bear');
    flip(7);
    expect(card(1)).toHaveAccessibleName('bear, found');
    expect(card(7)).toHaveAccessibleName('bear, found');
    expect(card(1)).toHaveAttribute('aria-disabled', 'true');
    expect(message()).toBe('Pair found: bear, 1 of 6');
    expect(document.querySelector('.pexeso-pairs')).toHaveTextContent('1 / 6');
    expect(document.querySelector('.pexeso-pairs .sr-only')).toHaveTextContent(
      'Pairs found: 1 of 6',
    );
  });
  test('a miss closes after 1.5 s; never 3 open; the next tap closes at once and opens its card', () => {
    openLogic();
    start(6);
    flip(1);
    flip(2);
    expect(message()).toBe('Not a pair');
    expect(names().slice(0, 2)).toEqual(['Card 1, bear', 'Card 2, pirate']);
    wait(1490);
    expect(names().slice(0, 2)).toEqual(['Card 1, bear', 'Card 2, pirate']);
    wait(10); // 1.5 s from the second card
    expect(names().slice(0, 2)).toEqual(['Card 1, face down', 'Card 2, face down']);
    flip(3);
    flip(4);
    // A tap on a third card while the miss waits: both close, the tapped card opens.
    flip(5);
    const open = names().filter((n) => !n!.endsWith('face down'));
    expect(open).toEqual(['Card 5, plane']);
    // A tap on the open card again changes nothing.
    flip(5);
    expect(names().filter((n) => !n!.endsWith('face down'))).toEqual(['Card 5, plane']);
    // A tap on one of the two open cards of a miss only closes them.
    flip(6);
    flip(6);
    expect(names().every((n) => n!.endsWith('face down'))).toBe(true);
  });
  test('guards: the first 600 ms, double taps (detail 2) and taps within 300 ms change nothing', () => {
    openLogic();
    fireEvent.click(screen.getByRole('radio', { name: /^Level 6 ·/ }));
    tap('Let’s plan');
    fireEvent.click(card(1), { detail: 1 }); // the rest of the Start tap
    wait(300);
    fireEvent.click(card(1), { detail: 1 });
    expect(card(1)).toHaveAccessibleName('Card 1, face down');
    wait(400);
    fireEvent.click(card(1), { detail: 1 });
    expect(card(1)).toHaveAccessibleName('Card 1, bear');
    fireEvent.click(card(2), { detail: 2 }); // second click of a double tap
    wait(100);
    fireEvent.click(card(2), { detail: 1 }); // too soon after the accepted tap
    expect(card(2)).toHaveAccessibleName('Card 2, face down');
    // Keyboard Enter/Space (detail 0) counts once 300 ms have passed since the accepted tap.
    wait(250);
    fireEvent.click(card(2), { detail: 0 });
    expect(card(2)).toHaveAccessibleName('Card 2, pirate');
  });
  test('keyboard: a held or fast repeated Enter does not close a miss at once; a deliberate Enter or Space still works', () => {
    openLogic();
    start(6);
    const key = (n: number, init: { key: string; repeat?: boolean }) => {
      // Like a browser: a button activates on Enter keydown unless the keydown is cancelled.
      const allowed = fireEvent.keyDown(card(n), init);
      if (allowed) fireEvent.click(card(n), { detail: 0 });
    };
    // The first card on the keyboard, right away (focus came from the heading, no settle wait).
    key(1, { key: 'Enter' });
    expect(card(1)).toHaveAccessibleName('Card 1, bear');
    wait(400);
    key(2, { key: 'Enter' }); // card 2: a miss, both stay open for 1.5 s
    expect(names().slice(0, 2)).toEqual(['Card 1, bear', 'Card 2, pirate']);
    // A fast second Enter (a new press within 300 ms of card 2) changes nothing.
    wait(50);
    key(2, { key: 'Enter' });
    expect(names().slice(0, 2)).toEqual(['Card 1, bear', 'Card 2, pirate']);
    // Enter held down for 0.6 s: the auto-repeat keydowns are cancelled, the miss stays open.
    for (let i = 0; i < 17; i++) {
      wait(35);
      key(2, { key: 'Enter', repeat: true });
    }
    expect(names().slice(0, 2)).toEqual(['Card 1, bear', 'Card 2, pirate']);
    // A deliberate Enter later closes the miss (the next-tap rule), as a tap does.
    wait(300);
    key(2, { key: 'Enter' });
    expect(names().every((n) => n!.endsWith('face down'))).toBe(true);
    // Space works the same: a deliberate press opens a card.
    wait(310);
    key(3, { key: ' ' });
    expect(card(3)).toHaveAccessibleName('Card 3, lollipop');
    wait(310);
    key(9, { key: ' ' }); // card 9 = lollipop: a pair
    expect(card(9)).toHaveAccessibleName('lollipop, found');
    expect(message()).toBe('Pair found: lollipop, 1 of 6');
  });
});

describe('signed out (AC 8, decision 4)', () => {
  test('no chip and no hearts; the pairs counter; the summary has pairs and turns; nothing saved', () => {
    const calls = fakeServer(() => reply({ error: 'not_signed_in' }, 401));
    openLogic();
    start(6);
    expect(document.querySelector('.pexeso-chip')).toBeNull();
    expect(document.querySelector('.pexeso-hearts')).toBeNull();
    expect(document.querySelector('.pexeso-pairs')).toHaveTextContent('0 / 6');
    flip(1);
    flip(2);
    wait(1500);
    solve(6);
    const summary = document.querySelector<HTMLElement>('.summary')!;
    expect(summary).toHaveTextContent('Pairs found: 6');
    expect(summary).toHaveTextContent('Turns: 7');
    expect(summary).toHaveTextContent(/Time \d+:\d\d · about \d+ s per pair/);
    expect(summary).not.toHaveTextContent(/first try/i);
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
    expect(calls.filter((c) => c.path.startsWith('/api/progress'))).toEqual([]);
  });
});

function signedInServer(): { calls: Call[] } {
  let total = 100;
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
    if (path === '/api/progress/lessons') return reply({ lessonId: 'd'.repeat(32) }, 201);
    if (path === '/api/progress/lessons/finish') {
      total += (body as { points: number }).points;
      return reply({ points: total, added: (body as { points: number }).points });
    }
    return reply({ error: 'not_found' }, 404);
  });
  return { calls };
}

describe('signed in: chip, hearts and points (AC 6-9)', () => {
  test('a lucky miss changes nothing; forgotten misses take the heart first, then a point', async () => {
    timers(false);
    const { calls } = signedInServer();
    await openLogicReal();
    timers(true);
    start(6);
    const chip = () => document.querySelector('.pexeso-chip')!;
    const used = () => document.querySelectorAll('.pexeso-heart[data-used]').length;
    expect(chip()).toHaveTextContent('6');
    expect(chip().querySelector('.sr-only')).toHaveTextContent('Points for this game: 6');
    expect(document.querySelectorAll('.pexeso-heart')).toHaveLength(1);
    expect(document.querySelector('.pexeso-hearts .sr-only')).toHaveTextContent('1 free slip left');
    // Lucky: bear(1) + pirate(2), both unseen before.
    flip(1);
    flip(2);
    wait(1500);
    expect([chip().textContent, used()]).toEqual(['6Points for this game: 6', 0]);
    // Forgotten: bear(7) first, its partner (1) was seen, then a wrong card: the heart goes.
    flip(7);
    flip(3);
    wait(1500);
    expect(used()).toBe(1);
    expect(chip()).toHaveTextContent('6');
    expect(document.querySelector('.pexeso-hearts .sr-only')).toHaveTextContent(
      'No free slips left',
    );
    // Forgotten again: now the number drops by 1 (gently, no minus sign).
    flip(8);
    flip(4);
    wait(1500);
    expect(chip()).toHaveTextContent('5');
    expect(chip()).toHaveAttribute('data-dropped', 'true');
    expect(chip().textContent).not.toMatch(/[-−]/);
    // Finish: saved once, size = pairs, points = 5 (x1, first play).
    timers(false);
    for (let i = 1; i <= 6; i++) {
      now += 700;
      fireEvent.click(card(i), { detail: 1 });
      now += 700;
      fireEvent.click(card(i + 6), { detail: 1 });
    }
    await waitFor(() =>
      expect(calls.filter((c) => c.path === '/api/progress/lessons/finish')).toHaveLength(1),
    );
    expect(calls.find((c) => c.path === '/api/progress/lessons')!.body).toEqual({ size: 6 });
    expect(calls.find((c) => c.path === '/api/progress/lessons/finish')!.body).toMatchObject({
      size: 6,
      points: 5,
    });
  });
  test('the 3rd play of the day of a Pexeso level gives x0.5 in the summary', async () => {
    timers(false);
    localStorage.setItem(
      PLAYS_KEY,
      JSON.stringify({
        'password:kid': { day: deviceSlovakDay(Date.now()), counts: { 'logic:7': 2 } },
      }),
    );
    const { calls } = signedInServer();
    await openLogicReal();
    // The menu shows the next play's 1/2 sign on Level 7 only.
    expect(document.querySelector('.level-7 .next-play')).toHaveTextContent('1/2');
    expect(document.querySelector('.level-6 .next-play')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /^Level 7 ·/ }));
    tap('Let’s plan');
    for (let i = 1; i <= 10; i++) {
      now += 700;
      fireEvent.click(card(i), { detail: 1 });
      now += 700;
      fireEvent.click(card(i + 10), { detail: 1 });
    }
    await waitFor(() =>
      expect(calls.find((c) => c.path === '/api/progress/lessons/finish')?.body).toMatchObject({
        size: 10,
        points: 5,
      }),
    );
    await waitFor(() =>
      expect(document.querySelector('.summary .points-multiplied')).toHaveTextContent(
        '10 × 1/2 = 5 points',
      ),
    );
  });
});

/** Renders the app with real timers (the account loads), then opens Logic once signed in. */
async function openLogicReal() {
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Leaderboard/ })).toBeInTheDocument(),
  );
  fireEvent.click(exact('Logic'));
}

describe('leaving and replaying (AC 8, pitfalls)', () => {
  test('leaving mid-game asks first, saves nothing; the close timer does not leak into the next game', () => {
    // Watch the 1.5 s close timer: record every time its callback actually runs.
    const fired: number[] = [];
    const realSetTimeout = window.setTimeout;
    vi.spyOn(window, 'setTimeout').mockImplementation(((
      handler: TimerHandler,
      ms?: number,
      ...rest: unknown[]
    ) =>
      realSetTimeout.call(
        window,
        (...args: unknown[]) => {
          if (ms === 1500) fired.push(now);
          if (typeof handler === 'function') handler(...args);
        },
        ms,
        ...rest,
      )) as unknown as typeof window.setTimeout);
    openLogic();
    start(6);
    flip(1);
    flip(2); // a miss: its close timer runs
    fireEvent.click(exact('Choose level'));
    expect(screen.getByRole('dialog')).toHaveTextContent('Leave this trail?');
    fireEvent.click(exact('Choose a new trail'));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Which puzzle shall we try?',
    );
    // On the menu, well past the old miss's 1.5 s: leaving cleared its timer, so it never runs.
    wait(1600);
    expect(fired).toEqual([]);
    start(6);
    flip(3);
    flip(4); // a new miss: only its own timer closes it, 1.5 s later
    const missAt = now;
    wait(1400);
    expect(names().slice(2, 4)).toEqual(['Card 3, lollipop', 'Card 4, boat']);
    wait(100);
    expect(names().slice(2, 4)).toEqual(['Card 3, face down', 'Card 4, face down']);
    expect(fired).toEqual([missAt + 1500]);
  });
  test('Play again: a new shuffled board (new game), the summary buttons keep their guards', () => {
    openLogic();
    start(6);
    solve(6);
    expect(pexeso.newGame).toHaveBeenCalledTimes(1);
    fireEvent.click(exact('Play again'), { detail: 2 });
    expect(document.querySelector('.summary')).not.toBeNull();
    fireEvent.click(exact('Play again'), { detail: 1 });
    expect(pexeso.newGame).toHaveBeenCalledTimes(2);
    expect(cards()).toHaveLength(12);
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
    // The rest of the Play again tap lands on a card: ignored.
    fireEvent.click(card(1), { detail: 1 });
    expect(card(1)).toHaveAccessibleName('Card 1, face down');
    wait(700);
    fireEvent.click(card(1), { detail: 1 });
    expect(card(1)).toHaveAccessibleName('Card 1, bear');
    solve(6);
    const summary = document.querySelector<HTMLElement>('.summary')!;
    fireEvent.click(within(summary).getByRole('button', { name: 'Choose level' }), { detail: 1 });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Which puzzle shall we try?',
    );
  });
});

describe('help, Slovak and sounds (AC 11, 12)', () => {
  test('the help window explains the rule (signed out: no points promise), closes on the shade', () => {
    fakeServer(() => reply({ error: 'not_signed_in' }, 401));
    openLogic();
    start(8);
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }), { detail: 1 });
    const dialog = screen.getByRole('dialog', { name: 'Matching pairs' });
    expect(dialog).toHaveTextContent(
      'Find all the pairs: turn over two cards at a time and remember where each picture is.',
    );
    expect(dialog).not.toHaveTextContent(/lose a point/);
    expect(
      within(dialog).getByRole('img', { name: 'Two cards with the same apple make a pair' }),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Close/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  test('Slovak names and messages', () => {
    openLogic('sk');
    start(6, 'sk');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Nájdi dvojice');
    expect(card(1)).toHaveAccessibleName('Karta 1, otočená rubom');
    flip(1);
    expect(card(1)).toHaveAccessibleName('Karta 1, medveď');
    flip(2);
    expect(message()).toBe('Nie je to dvojica');
    wait(1500);
    flip(1);
    flip(7);
    expect(card(1)).toHaveAccessibleName('medveď, nájdená dvojica');
    expect(message()).toBe('Dvojica nájdená: medveď, 1 z 6');
  });
  test('sounds follow Mute: a flip per turned card, the correct cue per pair, the fanfare once', async () => {
    vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockResolvedValue(true);
    const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
    openLogic();
    start(6);
    await act(async () => {});
    flip(1);
    flip(2);
    expect(play.mock.calls.map((c) => c[0])).toEqual(['flip', 'flip']);
    play.mockClear();
    wait(1500);
    expect(play).not.toHaveBeenCalled(); // closing is quiet; a miss has no sound
    flip(1);
    flip(7);
    expect(play.mock.calls.map((c) => c[0])).toEqual(['flip', 'flip', 'correct']);
    play.mockClear();
    for (let i = 2; i <= 6; i++) {
      flip(i);
      flip(i + 6);
    }
    expect(play.mock.calls.filter((c) => c[0] === 'complete')).toHaveLength(1);
    expect(play.mock.calls.filter((c) => c[0] === 'correct')).toHaveLength(4);
    // Muted: nothing plays.
    tap('Play again');
    wait(700);
    fireEvent.click(exact('Settings'));
    fireEvent.click(screen.getByRole('button', { name: /^Sound (on|requested)$/ }));
    fireEvent.click(exact('Close settings'));
    play.mockClear();
    flip(1);
    flip(7);
    expect(play).not.toHaveBeenCalled();
  });
});
