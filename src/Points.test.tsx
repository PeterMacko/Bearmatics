import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';
import { openMathematics } from './testing/openMathematics';
import { fakeServer, reply } from './testing/fakeServer';
import { playFive } from './testing/lesson';
import { tap } from './testing/ui';

// SCRUM-117: points for finished lessons of signed-in players, badge in the bar and summary.

const ACCOUNT = {
  kind: 'password',
  username: 'kid',
  nickname: 'Kid',
  look: { fur: 0, background: 0, head: 3, neck: 0, eyes: 0 },
  email: null,
};

function server(
  start: number,
  options: {
    failFinish?: number;
    loseAnswer?: number;
    meDelay?: number;
    finishDelay?: number;
  } = {},
) {
  let total = start;
  let failures = options.failFinish ?? 0;
  let lost = options.loseAnswer ?? 0;
  const counted = new Set<string>();
  return fakeServer(({ path, body }) => {
    if (path === '/api/me')
      return new Promise((done) =>
        setTimeout(() => done(reply({ account: ACCOUNT })), options.meDelay ?? 0),
      );
    if (path === '/api/auth/google') return reply({ available: false });
    if (path === '/api/progress') return reply({ points: total });
    if (path === '/api/progress/lessons') return reply({ lessonId: 'a'.repeat(32) }, 201);
    if (path === '/api/progress/lessons/finish') {
      if (failures > 0) {
        failures--;
        return Promise.reject(new TypeError('offline'));
      }
      const { points: earned, lessonId } = body as { points: number; lessonId: string };
      const added = counted.has(lessonId) ? 0 : earned;
      counted.add(lessonId);
      total += added;
      if (lost > 0) {
        lost--;
        return Promise.reject(new TypeError('answer lost'));
      }
      const answer = reply({ points: total, added });
      return options.finishDelay
        ? new Promise((done) => setTimeout(() => done(answer), options.finishDelay))
        : answer;
    }
    return reply({ error: 'not_found' }, 404);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('signed out: no points calls, the summary only invites to sign in', async () => {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      calls.push(path);
      return Promise.resolve(
        new Response(JSON.stringify(path === '/api/me' ? { account: null } : {}), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    }),
  );
  render(<App />);
  await act(async () => {});
  await playFive();
  expect(screen.getByText('Sign in to collect points')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /bear badge/i })).toBeNull();
  expect(calls.filter((p) => p.startsWith('/api/progress'))).toEqual([]);
});

test('signed in: first-try points are saved once, the badge moves up and is announced', async () => {
  const calls = server(28);
  render(<App />);
  const nav = await screen.findByRole('navigation', { name: 'Main controls' });
  expect(
    await within(nav).findByRole('button', { name: 'No bear badge yet, 28 points' }),
  ).toBeInTheDocument();
  await playFive(1);
  // 4 of 5 on the first try (one mistake, fixed in review).
  expect(await screen.findByText('+4 points')).toBeInTheDocument();
  // The bar fills 28 -> 30, the level changes, then 30 -> 32 fills the next bar from zero.
  expect(
    await screen.findByRole('status', { name: 'New bear badge 1!' }, { timeout: 4000 }),
  ).toBeInTheDocument();
  expect(await screen.findByText('30 points to go to bear badge 2', {}, { timeout: 4000 }));
  expect(within(nav).getByRole('button', { name: 'Bear badge 1, 32 points' })).toBeInTheDocument();
  const finishes = calls.filter((c) => c.path === '/api/progress/lessons/finish');
  expect(finishes).toHaveLength(1);
  expect(finishes[0].body).toEqual({ lessonId: 'a'.repeat(32), size: 5, points: 4 });
  expect(calls.find((c) => c.path === '/api/progress/lessons')?.body).toEqual({ size: 5 });
});

test('leaving a lesson early saves nothing', async () => {
  const calls = server(10);
  render(<App />);
  await screen.findByRole('button', { name: 'No bear badge yet, 10 points' });
  openMathematics();
  tap('Let’s count');
  tap('Choose level');
  await act(async () => {});
  expect(calls.filter((c) => c.path === '/api/progress/lessons/finish')).toEqual([]);
});

test('a failed save says so and Try again saves the same lesson', async () => {
  const calls = server(0, { failFinish: 1 });
  render(<App />);
  await screen.findByRole('button', { name: 'No bear badge yet, 0 points' });
  await playFive();
  expect(await screen.findByText('Points could not be saved.')).toBeInTheDocument();
  tap('Try again');
  expect(await screen.findByText('+5 points')).toBeInTheDocument();
  const ids = calls
    .filter((c) => c.path === '/api/progress/lessons/finish')
    .map((c) => (c.body as { lessonId: string }).lessonId);
  expect(new Set(ids).size).toBe(1);
});

test('the badge opens a details panel with points to the next badge (Slovak too)', async () => {
  server(112);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Bear badge 3, 112 points' }));
  const dialog = screen.getByRole('dialog', { name: 'Your bear badge' });
  expect(within(dialog).getByText('Bear badge 3')).toBeInTheDocument();
  expect(within(dialog).getByText('112 points')).toBeInTheDocument();
  expect(within(dialog).getByText('18 points to go to bear badge 4')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close badge details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zavrieť nastavenia' }));
  fireEvent.click(screen.getByRole('button', { name: 'Medvedí odznak 3, 112 bodov' }));
  const sk = screen.getByRole('dialog', { name: 'Tvoj medvedí odznak' });
  expect(within(sk).getByText('Ešte 18 bodov do medvedieho odznaku 4')).toBeInTheDocument();
  await waitFor(() => expect(within(sk).getByText('112 bodov')).toBeInTheDocument());
});

test('QA124-01: a lesson started before the account has loaded still collects its points', async () => {
  const calls = server(10, { meDelay: 300 });
  render(<App />);
  await playFive();
  expect(await screen.findByText('+5 points', {}, { timeout: 3000 })).toBeInTheDocument();
  expect(calls.find((c) => c.path === '/api/progress/lessons')?.body).toEqual({ size: 5 });
  expect(screen.queryByText('Sign in to collect points')).toBeNull();
});

test('QA124-02: Try again after a lost answer shows what the lesson gave', async () => {
  server(10, { loseAnswer: 1 });
  render(<App />);
  await screen.findByRole('button', { name: 'No bear badge yet, 10 points' });
  await playFive(1);
  expect(await screen.findByText('Points could not be saved.')).toBeInTheDocument();
  tap('Try again');
  expect(await screen.findByText('+4 points')).toBeInTheDocument();
  expect(
    await screen.findByRole('button', { name: 'No bear badge yet, 14 points' }),
  ).toBeInTheDocument();
});

test('QA124-03: leaving the summary before a slow save still updates the bar', async () => {
  server(10, { finishDelay: 400 });
  render(<App />);
  await screen.findByRole('button', { name: 'No bear badge yet, 10 points' });
  await playFive();
  fireEvent.click(screen.getByText('Choose level', { selector: '.secondary' }));
  expect(
    await screen.findByRole('button', { name: 'No bear badge yet, 15 points' }, { timeout: 3000 }),
  ).toBeInTheDocument();
});
