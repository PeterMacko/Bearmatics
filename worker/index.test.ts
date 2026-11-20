import { describe, expect, it, vi } from 'vitest';
import { type Env } from './api';
import worker from './index';

type Row = Record<string, unknown> | null;

function fakeDb(answer: (sql: string) => Row | Error): D1Database {
  return {
    prepare: (sql: string) => ({
      first: async () => {
        const result = answer(sql);
        if (result instanceof Error) throw result;
        return result;
      },
    }),
  } as unknown as D1Database;
}

const migrated = fakeDb((sql) => (sql.includes('app_meta') ? { value: '5' } : { 1: 1 }));

function call(path: string, env: Env, init?: RequestInit) {
  return worker.fetch(new Request(`https://bearmatics.test${path}`, init), env);
}

describe('server /api', () => {
  it('reports server and database OK when migrated', async () => {
    const response = await call('/api/health', { DB: migrated });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok', database: 'ok', schema: '5' });
  });

  it('answers HEAD without a body', async () => {
    const response = await call('/api/health', { DB: migrated }, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  it('returns 503 when the database is unreachable, without leaking the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { DB: fakeDb(() => new Error('secret internal detail')) };
    const response = await call('/api/health', env);
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ status: 'error', database: 'unavailable' });
    expect(text).not.toContain('secret');
  });

  it('returns 503 when migrations were not applied', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = {
      DB: fakeDb((sql) => (sql.includes('app_meta') ? new Error('no such table') : { 1: 1 })),
    };
    const response = await call('/api/health', env);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'error', database: 'ok', schema: 'missing' });
  });

  it('rejects other methods on /api/health with 405', async () => {
    const response = await call('/api/health', { DB: migrated }, { method: 'POST', body: '{}' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
  });

  it.each(['/api', '/api/', '/api/unknown', '/api/health/extra', '/api/HEALTH'])(
    'returns a JSON 404 for %s',
    async (path) => {
      const response = await call(path, { DB: migrated });
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({ error: 'not_found' });
    },
  );

  it('never hands an /api address to the app page, even with assets available', async () => {
    const fetch = vi.fn(async () => new Response('<html>app</html>'));
    const assets = { fetch } as unknown as Fetcher;
    for (const path of ['/api', '/api/unknown']) {
      const response = await call(path, { DB: migrated, ASSETS: assets });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('hands any non-/api request back to the static assets', async () => {
    const assets = { fetch: vi.fn(async () => new Response('app')) } as unknown as Fetcher;
    const response = await call('/apiary', { DB: migrated, ASSETS: assets });
    expect(await response.text()).toBe('app');
  });
});

describe('https only (SCRUM-198)', () => {
  const assets = () => ({ fetch: vi.fn(async () => new Response('app')) }) as unknown as Fetcher;

  it('redirects plain http to the same https address, for pages and /api', async () => {
    const env = { DB: migrated, ASSETS: assets() };
    for (const path of ['/', '/settings?lang=sk', '/api/health', '/api/session']) {
      const response = await worker.fetch(
        new Request(`http://bearmatics.pro22.workers.dev${path}`),
        env,
      );
      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe(`https://bearmatics.pro22.workers.dev${path}`);
      expect(await response.text()).toBe('');
    }
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it('never runs the API over plain http, whatever the method', async () => {
    const response = await worker.fetch(
      new Request('http://bearmatics.test/api/account/sign-in', { method: 'POST', body: '{}' }),
      { DB: migrated },
    );
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://bearmatics.test/api/account/sign-in');
  });

  it('tells browsers to stay on https', async () => {
    const page = await call('/', { DB: migrated, ASSETS: assets() });
    expect(await page.text()).toBe('app');
    expect(page.headers.get('strict-transport-security')).toBe('max-age=31536000');
    const api = await call('/api/health', { DB: migrated });
    expect(api.status).toBe(200);
    expect(api.headers.get('strict-transport-security')).toBe('max-age=31536000');
  });

  it('keeps plain http on this computer for local development and tests', async () => {
    for (const host of ['localhost:8787', '127.0.0.1:4173', '[::1]:8787']) {
      const response = await worker.fetch(new Request(`http://${host}/api/health`), {
        DB: migrated,
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('strict-transport-security')).toBeNull();
    }
  });
});
