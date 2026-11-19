// Server input checks: the shared rules (shared/rules.ts) answered with a 400 naming the field.
import {
  isRudeNickname,
  tidyNickname,
  validBear,
  validEmail,
  validKey,
  validNickname,
  validUsername,
} from '../shared/rules';
import { BadRequest } from './http';

export function username(value: unknown): string {
  if (typeof value !== 'string' || !validUsername(value))
    throw new BadRequest('invalid', 'username');
  return value;
}

/** Browser-derived password key: 32 bytes as lower-case hex. Never the password itself. */
export function passwordKey(value: unknown, field = 'key'): string {
  if (typeof value !== 'string' || !validKey(value)) throw new BadRequest('invalid', field);
  return value;
}

export function nickname(value: unknown): string {
  const trimmed = typeof value === 'string' ? tidyNickname(value) : '';
  if (!validNickname(trimmed)) throw new BadRequest('invalid', 'nickname');
  // SCRUM-148: nicknames are shown to other players.
  if (isRudeNickname(trimmed)) throw new BadRequest('not_allowed', 'nickname');
  return trimmed;
}

export function bear(value: unknown): number {
  if (!validBear(value)) throw new BadRequest('invalid', 'bear');
  return value;
}

/** Optional email: empty/null means none. */
export function email(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new BadRequest('invalid', 'email');
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!validEmail(trimmed)) throw new BadRequest('invalid', 'email');
  return trimmed;
}

export function parentConfirmed(value: unknown): void {
  if (value !== true) throw new BadRequest('invalid', 'parentConfirmed');
}
