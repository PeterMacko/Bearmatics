// Input rules shared by the server (and mirrored in src/account/rules.ts for the forms).
import { BadRequest } from './http';

export const BEAR_COUNT = 8;
const USERNAME = /^[A-Za-z0-9]{3,20}$/;
const KEY = /^[0-9a-f]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Letters (any language), digits, spaces and . _ - ; 1-20 characters after trimming.
const NICKNAME = /^[\p{L}\p{N} ._-]{1,20}$/u;

export function username(value: unknown): string {
  if (typeof value !== 'string' || !USERNAME.test(value))
    throw new BadRequest('invalid', 'username');
  return value;
}

/** Browser-derived password key: 32 bytes as lower-case hex. Never the password itself. */
export function passwordKey(value: unknown, field = 'key'): string {
  if (typeof value !== 'string' || !KEY.test(value)) throw new BadRequest('invalid', field);
  return value;
}

export function nickname(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!NICKNAME.test(trimmed)) throw new BadRequest('invalid', 'nickname');
  return trimmed;
}

export function bear(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > BEAR_COUNT) {
    throw new BadRequest('invalid', 'bear');
  }
  return value;
}

/** Optional email: empty/null means none. */
export function email(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new BadRequest('invalid', 'email');
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > 254 || !EMAIL.test(trimmed)) throw new BadRequest('invalid', 'email');
  return trimmed;
}

export function parentConfirmed(value: unknown): void {
  if (value !== true) throw new BadRequest('invalid', 'parentConfirmed');
}
