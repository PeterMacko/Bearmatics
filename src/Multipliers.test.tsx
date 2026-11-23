import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';
import { fakeServer, reply } from './testing/fakeServer';
import { playFive } from './testing/lesson';
import { openMathematics } from './testing/openMathematics';
import { PLAYS_KEY, deviceSlovakDay } from './progress/playCounts';

// SCRUM-202: daily points multipliers in the app: menu signs and the summary calculation.

const ACCOUNT = {
  kind: 'password',
  username: 'kid',
  nickname: 'Kid',
  look: { fur: 0, background: 0, head: 3, neck: 0, eyes: 0 },
  email: null,
};

function server(signedIn = true) {
  let total = 20;
  return fakeServer(({ path, body }) => {
    if (path === '/api/me') return reply({ account: signedIn ? ACCOUNT : null });
    if (path === '/api/auth/google') return reply({ available: false });
    if (path === '/api/progress')
      return reply({ points: total, streak: 0, frozen: false, today: false });
    if (path === '/api/progress/lessons') return reply({ lessonId: 'a'.repeat(32) }, 201);
    if (path === '/api/progress/lessons/finish') {
      const added = (body as { points: number }).points;
      total += added;
      return reply({ points: total, streak: 1, frozen: false, today: true, added, offer: null });
    }
    return reply({ error: 'not_found' }, 404);
  });
}

/** Today's plays already saved on this device (Maths, levels as shown). */
const played = (counts: Record<string, number>) =>
  localStorage.setItem(
    PLAYS_KEY,
    JSON.stringify({ 'password:kid': { day: deviceSlovakDay(Date.now()), counts } }),
  );

const toSlovak = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zavrieť nastavenia' }));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('the level menu shows the next play: star on Maths 4-7, 1/2 and 1/4, nothing at x1', async () => {
  played({ 'math:1': 2, 'math:2': 4, 'math:3': 1 });
  server();
  render(<App />);
  await screen.findByRole('button', { name: 'No bear badge yet, 20 points' });
  openMathematics();
  const level = (n: number) => screen.getByRole('radio', { name: new RegExp(`^Level ${n} `) });
  expect(level(1)).toHaveAccessibleName(/Next play: half points$/);
  expect(level(2)).toHaveAccessibleName(/Next play: a quarter of the points$/);
  for (const n of [4, 5, 6, 7])
    expect(level(n)).toHaveAccessibleName(/Next play: one and a half times the points$/);
  expect(level(3)).not.toHaveAccessibleName(/Next play/);
  const signs = [...document.querySelectorAll('.next-play')].map((s) => [
    s.closest('label')!.className,
    s.textContent,
  ]);
  expect(signs).toEqual([
    ['level-option level-1', '1/2'],
    ['level-option level-2', '1/4'],
    ['level-option level-4', '★'],
    ['level-option level-5', '★'],
    ['level-option level-6', '★'],
    ['level-option level-7', '★'],
  ]);
  toSlovak();
  expect(screen.getByRole('radio', { name: /^Úroveň 1 / })).toHaveAccessibleName(
    /Ďalšia hra: polovica bodov$/,
  );
  expect(screen.getByRole('radio', { name: /^Úroveň 2 / })).toHaveAccessibleName(
    /Ďalšia hra: štvrtina bodov$/,
  );
  expect(screen.getByRole('radio', { name: /^Úroveň 7 / })).toHaveAccessibleName(
    /Ďalšia hra: jeden a pol násobok bodov$/,
  );
});

test('signed out: no signs, no counts, no points', async () => {
  played({ 'math:1': 4 });
  const calls = server(false);
  render(<App />);
  await act(async () => {});
  openMathematics();
  expect(document.querySelector('.next-play')).toBeNull();
  expect(screen.getByRole('radio', { name: /^Level 7 / })).not.toHaveAccessibleName(/Next play/);
  fireEvent.click(screen.getByRole('button', { name: 'Back to courses' }));
  await playFive();
  expect(calls.filter((c) => c.path.startsWith('/api/progress'))).toEqual([]);
  expect(JSON.parse(localStorage.getItem(PLAYS_KEY)!)['password:kid'].counts).toEqual({
    'math:1': 4,
  });
});

test('the summary shows the calculation (EN and SK) and the menu sign moves on', async () => {
  played({ 'math:1': 2 });
  const calls = server();
  render(<App />);
  await screen.findByRole('button', { name: 'No bear badge yet, 20 points' });
  await playFive();
  const line = await screen.findByText(/5 × 1\/2 = 3 points/);
  expect(line).toHaveTextContent('Half points: 5 × 1/2 = 3 points');
  expect(line).toHaveAttribute('role', 'status');
  expect(screen.queryByText('+3 points')).toBeNull();
  const finish = calls.find((c) => c.path === '/api/progress/lessons/finish');
  expect(finish?.body).toMatchObject({ size: 5, points: 3 });
  toSlovak();
  expect(screen.getByText(/5 × 1\/2 = 3 body/)).toHaveTextContent(
    'Polovica bodov: 5 × 1/2 = 3 body',
  );
  // Third play saved: the fourth is still half points.
  fireEvent.click(screen.getByText('Vybrať úroveň', { selector: '.secondary' }), { detail: 1 });
  expect(screen.getByRole('radio', { name: /^Úroveň 1 / })).toHaveAccessibleName(
    /Ďalšia hra: polovica bodov$/,
  );
});
