import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import * as math from './math/engine';
import App from './App';
import { openMathematics } from './testing/openMathematics';

// SCRUM-118: streak in the bar and the unlock offer after the summary.

type Call = { path: string; method: string; body: unknown };
const ACCOUNT = { kind: 'password', username: 'kid', nickname: 'Kid', bear: 1, email: null };

function server(state: {
  points: number;
  streak: number;
  frozen: boolean;
  today?: boolean;
  offer?: { streak: number; missed: number; cost: number } | null;
  changedCost?: number;
}) {
  const calls: Call[] = [];
  const reply = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  let changed = state.changedCost;
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ path, method, body });
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
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }), { detail: 1 });

async function playFive() {
  vi.spyOn(math, 'generateSession').mockReturnValue(
    Array(5).fill({ level: 1, operation: '+', values: [1, 2, 3], blank: 2 }),
  );
  openMathematics();
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  click('Let’s count');
  for (let i = 0; i < 5; i++) {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
    click('Check answer');
    click(i < 4 ? 'Next exercise' : 'See how you did');
  }
}

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
  fireEvent.click(within(dialog).getByRole('button', { name: 'Unlock' }));
  expect(
    within(dialog).getByText('You will have 126 points. Your bear badge goes from 4 to 3.'),
  ).toBeInTheDocument();
  // Back returns to the offer; nothing is paid without Yes.
  fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Unlock' }));
  expect(calls.filter((c) => c.path === '/api/progress/streak')).toEqual([]);
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes' }));
  });
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
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'No thanks' }));
  });
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
  // Next lesson the same day: the offer comes back.
  click('Play again');
  for (let i = 0; i < 5; i++) {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
    click('Check answer');
    click(i < 4 ? 'Next exercise' : 'See how you did');
  }
  dialog = await offerDialog();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Unlock' }));
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes' }));
  });
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
