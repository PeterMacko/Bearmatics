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
    const account = () =>
      mockAccount(o.nickname, o.leaderboard ? { leaderboard: onLeaderboard } : {});
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

/** The look of every mocked password account. */
export const ACCOUNT_LOOK = { fur: 1, background: 1, head: 2, neck: 0, eyes: 0 };

/** A mocked password account (`/api/me`), with the leaderboard switch only when given. */
export const mockAccount = (nickname: string, extra: { leaderboard?: boolean } = {}) => ({
  kind: 'password',
  username: 'kid',
  nickname,
  look: ACCOUNT_LOOK,
  email: null,
  ...extra,
});

export interface LessonApi {
  account: ReturnType<typeof mockAccount>;
  /** Answer to GET /api/progress. */
  progress: unknown;
  /** POST /api/progress/lessons answers `{ lessonId }` with this status (default 200). */
  lessonId: string;
  lessonStatus?: number;
  /** Answer to /api/progress/lessons/finish; a function gets the request's JSON body. */
  finish: object | ((body: { points: number }) => unknown);
  /** Answer to /api/leaderboard; without it the leaderboard is "not available". */
  leaderboard?: { status: number; body: unknown };
  /** Keep the JSON bodies of the lesson start and finish requests. */
  record?: boolean;
}

/**
 * Mocked server answers for a signed-in password account that saves lessons; anything else is
 * "not available". Returns the recorded start/finish bodies (empty unless `record`).
 */
export async function mockLessonApi(page: Page, o: LessonApi) {
  const finished: unknown[] = [];
  const started: unknown[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/me') return json({ account: o.account });
    if (path === '/api/progress') return json(o.progress);
    if (path === '/api/progress/lessons') {
      if (o.record) started.push(request.postDataJSON());
      return json({ lessonId: o.lessonId }, o.lessonStatus);
    }
    if (path === '/api/progress/lessons/finish') {
      if (typeof o.finish !== 'function') return json(o.finish);
      const body = request.postDataJSON();
      if (o.record) finished.push(body);
      return json(o.finish(body));
    }
    if (o.leaderboard && path === '/api/leaderboard')
      return json(o.leaderboard.body, o.leaderboard.status);
    return json({ available: false });
  });
  return { finished, started };
}

/**
 * Signed out. `'401'`: every request answers 401 `not_signed_in`; `'no-account'`: /api/me answers
 * `{ account: null }` and anything else `{}`.
 */
export const mockSignedOut = (page: Page, answer: '401' | 'no-account') =>
  page.route('**/api/**', (route) =>
    answer === '401'
      ? route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: '{"error":"not_signed_in"}',
        })
      : route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(
            new URL(route.request().url()).pathname === '/api/me' ? { account: null } : {},
          ),
        }),
  );
