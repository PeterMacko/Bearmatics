import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { aboutCopy } from '../about/aboutCopy';
import { copy } from '../i18n';
import { LEVEL_AGES } from '../levelAges';
import * as math from '../math/engine';
import SummaryPoints from '../progress/SummaryPoints';
import { staticFrame } from '../progress/animation';
import { fakeServer, reply } from '../testing/fakeServer';
import { BEAR_PICKS_KEY } from './storage';

// SCRUM-309 "Bear picks a game": course-choice button, age screen, next-game screen, the mode
// chain through lesson and summary, storage, double-tap guards and copy.

let now = 1000;
beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());
/** Time passes beyond the 600 ms after a screen change. */
const settle = () => {
  now += 700;
};
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const tap = (name: string | RegExp) => fireEvent.click(button(name), { detail: 1 });
const heading = () => screen.getByRole('heading', { level: 2 });
const stored = () => JSON.parse(localStorage.getItem(BEAR_PICKS_KEY) ?? 'null');
/** The game on the next-game screen: "Maths|Level 4 · Find the missing number". */
const shownGame = () => {
  const card = document.querySelector('.pick-game')!;
  return `${card.querySelector('.pick-game-course')!.textContent}|${card.querySelector('.pick-game-level')!.textContent}`;
};
/** The shown game's age range from its screen-reader text ("Ages 5 to 7"). */
const shownAges = () => {
  const text = [...document.querySelectorAll('.pick-game .sr-only')]
    .map((e) => e.textContent)
    .find((x) => x?.startsWith('Ages'))!;
  const [, from, to] = /Ages (\d) to (\d)/.exec(text)!;
  return { from: Number(from), to: Number(to) };
};
const open = () => {
  tap('Bear picks a game');
  settle();
};
/** Choose another until a Maths game is shown (age 9 has four of them). */
const untilMaths = () => {
  for (let i = 0; i < 200 && !shownGame().startsWith('Maths|'); i++) {
    tap('Choose another');
    settle();
  }
  expect(shownGame()).toMatch(/^Maths\|/);
};

