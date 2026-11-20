// SCRUM-218: the About page addresses are app pages. The server script hands them to the static
// assets unchanged; the assets' single-page-application fallback then answers with index.html
// (proved against real `wrangler dev` in tests/e2e-accounts/about-pages.spec.ts).
import { describe, expect, it, vi } from 'vitest';
import worker from './index';

describe('About page addresses (SCRUM-218)', () => {
  it.each(['/about', '/about/', '/about/sk', '/about/en', '/about/en/', '/about/xx'])(
    'hands %s to the static assets unchanged',
    async (path) => {
      const fetch = vi.fn(async (_request: Request) => new Response('<html>app</html>'));
      const env = { DB: {} as D1Database, ASSETS: { fetch } as unknown as Fetcher };
      const response = await worker.fetch(new Request(`https://bearmatics.test${path}`), env);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('<html>app</html>');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(new URL(fetch.mock.calls[0][0].url).pathname).toBe(path);
    },
  );
});
