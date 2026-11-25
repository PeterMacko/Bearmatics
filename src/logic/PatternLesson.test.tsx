import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import App from '../App';
import { DEMO_KEYS } from '../demoSeen';
import { multiplierFor } from '../progress/multipliers';
import { fakeServer, reply } from '../testing/fakeServer';
import { tap } from '../testing/ui';
import { PATTERN_DEMO_MS, PATTERN_STILL_DEMO_MS } from './PatternDemo';
import * as patterns from './patterns';
import type { PatternItem, PatternRow } from './patterns';

// SCRUM-299 / SCRUM-302: Logic Levels 3-5 "What comes next?" in the app.

const m = (motif: 'pirates' | 'bears' | 'lollipops' | 'boats' | 'aircraft'): PatternItem => ({
  kind: 'motif',
  motif,
});
const c = (count: number): PatternItem => ({ kind: 'count', motif: 'bears', count });
const a = (arrow: 'up' | 'down' | 'left' | 'right'): PatternItem => ({ kind: 'arrow', arrow });
/** Pirate, bear x3, then "?" (bear): choices bear, lollipop, pirate. */
const ROW3: PatternRow = {
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
  choices: [m('bears'), m('lollipops'), m('pirates')],
};
const ROW5: PatternRow = {
  level: 5,
  type: 'grow',
  places: [c(2), c(3), c(4), c(5)],
  gap: 3,
  choices: [c(4), c(6), c(5)],
};
const ARROWS: PatternRow = {
  level: 5,
  type: 'turn',
  places: [a('up'), a('right'), a('down'), a('left')],
  gap: 3,
  choices: [a('right'), a('left'), a('up')],
};

const exact = (name: string) => screen.getByRole('button', { name });
const row = () => document.querySelector<HTMLElement>('.pattern-row')!;
const demo = () => document.querySelector('.pattern-demo');
const choice = (name: string) =>
  within(
    screen.getByRole('group', { name: /^(Pictures to choose from|Obrázky na výber)$/ }),
  ).getByRole('button', { name });
const feedback = () => document.getElementById('answer-feedback')!;
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const pick = (name: string, detail = 1) => fireEvent.click(choice(name), { detail });

