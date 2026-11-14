// Bearmatics server: answers only /api requests. Every other address is served by
// Cloudflare static assets before this script runs (assets.run_worker_first).
// Never log request bodies, URLs or personal data.

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
} as const;

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function withoutBody(response: Response): Response {
  return new Response(null, { status: response.status, headers: response.headers });
}

export async function health(env: Env): Promise<Response> {
  try {
    await env.DB.prepare('SELECT 1').first();
  } catch {
    console.error('health: database unreachable');
    return json({ status: 'error', database: 'unavailable' }, 503);
  }
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM app_meta WHERE key = 'schema_version'",
    ).first<{
      value: string;
    }>();
    if (!row) return json({ status: 'error', database: 'ok', schema: 'missing' }, 503);
    return json({ status: 'ok', database: 'ok', schema: row.value });
  } catch {
    console.error('health: schema not migrated');
    return json({ status: 'error', database: 'ok', schema: 'missing' }, 503);
  }
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/health') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method_not_allowed' }, 405, { allow: 'GET, HEAD' });
    }
    const response = await health(env);
    return request.method === 'HEAD' ? withoutBody(response) : response;
  }
  return json({ error: 'not_found' }, 404);
}

export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (isApiPath(pathname)) return handleApi(request, env);
    // Not expected (run_worker_first covers only /api), but stay safe: hand back to assets.
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: 'not_found' }, 404);
  },
} satisfies ExportedHandler<Env>;