describe('course choice button', () => {
  it('sits above the course cards, describes the mode and opens the age screen first', () => {
    render(<App />);
    const pick = button('Bear picks a game');
    // No account known: no "points × 1.5" (only signed in).
    expect(pick).toHaveAccessibleDescription('Games for your age');
    const list = screen.getByRole('list', { name: 'Courses' });
    expect(pick.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The repeat click of a double tap (e.g. Stop on the screen before) does nothing.
    fireEvent.click(pick, { detail: 2 });
    expect(heading()).toHaveTextContent('What shall we learn today?');
    open();
    expect(heading()).toHaveTextContent('How old are you?');
    expect(heading()).toHaveFocus();
    const ages = screen.getByRole('group', { name: 'Your age' });
    expect(
      within(ages)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['5', '6', '7', '8', '9+']);
    expect(button('9 years or older')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('age screen and next-game screen', () => {
  it('remembers the age, preselects 5 the first time and shows a game for that age', () => {
    render(<App />);
    tap('Bear picks a game');
    // The rest of the tap that opened the screen (within 600 ms) is ignored.
    fireEvent.click(button('7 years'), { detail: 1 });
    expect(heading()).toHaveTextContent('How old are you?');
    settle();
    fireEvent.click(button('7 years'), { detail: 2 });
    expect(heading()).toHaveTextContent('How old are you?');
    tap('7 years');
    expect(heading()).toHaveTextContent('The bear picked this game');
    expect(heading()).toHaveFocus();
    expect(stored()).toEqual({ age: 7, size: 5 });
    expect(screen.getByRole('radio', { name: '5 exercises' })).toBeChecked();
    const { from, to } = shownAges();
    expect(from <= 7 && 7 <= to).toBe(true);
    expect(button('Change age (7)')).toBeInTheDocument();
    // Not signed in: no points, so neither the mode's x1.5 nor a table sign.
    expect(document.querySelector('.pick-tag-mode')).toBeNull();
    expect(document.querySelector('.pick-tag-table')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '20 exercises' }));
    expect(stored()).toEqual({ age: 7, size: 20 });
    settle();
    tap('Change age (7)');
    expect(heading()).toHaveTextContent('How old are you?');
    expect(button('7 years')).toHaveAttribute('aria-pressed', 'true');
    settle();
    tap('9 years or older');
    expect(stored()).toEqual({ age: 9, size: 20 });
    expect(shownAges().to).toBe(9);
    expect(button('Change age (9+)')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '20 exercises' })).toBeChecked();
  });

  it('opens straight on the next-game screen with the remembered age and count', () => {
    localStorage.setItem(BEAR_PICKS_KEY, JSON.stringify({ age: 6, size: 10 }));
    render(<App />);
    open();
    expect(heading()).toHaveTextContent('The bear picked this game');
    expect(screen.getByRole('radio', { name: '10 exercises' })).toBeChecked();
    expect(button('Change age (6)')).toBeInTheDocument();
  });

  it('broken stored data: no age, 5 exercises', () => {
    for (const bad of ['{nope', '{"age":4,"size":7}', '{"age":"7","size":"10"}', '[]', '7']) {
      localStorage.setItem(BEAR_PICKS_KEY, bad);
      const { unmount } = render(<App />);
      open();
      expect(heading(), bad).toHaveTextContent('How old are you?');
      tap('5 years');
      expect(screen.getByRole('radio', { name: '5 exercises' })).toBeChecked();
      unmount();
    }
  });

  it('blocked storage: asks the age each time the mode starts and starts at 5', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<App />);
    open();
    tap('8 years');
    fireEvent.click(screen.getByRole('radio', { name: '10 exercises' }));
    // Within the run the choices stay.
    settle();
    tap('Choose another');
    expect(screen.getByRole('radio', { name: '10 exercises' })).toBeChecked();
    settle();
    tap('Stop');
    expect(heading()).toHaveTextContent('What shall we learn today?');
    expect(heading()).toHaveFocus();
    settle();
    open();
    expect(heading()).toHaveTextContent('How old are you?');
    tap('8 years');
    expect(screen.getByRole('radio', { name: '5 exercises' })).toBeChecked();
  });

  it('Choose another always shows a different game, pressed again and again; a double tap picks once', () => {
    localStorage.setItem(BEAR_PICKS_KEY, JSON.stringify({ age: 9, size: 5 }));
    render(<App />);
    open();
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const before = shownGame();
      seen.add(before);
      tap('Choose another');
      expect(shownGame()).not.toBe(before);
      settle();
    }
    // Age 9 has 11 games: they all come up.
    expect(seen.size).toBe(LEVEL_AGES.filter((r) => r.to >= 9).length);
    const before = shownGame();
    fireEvent.click(button('Choose another'), { detail: 2 });
    expect(shownGame()).toBe(before);
    // QA321-04: Firefox touch reports a double tap as two detail-1 clicks: picks once.
    tap('Choose another');
    const once = shownGame();
    expect(once).not.toBe(before);
    now += 200;
    tap('Choose another');
    expect(shownGame()).toBe(once);
    // ...and a tap right after a new game cannot start it.
    tap('Play');
    expect(heading()).toHaveTextContent('The bear picked this game');
    // The game card is announced when it changes.
    expect(document.querySelector('.pick-game')).toHaveAttribute('aria-live', 'polite');
  });

  it('Back and Stop lead to the course choice', () => {
    localStorage.setItem(BEAR_PICKS_KEY, JSON.stringify({ age: 9, size: 5 }));
    render(<App />);
    open();
    tap('Back to courses');
    expect(heading()).toHaveTextContent('What shall we learn today?');
    expect(heading()).toHaveFocus();
    settle();
    open();
    tap('Stop');
    expect(heading()).toHaveTextContent('What shall we learn today?');
    localStorage.removeItem(BEAR_PICKS_KEY);
    settle();
    open();
    tap('Back to courses');
    expect(heading()).toHaveTextContent('What shall we learn today?');
  });
});

