// Small HTTP helpers for the /api server. Never log request bodies, URLs or personal data.

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
} as const;

export function json(
  body: unknown,
  status = 200,
  extra: Record<string, string> | Headers = {},
): Response {
  const headers = new Headers(JSON_HEADERS);
  new Headers(extra).forEach((value, key) => headers.append(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

export function withoutBody(response: Response): Response {
  return new Response(null, { status: response.status, headers: response.headers });
}

export const methodNotAllowed = (allow: string) =>
  json({ error: 'method_not_allowed' }, 405, { allow });

export const notFound = () => json({ error: 'not_found' }, 404);

/** Reads one cookie value from the request. */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

export function cookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

/**
 * State-changing requests must come from our own page: same Origin and a JSON body.
 * Blocks other sites from using a signed-in child's cookie (cross-site request forgery).
 */
export function fromOwnSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(request.url).origin;
}

export class BadRequest extends Error {
  constructor(
    readonly code: string,
    readonly field?: string,
  ) {
    super(code);
  }
}

/** Parses a small JSON object body; anything else is a 400. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) {
    throw new BadRequest('json_required');
  }
  const text = await request.text();
  if (text.length > 4096) throw new BadRequest('too_large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new BadRequest('json_required');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequest('invalid');
  return body as Record<string, unknown>;
}
