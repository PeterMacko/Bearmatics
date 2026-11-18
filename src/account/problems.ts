// Messages for account form checks and server errors.
import { AccountError } from './api';
import type { T } from './fields';
import { isRudeNickname, validNickname } from './rules';

export function errorText(t: T, error: unknown): string {
  if (!(error instanceof AccountError)) return t.errors.generic;
  switch (error.code) {
    case 'offline':
      return t.errors.offline;
    case 'username_taken':
      return t.errors.taken;
    case 'wrong_username_or_password':
      return t.errors.wrong;
    case 'too_many_attempts':
      return t.errors.locked;
    case 'wrong_password':
      return t.errors.wrongCurrent;
    case 'google_expired':
      return t.errors.googleExpired;
    case 'invalid':
      if (error.field === 'username') return t.errors.username;
      if (error.field === 'email') return t.errors.email;
      if (error.field === 'nickname') return t.errors.nickname;
      if (error.field === 'parentConfirmed') return t.errors.parent;
      return t.errors.generic;
    case 'not_allowed':
      return t.errors.nicknameRude;
    default:
      return t.errors.generic;
  }
}

/** Form check of a nickname: '' when fine (the server checks again). */
export function nicknameProblem(t: T, nickname: string): string {
  if (!validNickname(nickname)) return t.errors.nickname;
  if (isRudeNickname(nickname)) return t.errors.nicknameRude;
  return '';
}

/**
 * The first failed check's message, '' when all pass. Each check is a message when it fails
 * and false (or '') when it passes: `firstProblem([!valid(x) && t.errors.x, ...])`.
 */
export function firstProblem(checks: readonly (string | false)[]): string {
  return checks.find((check): check is string => !!check) ?? '';
}
