import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';
import { fakeServer, reply } from './testing/fakeServer';
import { playFive } from './testing/lesson';
import { tap } from './testing/ui';

// SCRUM-118: streak in the bar and the unlock offer after the summary.

const ACCOUNT = { kind: 'password', username: 'kid', nickname: 'Kid', bear: 1, email: null };

function server(state: {
  points: number;
  streak: number;
  frozen: boolean;
  today?: boolean;
  offer?: { streak: number; missed: number; cost: number } | null;
  changedCost?: number;
}) {
  let changed = state.changedCost;
  return fakeServer(({ path, body }) => {
    const view = () => ({
      points: state.points,
      streak: state.streak,
      frozen: state.frozen,
      today: !!state.today,
    });
    if (path === '/api/me') return reply({ account: ACCOUNT });
    if (path === '/api/auth/google') return reply({ available: false });
    if (path === '/api/progress') return reply(view());
    if (path === '/api/progress/lessons') return reply({ lessonId: 'a'.repeat(32) }, 201);
    if (path === '/api/progress/lessons/finish') {
      const added = (body as { points: number }).points;
      state.points += added;
      if (!state.frozen && !state.today) {
        state.streak += 1;
        state.today = true;
      }
      return reply({ ...view(), added, offer: state.offer ?? null });
    }
    if (path === '/api/progress/streak') {
      const { unlock, cost } = body as { unlock: boolean; cost: number };
      if (changed !== undefined && unlock) {
        const offer = { ...state.offer!, cost: changed };
        state.offer = offer;
        changed = undefined;
        return reply({ error: 'offer_changed', offer, ...view() }, 409);
      }
      if (unlock) {
        state.points -= cost;
        state.streak += 1;
      } else state.streak = 1;
      state.frozen = false;
      state.today = true;
      return reply(view());
    }
    return reply({ error: 'not_found' }, 404);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Buttons in the offer ignore taps in the first 600 ms after a step change (QA131-01).
const settle = () =>
  act(async () => {
    await new Promise((done) => setTimeout(done, 650));
  });
const press = async (dialog: HTMLElement, name: string) => {
  await settle();
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name }), { detail: 1 });
  });
};

const offerDialog = () => screen.findByRole('dialog', { name: 'Frozen streak' }, { timeout: 6000 });

test("lit flame only after today's lesson: shadow before; the summary switches 5 -> 6 after 1 s", async () => {
  server({ points: 50, streak: 5, frozen: false });
  render(<App />);
  const nav = await screen.findByRole('navigation', { name: 'Main controls' });
  const chip = await within(nav).findByRole('img', {
    name: 'Streak 5 days. Finish a lesson today to keep it',
  });
  expect(chip).toHaveClass('shadow');
  await playFive();
  const summary = await within(screen.getByRole('main')).findByRole(
    'img',
    { name: 'Streak 6 days' },
    { timeout: 3000 },
  );
  expect(summary).toHaveClass('summary-streak', 'flame');
  // First the old number, then the new one.
  expect(summary).toHaveTextContent('5');
  await act(async () => {
    await new Promise((done) => setTimeout(done, 1100));
  });
  expect(summary).toHaveTextContent('6');
  expect(within(nav).getByRole('img', { name: 'Streak 6 days' })).toHaveClass('flame');
});

test('no streak yet: shadow flame without a number', async () => {
  server({ points: 0, streak: 0, frozen: false });
  render(<App />);
  const chip = await screen.findByRole('img', {
    name: 'No streak yet. Finish a lesson to start one',
  });
  expect(chip).toHaveClass('shadow');
  expect(chip).toHaveTextContent('');
});

test('frozen streak: accessible name says how to warm it up', async () => {
  server({ points: 50, streak: 1, frozen: true });
  render(<App />);
  expect(
    await screen.findByRole('img', {
      name: 'Streak 1 day, frozen. Finish one lesson to warm up your streak',
    }),
  ).toBeInTheDocument();
});

