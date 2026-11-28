import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';
import { copy } from './i18n';
import { LEVEL_AGES } from './levelAges';
import { PLAYS_KEY, deviceSlovakDay } from './progress/playCounts';
import { fakeServer, reply } from './testing/fakeServer';

// SCRUM-308: every level row of the five level menus shows its suggested age (aria-hidden badge
// "5–7") and the screen-reader text "Ages 5 to 7" / "Vek 5 až 7 rokov" next to the title.

const COURSES = ['small', 'math', 'logic', 'english', 'wordsearch'] as const;
/** Radio values (engine levels, Small maths 0/8/9) and names as before SCRUM-308. */
const ENGINE: Partial<Record<string, Record<number, number>>> = { small: { 1: 0, 2: 8, 3: 9 } };
const RADIO_NAME: Record<string, string> = {
  small: 'level',
  math: 'level',
  logic: 'logic-level',
  english: 'english-level',
  wordsearch: 'search-level',
};

const ACCOUNT = {
  kind: 'password',
  username: 'kid',
  nickname: 'Kid',
  look: { fur: 0, background: 0, head: 3, neck: 0, eyes: 0 },
  email: null,
};
const server = (signedIn: boolean) =>
  fakeServer(({ path }) => {
    if (path === '/api/me') return reply({ account: signedIn ? ACCOUNT : null });
    if (path === '/api/auth/google') return reply({ available: false });
    if (path === '/api/progress')
      return reply({ points: 20, streak: 0, frozen: false, today: false });
    return reply({ error: 'not_found' }, 404);
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const open = (course: string) =>
  fireEvent.click(document.querySelector<HTMLElement>(`.course-option.course-${course}`)!);
const back = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));

/** Each row of the open menu: class, visible badge, its aria-hidden, the radio's name. */
const rows = () =>
  [...document.querySelectorAll('section.selection .level-option')].map((row) => {
    const badge = row.querySelector('.level-age');
    return {
      shown: Number(row.querySelector('.level-number')!.firstChild!.textContent),
      badge: badge?.textContent ?? null,
      hidden: badge?.getAttribute('aria-hidden') ?? null,
      name: row.querySelector('input')!,
    };
  });

for (const language of ['en', 'sk'] as const)
  test(`all 24 level rows (SCRUM-324: + Logic 6-8) show their age badge and screen-reader text (${language})`, async () => {
    server(false);
    render(<App />);
    await act(async () => {});
    const t = copy[language];
    if (language === 'sk') {
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
      fireEvent.click(screen.getByRole('button', { name: 'Zavrieť nastavenia' }));
    }
    let seen = 0;
    for (const course of COURSES) {
      open(course);
      const menu = rows();
      const table = LEVEL_AGES.filter((r) => r.course === course);
      expect(menu.map((r) => r.shown)).toEqual(table.map((r) => r.shown));
      for (const row of menu) {
        const { from, to } = table.find((r) => r.shown === row.shown)!;
        expect(row.badge).toBe(`${from}–${to}`);
        expect(row.hidden).toBe('true');
        const said = language === 'en' ? `Ages ${from} to ${to}` : `Vek ${from} až ${to} rokov`;
        // After the title (and detail), with no other words around it. jsdom joins the block
        // spans without the space a browser adds (the e2e spec checks the spaced name).
        expect(row.name).toHaveAccessibleName(
          new RegExp(`^${t.level} ${row.shown} · .*[^ ] ?${said}$`),
        );
        // The age is not in the radio's value or name attribute.
        expect(row.name.value).toBe(String(ENGINE[course]?.[row.shown] ?? row.shown));
        expect(row.name.name).toBe(RADIO_NAME[course]);
        seen++;
      }
      back(t.backToCourses);
    }
    expect(seen).toBe(24);
  });

test('with the age badge the multiplier signs, their screen-reader text and level choice are unchanged', async () => {
  localStorage.setItem(
    PLAYS_KEY,
    JSON.stringify({
      'password:kid': {
        day: deviceSlovakDay(Date.now()),
        counts: { 'math:1': 2, 'math:2': 4 },
      },
    }),
  );
  server(true);
  render(<App />);
  await screen.findByRole('button', { name: 'No bear badge yet, 20 points' });
  open('math');
  // The number tile holds only the shown number and the sign (the badge sits outside it).
  expect([...document.querySelectorAll('.level-number')].map((n) => n.textContent)).toEqual([
    '11/2',
    '21/4',
    '3',
    '4★',
    '5★',
    '6★',
    '7★',
  ]);
  const signs = [...document.querySelectorAll('.next-play')].map((s) => [
    s.className,
    s.getAttribute('data-next-play'),
  ]);
  expect(signs).toEqual([
    ['next-play next-play-half', '0.5'],
    ['next-play next-play-quarter', '0.25'],
    ['next-play next-play-bonus', '1.5'],
    ['next-play next-play-bonus', '1.5'],
    ['next-play next-play-bonus', '1.5'],
    ['next-play next-play-bonus', '1.5'],
  ]);
  const radio = (n: number) => screen.getByRole('radio', { name: new RegExp(`^Level ${n} `) });
  // Exact names (jsdom joins the spans without spaces): age text, then the multiplier text.
  const d = copy.en.details;
  expect(radio(1)).toHaveAccessibleName(
    `Level 1 · Hello, addition!${d[1]}Ages 6 to 7Next play: half points`,
  );
  expect(radio(2)).toHaveAccessibleName(
    `Level 2 · First steps${d[2]}Ages 6 to 8Next play: a quarter of the points`,
  );
  expect(radio(3)).toHaveAccessibleName(`Level 3 · Find the result${d[3]}Ages 7 to 8`);
  expect(radio(4)).toHaveAccessibleName(
    `Level 4 · Find the missing number${d[4]}Ages 7 to 9Next play: one and a half times the points`,
  );
  // Radios keep their value and name; choosing a level works as before.
  expect(
    screen
      .getAllByRole('radio', { name: /^Level / })
      .map((r) => [(r as HTMLInputElement).name, (r as HTMLInputElement).value]),
  ).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => ['level', String(n)]));
  fireEvent.click(radio(4));
  expect(radio(4)).toBeChecked();
  expect(radio(1)).not.toBeChecked();
});
