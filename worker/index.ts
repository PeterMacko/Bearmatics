// Bearmatics server: answers only /api requests. Every other address is served by
// Cloudflare static assets before this script runs (assets.run_worker_first).
// The entry module may export only the handler, so the logic lives in api.ts.
import { handleApi, isApiPath, json, type Env } from './api';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (isApiPath(pathname)) return handleApi(request, env);
    // Not expected (run_worker_first covers only /api), but stay safe: hand back to assets.
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: 'not_found' }, 404);
  },
} satisfies ExportedHandler<Env>;