test('the example: unlock offer after the summary, confirmation, Yes pays 14 and continues', async () => {
  const calls = server({
    points: 135,
    streak: 12,
    frozen: true,
    offer: { streak: 12, missed: 2, cost: 14 },
  });
  render(<App />);
  await screen.findByRole('img', { name: /Streak 12 days, frozen/ });
  await playFive();
  const dialog = await offerDialog();
  expect(
    within(dialog).getByText('Your 12-day streak is frozen. Unlock it for 14 points?'),
  ).toBeInTheDocument();
  await press(dialog, 'Unlock');
  expect(
    within(dialog).getByText('You will have 126 points. Your bear badge goes from 4 to 3.'),
  ).toBeInTheDocument();
  // Back returns to the offer; nothing is paid without Yes.
  await press(dialog, 'Back');
  await press(dialog, 'Unlock');
  expect(calls.filter((c) => c.path === '/api/progress/streak')).toEqual([]);
  await press(dialog, 'Yes');
  expect(
    await within(dialog).findByText('Your streak is warm again: 13 days!'),
  ).toBeInTheDocument();
  expect(calls.find((c) => c.path === '/api/progress/streak')?.body).toEqual({
    unlock: true,
    cost: 14,
  });
  expect(
    within(screen.getByRole('navigation', { name: 'Main controls' })).getByRole('img', {
      name: 'Streak 13 days',
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bear badge 3, 126 points' })).toBeInTheDocument();
}, 15000);

test('No thanks starts again at 1', async () => {
  const calls = server({
    points: 50,
    streak: 6,
    frozen: true,
    offer: { streak: 6, missed: 1, cost: 5 },
  });
  render(<App />);
  await screen.findByRole('img', { name: /frozen/ });
  await playFive();
  const dialog = await offerDialog();
  await press(dialog, 'No thanks');
  expect(await within(dialog).findByText('A new streak starts today: 1 day.')).toBeInTheDocument();
  expect(calls.find((c) => c.path === '/api/progress/streak')?.body).toEqual({
    unlock: false,
    cost: 5,
  });
  expect(
    within(screen.getByRole('navigation', { name: 'Main controls' })).getByRole('img', {
      name: 'Streak 1 day',
    }),
  ).toBeInTheDocument();
}, 15000);

test('Decide later closes without an answer; a changed price shows the new offer', async () => {
  const calls = server({
    points: 100,
    streak: 3,
    frozen: true,
    offer: { streak: 3, missed: 2, cost: 10 },
    changedCost: 11,
  });
  render(<App />);
  await screen.findByRole('img', { name: /frozen/ });
  await playFive();
  let dialog = await offerDialog();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Decide later' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(calls.filter((c) => c.path === '/api/progress/streak')).toEqual([]);
  // Next lesson the same day: the offer comes back (taps right after closing are ignored).
  await settle();
  tap('Play again');
  for (let i = 0; i < 5; i++) {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
    tap('Check answer');
    tap(i < 4 ? 'Next exercise' : 'See how you did');
  }
  dialog = await offerDialog();
  await press(dialog, 'Unlock');
  await press(dialog, 'Yes');
  expect(
    await within(dialog).findByText('Your 3-day streak is frozen. Unlock it for 11 points?'),
  ).toBeInTheDocument();
}, 20000);

test('Slovak texts', async () => {
  server({ points: 140, streak: 12, frozen: true, offer: { streak: 12, missed: 2, cost: 14 } });
  render(<App />);
  await screen.findByRole('img', { name: /frozen/ });
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zavrieť nastavenia' }));
  expect(
    screen.getByRole('img', {
      name: 'Séria 12 dní, zamrznutá. Dokonči jednu lekciu a zohreješ sériu',
    }),
  ).toBeInTheDocument();
});

test('QA131-01/02: a double tap never answers the next question; focus goes to OK at the end', async () => {
  const calls = server({
    points: 135,
    streak: 12,
    frozen: true,
    offer: { streak: 12, missed: 2, cost: 14 },
  });
  render(<App />);
  await screen.findByRole('img', { name: /frozen/ });
  await playFive();
  const dialog = await offerDialog();
  await settle();
  // Double tap on Unlock: the first tap opens the confirmation, the second (detail 2, or a
  // quick second tap) lands on Yes and is ignored.
  fireEvent.click(within(dialog).getByRole('button', { name: 'Unlock' }), { detail: 1 });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Yes' }), { detail: 2 });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Yes' }), { detail: 1 });
  // Double tap on Back: the second tap lands on No thanks and is ignored.
  await settle();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }), { detail: 1 });
  fireEvent.click(within(dialog).getByRole('button', { name: 'No thanks' }), { detail: 2 });
  fireEvent.click(within(dialog).getByRole('button', { name: 'No thanks' }), { detail: 1 });
  await act(async () => {});
  expect(calls.filter((c) => c.path === '/api/progress/streak')).toEqual([]);
  expect(within(dialog).getByRole('button', { name: 'Unlock' })).toHaveFocus();
  await press(dialog, 'Unlock');
  expect(within(dialog).getByRole('button', { name: 'Yes' })).toHaveFocus();
  await press(dialog, 'Yes');
  const ok = await within(dialog).findByRole('button', { name: 'OK' });
  await act(async () => {});
  expect(ok).toHaveFocus();
  fireEvent.keyDown(ok, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
}, 15000);

test('QA131-06: a quick second tap after OK does not start a new lesson', async () => {
  server({ points: 135, streak: 12, frozen: true, offer: { streak: 12, missed: 2, cost: 14 } });
  render(<App />);
  await screen.findByRole('img', { name: /frozen/ });
  await playFive();
  const dialog = await offerDialog();
  await press(dialog, 'Unlock');
  await press(dialog, 'Yes');
  await within(dialog).findByRole('button', { name: 'OK' });
  await press(dialog, 'OK');
  // The second tap of a double tap lands on Play again below the closed dialog.
  fireEvent.click(screen.getByRole('button', { name: 'Play again' }), { detail: 1 });
  expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  // A deliberate tap later works.
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Play again' }), { detail: 1 });
  expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull();
}, 15000);

test('QA131-07: no streak yet: the summary shows 1 at once, never a lit flame with 0', async () => {
  server({ points: 0, streak: 0, frozen: false });
  render(<App />);
  await screen.findByRole('img', { name: /No streak yet/ });
  await playFive();
  const summary = await within(screen.getByRole('main')).findByRole(
    'img',
    { name: 'Streak 1 day' },
    { timeout: 3000 },
  );
  expect(summary).toHaveTextContent('1');
  expect(summary).not.toHaveTextContent('0');
});
