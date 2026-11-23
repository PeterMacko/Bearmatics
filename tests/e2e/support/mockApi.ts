import { type Page } from '@playwright/test';

export interface MockApi {
  nickname: string;
  points: number;
  streak: number;
  frozen: boolean;
  today: boolean;
  /** Answers /api/leaderboard and keeps the account's leaderboard switch (PATCH /api/me). */
  leaderboard?: { rows: unknown[]; gapBefore: number };
}

/** Mocked server answers for a signed-in password account; anything else is "not available". */
export async function mockApi(page: Page, o: MockApi) {
  let onLeaderboard = true;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    const account = () => ({
      kind: 'password',
      username: 'kid',
      nickname: o.nickname,
      look: { fur: 1, background: 1, head: 2, neck: 0, eyes: 0 },
      email: null,
      ...(o.leaderboard ? { leaderboard: onLeaderboard } : {}),
    });
    if (o.leaderboard && path === '/api/me' && route.request().method() === 'PATCH') {
      await new Promise((done) => setTimeout(done, 300));
      onLeaderboard = JSON.parse(route.request().postData() ?? '{}').leaderboard ?? onLeaderboard;
      return json({ account: account() });
    }
    if (path === '/api/me') return json({ account: account() });
    if (path === '/api/progress')
      return json({ points: o.points, streak: o.streak, frozen: o.frozen, today: o.today });
    if (o.leaderboard && path === '/api/leaderboard') return json(o.leaderboard);
    return json({ available: false });
  });
}
