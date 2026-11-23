import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';
import { fakeServer, reply } from './testing/fakeServer';

// SCRUM-148: two bar buttons, the leaderboard window and the profile switch.

const ACCOUNT = {
  kind: 'password',
  username: 'kid',
  nickname: 'Mia',
  look: { fur: 0, background: 0, head: 3, neck: 0, eyes: 0 },
  email: null,
  leaderboard: true,
};
const row = (place: number, nickname: string, points: number, extra = {}) => ({
  place,
  nickname,
  look: { fur: 1, background: 1, head: 2, neck: 0, eyes: 0 },
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
  // SCRUM-258: the Badge column sits between Player and Streak.
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent),
  ).toEqual(['Place#', 'Player', 'Badge', 'Streak', 'Points']);
  for (const name of ['Place', 'Player', 'Badge', 'Streak', 'Points'])
    expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument();
  expect(within(table).getAllByRole('columnheader')).toHaveLength(5);
  // The gap row spans all five columns.
  expect(rows[11].querySelector('td')).toHaveAttribute('colspan', '5');
  // My row shows the same badge as my bar medal (112 points = badge 3).
  expect(within(me).getByLabelText('Bear badge 3')).toBeInTheDocument();
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

// SCRUM-258: the badge follows the points; no badge yet = a dash read as "No badge yet".
const BADGE_POINTS = [1234, 378, 166, 30, 29, 1];
const BADGES = ['22', '10', '5', '1', '–', '–'];

function badgeServer() {
  return fakeServer(({ path }) => {
    if (path === '/api/me') return reply({ account: ACCOUNT });
    if (path === '/api/auth/google') return reply({ available: false });
    if (path === '/api/progress')
      return reply({ points: 30, streak: 1, frozen: false, today: true });
    if (path === '/api/leaderboard')
      return reply({
        rows: BADGE_POINTS.map((points, i) =>
          row(i + 1, `P${i + 1}`, points, { me: points === 30 }),
        ),
        gapBefore: null,
      });
    return reply({ error: 'not_found' }, 404);
  });
}

test('badge column: medal number from points, dash below 30 points (EN and SK)', async () => {
  badgeServer();
  render(<App />);
  const nav = await screen.findByRole('navigation', { name: 'Main controls' });
  fireEvent.click(await within(nav).findByRole('button', { name: 'Leaderboard, 30 points' }));
  let table = await within(screen.getByRole('dialog')).findByRole('table');
  const cells = () =>
    within(table)
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelectorAll('td')[2]);
  expect(cells().map((c) => c.textContent)).toEqual(BADGES);
  expect(cells().map((c) => c.firstElementChild?.getAttribute('aria-label'))).toEqual([
    'Bear badge 22',
    'Bear badge 10',
    'Bear badge 5',
    'Bear badge 1',
    'No badge yet',
    'No badge yet',
  ]);
  // The medal itself is decorative; it uses the same look as the bar medal.
  const medal = cells()[0].querySelector('svg')!;
  expect(medal).toHaveAttribute('aria-hidden', 'true');
  expect(medal).toHaveClass('badge-icon', 'badge-silver');
  // My row = my bar medal.
  expect(within(nav).getByRole('button', { name: 'Bear badge 1, 30 points' })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zavrieť nastavenia' }));
  fireEvent.click(screen.getByRole('button', { name: 'Rebríček, 30 bodov' }));
  table = await within(screen.getByRole('dialog', { name: 'Rebríček' })).findByRole('table');
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent),
  ).toEqual(['Poradie#', 'Hráč', 'Odznak', 'Séria', 'Body']);
  expect(cells().map((c) => c.firstElementChild?.getAttribute('aria-label'))).toEqual([
    'Medvedí odznak 22',
    'Medvedí odznak 10',
    'Medvedí odznak 5',
    'Medvedí odznak 1',
    'Zatiaľ bez odznaku',
    'Zatiaľ bez odznaku',
  ]);
});
