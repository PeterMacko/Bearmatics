// Hashing helpers (Web Crypto, available in Workers and Node).

const encoder = new TextEncoder();

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomHex(bytes: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const input = typeof data === 'string' ? encoder.encode(data) : data;
  return toHex(await crypto.subtle.digest('SHA-256', input as BufferSource));
}

/**
 * Server side of the password check: SHA-256(server salt || browser-derived key).
 * The slow part (PBKDF2, 600,000 rounds) runs in the browser; see src/account/passwordKey.ts.
 */
export function passwordVerifier(serverSaltHex: string, keyHex: string): Promise<string> {
  const salt = fromHex(serverSaltHex);
  const key = fromHex(keyHex);
  const joined = new Uint8Array(salt.length + key.length);
  joined.set(salt);
  joined.set(key, salt.length);
  return sha256Hex(joined);
}

/** Compares two equal-length hex strings without an early exit. */
export function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