let rows: (level: number) => PatternRow = () => ROW3;
beforeEach(() => {
  vi.useFakeTimers();
  rows = () => ROW3;
  vi.spyOn(patterns, 'generatePatternSession').mockImplementation((level, size) =>
    Array.from({ length: size }, () => rows(level)),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openLogic(lang: 'en' | 'sk' = 'en') {
  render(<App />);
  if (lang === 'sk') {
    fireEvent.click(exact('Settings'));
    fireEvent.click(exact('Slovenčina'));
    fireEvent.click(exact('Zavrieť nastavenia'));
    fireEvent.click(exact('Logika'));
  } else fireEvent.click(exact('Logic'));
}
/** Picks a level and 5 exercises and starts (the demo, if it plays, keeps running). */
function start(level = 3, lang: 'en' | 'sk' = 'en') {
  const word = lang === 'sk' ? 'Úroveň' : 'Level';
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^${word} ${level} ·`) }));
  fireEvent.click(
    screen.getByRole('radio', { name: lang === 'sk' ? '5 príkladov' : '5 exercises' }),
  );
  tap(lang === 'sk' ? 'Poďme plánovať' : 'Let’s plan');
}
const seen = () => localStorage.setItem(DEMO_KEYS.patterns, '1');
const back = () => fireEvent.click(exact('Choose level'));

describe('menu', () => {
  test('Slovak: Levels 3-5 after the bear levels with their detail lines', () => {
    openLogic('sk');
    expect(
      screen
        .getAllByRole('radio', { name: /^Úroveň / })
        .map((r) => r.closest('label')!.textContent),
    ).toEqual([
      expect.stringMatching(/^1.*Medveď ide po med/),
      expect.stringMatching(/^2.*Okolo kameňov/),
      expect.stringMatching(/^3.*Čo príde ďalej\?.*Dva obrázky sa striedajú: vyber ďalší/),
      expect.stringMatching(/^4.*Čo chýba\?.*Nájdi obrázok, ktorý patrí do medzery/),
      expect.stringMatching(/^5.*Rastie a otáča sa.*Viac, menej alebo otáčanie šípky: vyber ďalší/),
    ]);
  });

  test('each level starts its own lesson size from the generator', () => {
    rows = (level) => ({ ...ROW3, level: level as 3 | 4 | 5 });
    seen();
    openLogic();
    for (const level of [3, 4, 5]) {
      start(level);
      expect(patterns.generatePatternSession).toHaveBeenLastCalledWith(level, 5);
      expect(document.querySelector('.level-pill')).toHaveTextContent(`Level ${level}`);
      back();
    }
  });
});

describe('answering', () => {
  test('the row reads its pictures and "question mark"; choices are named, never "right"', () => {
    seen();
    openLogic();
    start();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Which picture comes next?',
    );
    expect(row()).toHaveAccessibleName('Pirate, bear, pirate, bear, pirate, bear, question mark');
    expect(row()).toHaveFocus();
    const names = within(screen.getByRole('group', { name: 'Pictures to choose from' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Bear', 'Lollipop', 'Pirate']);
    for (const name of names) expect(name).not.toMatch(/right|correct/i);
  });

  test('wrong: red mark, gentle sad bear, retry; all choices stay tappable; right fills the "?"', () => {
    seen();
    openLogic();
    start();
    pick('Bear');
    expect(choice('Bear')).toHaveAttribute('data-state', 'incorrect');
    expect(feedback()).toHaveTextContent('Not this one. Try another picture.');
    expect(document.querySelector('.bear')).toHaveClass('bear-sad');
    for (const name of ['Bear', 'Lollipop', 'Pirate']) {
      expect(choice(name)).not.toBeDisabled();
      expect(choice(name)).not.toHaveAttribute('aria-disabled');
    }
    pick('Lollipop');
    expect(choice('Lollipop')).toHaveAttribute('data-state', 'incorrect');
    pick('Pirate');
    expect(choice('Pirate')).toHaveAttribute('data-state', 'correct');
    expect(feedback()).toHaveTextContent('Yes! That picture fits.');
    expect(document.querySelector('.bear')).toHaveClass('bear-happy');
    expect(row()).toHaveAccessibleName('Pirate, bear, pirate, bear, pirate, bear, pirate');
    expect(document.querySelector('.pattern-gap[data-filled]')).not.toBeNull();
    expect(exact('Next exercise')).toHaveFocus();
    expect(screen.getByText('Exercise 1 of 5')).toBeInTheDocument();
  });

  test('a double tap is one answer; taps after the right one do nothing', () => {
    seen();
    openLogic();
    start();
    pick('Bear');
    pick('Bear', 2); // the second click of a double tap
    pick('Pirate');
    pick('Bear'); // after right: nothing
    pick('Pirate');
    expect(choice('Bear')).toHaveAttribute('data-state', 'incorrect');
    expect(choice('Pirate')).toHaveAttribute('data-state', 'correct');
    expect(feedback()).toHaveTextContent('Yes! That picture fits.');
    // Next: the second click of a double tap on Next does not skip a row.
    fireEvent.click(exact('Next exercise'), { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: /^Show me$/ }), { detail: 2 });
    expect(screen.getByText('Exercise 2 of 5')).toBeInTheDocument();
    expect(demo()).toBeNull();
  });

  test('a wrong tap right before the right one (same batch) still solves the row', () => {
    seen();
    openLogic();
    start();
    act(() => {
      fireEvent.click(choice('Lollipop'), { detail: 1 });
      fireEvent.click(choice('Pirate'), { detail: 1 });
    });
    expect(choice('Pirate')).toHaveAttribute('data-state', 'correct');
    expect(exact('Next exercise')).toBeInTheDocument();
  });

  test('first try, review round and summary: 4 of 5 on the first try', () => {
    seen();
    openLogic();
    start();
    pick('Bear');
    pick('Pirate');
    for (let i = 1; i < 5; i++) {
      tap('Next exercise');
      pick('Pirate');
    }
    tap('Review tricky ones');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Let’s try these rows again',
    );
    pick('Pirate');
    tap('See how you did');
    const summary = document.querySelector<HTMLElement>('.summary')!;
    expect(summary).toHaveTextContent('4');
    expect(summary).toHaveTextContent('5');
  });

  test('Level 5: counted names ("4 bears") and arrow names; Slovak counted nouns', () => {
    seen();
    rows = (level) => (level === 5 ? ROW5 : ROW3);
    openLogic();
    start(5);
    expect(row()).toHaveAccessibleName('2 bears, 3 bears, 4 bears, question mark');
    expect(choice('6 bears')).toBeInTheDocument();
    back();
    rows = () => ARROWS;
    start(5);
    expect(row()).toHaveAccessibleName(
      'Arrow pointing up, arrow pointing right, arrow pointing down, question mark',
    );
    expect(choice('Arrow pointing left')).toBeInTheDocument();
  });

  test('Slovak texts: row, choices, feedback', () => {
    seen();
    rows = () => ROW5;
    openLogic('sk');
    start(5, 'sk');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Ktorý obrázok príde ďalej?',
    );
    expect(row()).toHaveAccessibleName('2 medvede, 3 medvede, 4 medvede, otáznik');
    pick('6 medveďov');
    expect(feedback()).toHaveTextContent('Tento nie. Skús iný obrázok.');
    pick('5 medveďov');
    expect(feedback()).toHaveTextContent('Áno! Tento obrázok pasuje.');
    expect(row()).toHaveAccessibleName('2 medvede, 3 medvede, 4 medvede, 5 medveďov');
  });
});

describe('demo once per device (shared helper, own key)', () => {
  test('fresh device: the demo plays on the first pattern lesson, then never again (any level)', () => {
    openLogic();
    start(4);
    expect(demo()).not.toBeNull();
    expect(screen.getByRole('img', { name: /^Demo: a finger taps/ })).toBeInTheDocument();
    expect(row()).toBeNull();
    wait(PATTERN_DEMO_MS - 10);
    expect(localStorage.getItem('bearmatics-pattern-demo-seen')).toBeNull();
    wait(20);
    expect(demo()).toBeNull();
    expect(row()).toHaveFocus();
    expect(localStorage.getItem('bearmatics-pattern-demo-seen')).toBe('1');
    // The bear demo keeps its own flag.
    expect(localStorage.getItem('bearmatics-logic-demo-seen')).toBeNull();
    back();
    start(3);
    expect(demo()).toBeNull();
    back();
    start(5);
    expect(demo()).toBeNull();
  });

  test('leaving mid-demo is not "seen"', () => {
    openLogic();
    start();
    wait(PATTERN_DEMO_MS - 200);
    back();
    wait(PATTERN_DEMO_MS);
    expect(localStorage.getItem('bearmatics-pattern-demo-seen')).toBeNull();
    start();
    expect(demo()).not.toBeNull();
  });

  test('the bear demo flag does not skip the pattern demo, and the other way round', () => {
    localStorage.setItem('bearmatics-logic-demo-seen', '1');
    openLogic();
    start(3);
    expect(demo()).not.toBeNull();
    wait(PATTERN_DEMO_MS + 10);
    back();
    localStorage.removeItem('bearmatics-logic-demo-seen');
    fireEvent.click(screen.getByRole('radio', { name: /^Level 1 ·/ }));
    tap('Let’s plan');
    expect(document.querySelector('.logic-demo')).not.toBeNull();
  });

  test('Show me replays the demo any time; choices are hidden meanwhile', () => {
    seen();
    openLogic();
    start();
    expect(demo()).toBeNull();
    tap('Show me');
    expect(demo()).not.toBeNull();
    expect(document.querySelector('.pattern-choice')).toHaveAttribute('aria-disabled', 'true');
    pick('Pirate'); // no answer during the demo
    expect(exact('Show me')).toHaveAttribute('aria-disabled', 'true');
    wait(PATTERN_DEMO_MS + 10);
    expect(demo()).toBeNull();
    expect(feedback()).toHaveTextContent('');
    pick('Pirate');
    expect(feedback()).toHaveTextContent('Yes! That picture fits.');
  });

  test('blocked storage: the demo plays at every lesson', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    });
    openLogic();
    start();
    expect(demo()).not.toBeNull();
    wait(PATTERN_DEMO_MS + 10);
    expect(row()).not.toBeNull();
    back();
    start();
    expect(demo()).not.toBeNull();
  });

  test('reduced motion: three still steps, longer; the right picture appears in place without moving', () => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query.includes('reduce'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
        }) as unknown as MediaQueryList,
    );
    openLogic();
    start();
    expect(document.querySelectorAll('.pattern-demo-still .pattern-demo-frame')).toHaveLength(3);
    wait(PATTERN_DEMO_MS + 10);
    expect(demo()).not.toBeNull();
    wait(PATTERN_STILL_DEMO_MS - PATTERN_DEMO_MS);
    expect(demo()).toBeNull();
    pick('Pirate');
    expect(document.querySelector('.pattern-arrive')).not.toBeNull();
    expect(document.querySelector('.pattern-arrive[data-moving]')).toBeNull();
  });
});

describe('points', () => {
  test('Logic Levels 3-5 have no multiplier row (x1)', () => {
    for (const level of [3, 4, 5])
      for (let play = 1; play <= 8; play++) expect(multiplierFor('logic', level, play)).toBe(1);
  });

  test('signed in: a pattern lesson saves its first-try points like other lessons', async () => {
    vi.useRealTimers();
    let total = 3;
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
    seen();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Leaderboard/ })).toBeInTheDocument(),
    );
    fireEvent.click(exact('Logic'));
    start(4);
    for (let i = 0; i < 5; i++) {
      if (i === 2) pick('Bear');
      pick('Pirate');
      tap(i < 4 ? 'Next exercise' : 'Review tricky ones');
    }
    pick('Pirate');
    tap('See how you did');
    await waitFor(() =>
      expect(
        calls.find((call) => call.path === '/api/progress/lessons/finish')?.body,
      ).toMatchObject({ size: 5, points: 4 }),
    );
    const summary = document.querySelector<HTMLElement>('.summary')!;
    await waitFor(() => expect(within(summary).getByText('+4 points')).toBeInTheDocument());
    expect(summary.querySelector('.points-multiplied')).toBeNull();
  });
});
