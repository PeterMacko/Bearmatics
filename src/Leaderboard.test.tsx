import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';
import { fakeServer, reply } from './testing/fakeServer';

// SCRUM-148: two bar buttons, the leaderboard window and the profile switch.

const ACCOUNT = {
  kind: 'password',
  username: 'kid',
  nickname: 'Mia',
  bear: 1,
  email: null,
  leaderboard: true,
};
const row = (place: number, nickname: string, points: number, extra = {}) => ({
  place,
  nickname,
  bear: 2,
  points,
  streak: 3,
  frozen: false,
  me: false,
  ...extra,
});

function server(options: { failBoard?: number; account?: typeof ACCOUNT } = {}) {
  let fails = options.failBoard ?? 0;
  let account = { ...(options.account ?? ACCOUNT) };
  return fakeServer(({ path, method, body }) => {
    if (path === '/api/me' && method === 'PATCH') {
      account = { ...account, ...(body as object) };
      return reply({ account });
    }
    if (path === '/api/me') return reply({ account });
    if (path === '/api/auth/google') return reply({ available: false });
    if (path === '/api/progress')
      return reply({ points: 112, streak: 4, frozen: false, today: true });
    if (path === '/api/leaderboard') {
      if (fails > 0) {
        fails--;
        return Promise.reject(new TypeError('offline'));
      }
      return reply({
        rows: [
          ...Array.from({ length: 10 }, (_, i) => row(i + 1, `P${i + 1}`, 500 - i * 10)),
          row(13, 'Before', 120),
          row(14, 'Mia', 112, { me: true, frozen: true }),
          row(15, 'After', 100),
        ],
        gapBefore: 10,
      });
    }
    return reply({ error: 'not_found' }, 404);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('badge opens the badge details; points + bar open the leaderboard with my row', async () => {
  server();
  render(<App />);
  const nav = await screen.findByRole('navigation', { name: 'Main controls' });
  fireEvent.click(await within(nav).findByRole('button', { name: 'Bear badge 3, 112 points' }));
  expect(screen.getByRole('dialog', { name: 'Your bear badge' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close badge details' }));
  fireEvent.click(within(nav).getByRole('button', { name: 'Leaderboard, 112 points' }));
  const dialog = screen.getByRole('dialog', { name: 'Leaderboard' });
  const table = await within(dialog).findByRole('table', { name: 'Leaderboard' });
  const rows = within(table).getAllByRole('row');
  // Header, 10 top rows, the gap, before, me, after.
  expect(rows).toHaveLength(15);
  expect(within(rows[11]).getByText('More players')).toBeInTheDocument();
  const me = rows[13];
  expect(me).toHaveAttribute('aria-current', 'true');
  expect(within(me).getByText('Mia')).toBeInTheDocument();
  expect(within(me).getByLabelText('Place 14')).toBeInTheDocument();
  expect(within(me).getByLabelText('Streak 3 days, frozen')).toBeInTheDocument();
  // Accessible names (narrow windows show "#" for Place, hidden from screen readers).
  for (const name of ['Place', 'Player', 'Streak', 'Points'])
    expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument();
  expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(within(nav).getByRole('button', { name: 'Leaderboard, 112 points' })).toHaveFocus();
});

test('offline: says so and Try again loads it', async () => {
  server({ failBoard: 1 });
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Leaderboard, 112 points' }));
  const dialog = screen.getByRole('dialog', { name: 'Leaderboard' });
  expect(
    await within(dialog).findByText('The leaderboard could not be loaded.'),
  ).toBeInTheDocument();
  const retry = within(dialog).getByRole('button', { name: 'Try again' });
  retry.focus();
  await act(async () => {
    fireEvent.click(retry);
  });
  expect(await within(dialog).findByRole('table')).toBeInTheDocument();
  // QA154-01: focus stays in the window, so Escape still closes it.
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  // QA154-07: Tab from the box goes to a dialog button, not out of the dialog.
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
  expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: /Close/ }));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('profile switch turns the leaderboard off at once; hidden note in the window', async () => {
  const calls = server();
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Your profile: Mia' }));
  const box = await screen.findByRole('checkbox', { name: 'Show me on the leaderboard' });
  expect(box).toBeChecked();
  expect(box).toHaveAccessibleDescription('Others see your nickname, streak and points.');
  box.focus();
  await act(async () => {
    fireEvent.click(box);
  });
  expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ leaderboard: false });
  // QA154-05: the switch keeps keyboard focus while and after saving.
  expect(screen.getByRole('checkbox', { name: 'Show me on the leaderboard' })).toHaveFocus();
  expect(screen.getByRole('checkbox', { name: 'Show me on the leaderboard' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Leaderboard, 112 points' }));
  expect(
    await screen.findByText('You are hidden from others. You can change it in your profile.'),
  ).toBeInTheDocument();
});

test('rude nickname: the profile form asks for a different one (SK too)', async () => {
  const calls = server();
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Your profile: Mia' }));
  fireEvent.change(await screen.findByLabelText('Nickname'), { target: { value: 'kok0t' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
  expect(await screen.findByText('Please choose a different nickname.')).toBeInTheDocument();
  expect(calls.filter((c) => c.method === 'PATCH')).toEqual([]);
});
