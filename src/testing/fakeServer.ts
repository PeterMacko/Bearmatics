import { vi } from 'vitest';

/** One request the app sent to the fake server. */
export type Call = { path: string; method: string; body: unknown };

/** A JSON response, as the real API answers. */
export const reply = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

/**
 * Replaces `fetch` with a fake server: every request is recorded (JSON body parsed) and answered
 * by `route`. Returns the recorded calls. Undo with `vi.unstubAllGlobals()`.
 */
export function fakeServer(route: (call: Call) => Promise<Response>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      const call = { path, method, body };
      calls.push(call);
      return route(call);
    }),
  );
  return calls;
}
