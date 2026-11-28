// Bearmatics server. Runs first for every request (assets.run_worker_first: true) so plain
// http can be sent to https (SCRUM-198): workers.dev has no "Always Use HTTPS" setting.
// /api goes to the API; every other address is handed to the static assets unchanged.
// The entry module may export only the handler, so the logic lives in api.ts.
import { handleApi, isApiPath, type Env } from './api';
import { json } from './http';

// Plain http stays allowed only on this computer (wrangler dev, local e2e servers).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const HSTS = 'max-age=31536000';

function toHttps(url: URL, method: string): Response {
  url.protocol = 'https:';
  // 308 keeps the method and body for API writes; pages and reads get the usual 301.
  const status = method === 'GET' || method === 'HEAD' ? 301 : 308;
  return new Response(null, { status, headers: { location: url.toString() } });
}

async function route(request: Request, env: Env, pathname: string): Promise<Response> {
  if (isApiPath(pathname)) return handleApi(request, env);
  if (env.ASSETS) return env.ASSETS.fetch(request);
  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.protocol === 'http:' && !LOCAL_HOSTS.has(url.hostname)) {
      return toHttps(url, request.method);
    }
    const response = await route(request, env, url.pathname);
    if (url.protocol !== 'https:') return response;
    const secured = new Response(response.body, response);
    secured.headers.set('strict-transport-security', HSTS);
    return secured;
  },
} satisfies ExportedHandler<Env>;
