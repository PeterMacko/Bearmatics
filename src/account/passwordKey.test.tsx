import { describe, expect, it } from 'vitest';
import { PASSWORD_ROUNDS, passwordKey, pbkdf2Hex } from './passwordKey';

describe('browser password key', () => {
  it('is standard PBKDF2-SHA256 (published test vector)', async () => {
    expect(await pbkdf2Hex('password', 'salt', 1)).toBe(
      '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b',
    );
    expect(await pbkdf2Hex('password', 'salt', 2)).toBe(
      'ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43',
    );
  });

  it('uses 600,000 rounds and a salt per username, ignoring capital letters', async () => {
    expect(PASSWORD_ROUNDS).toBe(600_000);
    const a = await passwordKey('Mia', 'honeyPot42', 2);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await passwordKey('MIA', 'honeyPot42', 2)).toBe(a);
    expect(await passwordKey('Leo', 'honeyPot42', 2)).not.toBe(a);
    expect(await passwordKey('Mia', 'honeyPot43', 2)).not.toBe(a);
    expect(a).toBe(await pbkdf2Hex('honeyPot42', 'bearmatics-v1:mia', 2));
  });
});
