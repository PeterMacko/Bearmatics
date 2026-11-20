// Test helper: call the API handler in-process like a browser on the app's origin would.
import { handleApi, type Env } from './api';

export const ORIGIN = 'https://bearmatics.test';

// oxlint-disable-next-line typescript/no-explicit-any -- test responses are checked by value
export const read = (response: Response): Promise<any> => response.json();

type ApiInit = { method?: string; body?: unknown; cookie?: string; origin?: string | null };

/**
 * An `api(path, init)` caller for the environment `env()` returns at call time (tests set it in
 * beforeAll). A body means POST with JSON; non-GET requests carry the app's Origin unless
 * `origin` names another one or is null (no Origin header).
 */
export function apiCaller(env: () => Env) {
  return (path: string, init: ApiInit = {}) => {
    const headers = new Headers();
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    if (init.cookie) headers.set('cookie', init.cookie);
    const method = init.method ?? (init.body !== undefined ? 'POST' : 'GET');
    if (method !== 'GET' && init.origin !== null) headers.set('origin', init.origin ?? ORIGIN);
    return handleApi(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
      env(),
    );
  };
}