describe('the mode chain', () => {
  const fixture = Array(5).fill({ level: 1, operation: '+', values: [1, 2, 3], blank: 2 });
  /** Answers the five 1 + 2 = ? exercises to the summary. */
  const playToSummary = () => {
    for (let i = 0; i < 5; i++) {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
      tap('Check answer');
      tap(i < 4 ? 'Next exercise' : 'See how you did');
    }
  };

  it('Play starts the shown game with the chosen count; the summary offers Next game and Stop', () => {
    const generate = vi.spyOn(math, 'generateSession').mockReturnValue(fixture);
    localStorage.setItem(BEAR_PICKS_KEY, JSON.stringify({ age: 9, size: 5 }));
    render(<App />);
    open();
    untilMaths();
    fireEvent.click(screen.getByRole('radio', { name: '10 exercises' }));
    const played = shownGame();
    const level = Number(/Level (\d)/.exec(played)![1]);
    // A double tap on Play starts nothing extra; a quick tap right after the screen opened neither.
    tap('Play');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenLastCalledWith(level, 10);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    playToSummary();
    expect(button('Next game')).toBeInTheDocument();
    expect(button('Stop')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Choose level' })).toBeNull();
    // The summary's buttons keep the double-tap guard.
    fireEvent.click(button('Next game'), { detail: 2 });
    expect(button('Next game')).toBeInTheDocument();
    tap('Next game');
    expect(heading()).toHaveTextContent('The bear picked this game');
    expect(heading()).toHaveFocus();
    // Never the game just played; the count chosen last round is preselected.
    expect(shownGame()).not.toBe(played);
    expect(screen.getByRole('radio', { name: '10 exercises' })).toBeChecked();
    expect(stored()).toEqual({ age: 9, size: 10 });
    // The second tap of the Next game double tap lands on the new screen: ignored.
    fireEvent.click(button('Play'), { detail: 1 });
    fireEvent.click(button('Stop'), { detail: 1 });
    expect(heading()).toHaveTextContent('The bear picked this game');
    expect(generate).toHaveBeenCalledTimes(1);
    settle();
    fireEvent.click(button('Play'), { detail: 2 });
    expect(generate).toHaveBeenCalledTimes(1);
    untilMaths();
    tap('Play');
    expect(generate).toHaveBeenCalledTimes(2);
    playToSummary();
    tap('Stop');
    expect(heading()).toHaveTextContent('What shall we learn today?');
    expect(heading()).toHaveFocus();
  });

  it('QA321-01: the rest of a double tap on Stop opens no course card (next-game screen and summary)', () => {
    vi.spyOn(math, 'generateSession').mockReturnValue(fixture);
    localStorage.setItem(BEAR_PICKS_KEY, JSON.stringify({ age: 9, size: 5 }));
    render(<App />);
    const card = () => button(/^Maths/);
    open();
    tap('Stop');
    // Firefox touch: the second tap is another detail-1 click; Chromium: detail 2.
    fireEvent.click(card(), { detail: 1 });
    fireEvent.click(card(), { detail: 2 });
    fireEvent.click(button('Bear picks a game'), { detail: 1 });
    expect(heading()).toHaveTextContent('What shall we learn today?');
    // The keyboard is never held back; a later tap opens the card as usual.
    fireEvent.click(card(), { detail: 0 });
    expect(heading()).toHaveTextContent('Where shall we explore?');
    tap('Back to courses');
    settle();
    open();
    untilMaths();
    tap('Play');
    playToSummary();
    tap('Stop');
    fireEvent.click(card(), { detail: 1 });
    expect(heading()).toHaveTextContent('What shall we learn today?');
    settle();
    tap(/^Maths/);
    expect(heading()).toHaveTextContent('Where shall we explore?');
  });

  it('Next game never repeats the game just played (also with repeated rounds)', () => {
    vi.spyOn(math, 'generateSession').mockReturnValue(fixture);
    localStorage.setItem(BEAR_PICKS_KEY, JSON.stringify({ age: 9, size: 5 }));
    render(<App />);
    open();
    for (let round = 0; round < 4; round++) {
      untilMaths();
      const played = shownGame();
      tap('Play');
      playToSummary();
      tap('Next game');
      expect(shownGame()).not.toBe(played);
      settle();
    }
  });

  it('leaving a lesson early ends the mode at the course choice; normal menus keep their count', () => {
    vi.spyOn(math, 'generateSession').mockReturnValue(fixture);
    localStorage.setItem(BEAR_PICKS_KEY, JSON.stringify({ age: 9, size: 20 }));
    render(<App />);
    open();
    untilMaths();
    tap('Play');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
    tap('Check answer');
    // Progress: the leave question as usual (the bar's Back leads to the courses in the mode).
    tap('Back to courses');
    tap('Choose a new trail');
    expect(heading()).toHaveTextContent('What shall we learn today?');
    // QA321-06: the rest of a double tap on "Choose a new trail" opens no course card.
    fireEvent.click(button(/^Maths/), { detail: 1 });
    expect(heading()).toHaveTextContent('What shall we learn today?');
    settle();
    // The Maths menu still has its own count (10), untouched by the mode's 20.
    tap('Maths');
    expect(screen.getByRole('radio', { name: '10 exercises' })).toBeChecked();
  });
});

describe('signed out vs signed in (Peter: no x1.5 without points)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const account = {
    kind: 'password',
    username: 'kid',
    nickname: 'Kid',
    look: { fur: 0, background: 0, head: 3, neck: 0, eyes: 0 },
    email: null,
  };
  const serve = (signedIn: boolean) =>
    fakeServer(({ path }) => {
      if (path === '/api/me') return reply({ account: signedIn ? account : null });
      if (path === '/api/auth/google') return reply({ available: false });
      if (path === '/api/progress') return reply({ points: 0 });
      return reply({ error: 'not_found' }, 404);
    });
  const note = 'Sign in to collect points and compare with other players.';

  it('signed out: the sign-in note under the course heading and on the next-game screen, no x1.5', async () => {
    serve(false);
    localStorage.setItem(BEAR_PICKS_KEY, JSON.stringify({ age: 7, size: 5 }));
    render(<App />);
    expect(await screen.findByText(note)).toHaveClass('intro');
    expect(screen.queryByText('Pick a course to start.')).toBeNull();
    expect(button('Bear picks a game')).toHaveAccessibleDescription('Games for your age');
    open();
    expect(document.querySelector('.pick-note')).toHaveTextContent(note);
    // Above the exercise count.
    const count = screen.getByRole('group', { name: 'How many exercises?' });
    expect(
      document.querySelector('.pick-note')!.compareDocumentPosition(count) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(document.querySelector('.pick-tag-mode')).toBeNull();
    expect(document.querySelector('.pick-game')).not.toHaveTextContent('one and a half');
  });

  it('signed in: the course intro and the x1.5 stay as before, no note', async () => {
    serve(true);
    localStorage.setItem(BEAR_PICKS_KEY, JSON.stringify({ age: 7, size: 5 }));
    render(<App />);
    expect(
      await screen.findByRole('button', { name: /^Bear badge|^No bear badge/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pick a course to start.')).toBeInTheDocument();
    expect(screen.queryByText(note)).toBeNull();
    expect(button('Bear picks a game')).toHaveAccessibleDescription(
      'Games for your age, points × 1.5',
    );
    open();
    expect(document.querySelector('.pick-tag-mode')).toHaveTextContent('× 1.5');
    expect(document.querySelector('.pick-game')).toHaveTextContent(
      'Bear picks a game: one and a half times the points',
    );
    expect(document.querySelector('.pick-note')).toBeNull();
  });

  it('Slovak note', async () => {
    serve(false);
    render(<App />);
    await screen.findByText(note);
    tap('Settings');
    tap('Slovenčina');
    tap('Zavrieť nastavenia');
    expect(
      await screen.findByText('Prihlás sa, zbieraj body a porovnaj sa s ostatnými hráčmi.'),
    ).toBeInTheDocument();
    expect(button('Medveď vyberie hru')).toHaveAccessibleDescription('Hry pre tvoj vek');
  });
});

describe('summary points line (signed in)', () => {
  const t = copy.en.points;
  const show = (multiplier: 1 | 0.5 | 1.5, added: number, language: 'en' | 'sk' = 'en') =>
    render(
      <SummaryPoints
        t={copy[language].points}
        save={{
          state: 'saved',
          added,
          before: 0,
          after: added,
          firstTry: 10,
          multiplier,
          bearPicks: true,
        }}
        frame={staticFrame(added)}
        newBadge={0}
        onRetry={() => {}}
      />,
    );
  it('shows the mode x1.5 on its own line and in the calculation next to the table sign', () => {
    show(0.5, 8);
    expect(screen.getByText('Bear picks a game × 1.5')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Half points, Bear picks a game × 1.5: 10 × 1/2 × 1.5 = 8 points',
    );
  });
  it('at table x1 only the x1.5; Slovak', () => {
    show(1, 15);
    expect(screen.getByRole('status')).toHaveTextContent('10 × 1.5 = 15 points');
    act(() => {});
    show(1.5, 23, 'sk');
    expect(screen.getAllByRole('status').at(-1)).toHaveTextContent(
      'Jeden a pol násobok bodov, Medveď vyberie hru × 1,5: 10 × 1,5 × 1,5 = 23 bodov',
    );
    expect(t.bearPicksFactor).toBe('1.5');
  });
});

describe('copy', () => {
  it('SK and EN have the same new texts, none empty', () => {
    const shape = (o: unknown): unknown =>
      o && typeof o === 'object'
        ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)]))
        : typeof o;
    expect(shape(copy.sk.bearPicks)).toEqual(shape(copy.en.bearPicks));
    const strings = (o: object): string[] =>
      Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : strings(v)));
    for (const lang of ['en', 'sk'] as const) {
      for (const s of strings(copy[lang].bearPicks)) expect(s.trim()).not.toBe('');
      expect(copy[lang].points.bearPicks).toMatch(/\S/);
      expect(copy[lang].points.bearPicksFactor).toMatch(/^1[.,]5$/);
    }
    expect(copy.sk.bearPicks.button).toBe('Medveď vyberie hru');
    // The privacy list names the device-only entry (age and last count), SK and EN.
    expect(copy.en.account.privacy.filter((l) => l.includes('Bear picks a game'))).toHaveLength(1);
    expect(copy.sk.account.privacy.filter((l) => l.includes('Medveď vyberie hru'))).toHaveLength(1);
    expect(copy.en.account.privacy.length).toBe(copy.sk.account.privacy.length);
    // About page: the mode in "How a lesson works", right after the suggested ages; its picture.
    expect(aboutCopy.en.lesson[2]).toMatch(/^Or let the bear choose: “Bear picks a game”/);
    expect(aboutCopy.sk.lesson[2]).toMatch(/^Alebo nech vyberie medveď: „Medveď vyberie hru“/);
    expect(aboutCopy.en.shots['bear-picks'].caption).toBe('Bear picks a game');
    expect(aboutCopy.sk.shots['bear-picks'].caption).toBe('Medveď vyberie hru');
    expect(copy.en.bearPicks.button).toBe('Bear picks a game');
  });
});
