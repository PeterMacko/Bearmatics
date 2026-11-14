// The slow part of password checking runs here in the browser, so the server stays within
// Cloudflare's free CPU limit and never sees the password: PBKDF2-SHA256, 600,000 rounds, with a
// per-user salt (the app name plus the lower-case username, which is unique). The server stores
// only SHA-256(random server salt || this key). See worker/crypto.ts.
export const PASSWORD_ROUNDS = 600_000;

export const passwordKey = (username: string, password: string, rounds = PASSWORD_ROUNDS) =>
  pbkdf2Hex(password.normalize('NFC'), `bearmatics-v1:${username.toLowerCase()}`, rounds);

export async function pbkdf2Hex(password: string, salt: string, rounds: number): Promise<string> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations: rounds,
    },
    material,
    256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
