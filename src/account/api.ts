// Browser side of the account API. Only JSON bodies; nothing personal ever goes in a URL.
import type { Account, BearLook } from '../../shared/api-types';

export type { Account };

type ApiError =
  | 'offline'
  | 'invalid'
  | 'username_taken'
  | 'wrong_username_or_password'
  | 'too_many_attempts'
  | 'wrong_password'
  | 'not_signed_in'
  | 'google_expired'
  | 'server_error'
  | 'unknown_lesson'
  | 'no_offer'
  | 'offer_changed'
  | 'not_allowed';

export class AccountError extends Error {
  constructor(
    readonly code: ApiError,
    readonly field?: string,
    /** The whole error answer, for errors that carry data (streak offer changed). */
    readonly data?: unknown,
  ) {
    super(code);
  }
}

export async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AccountError('offline');
  }
  // Without the server (plain static hosting) /api answers with the app page: treat as offline.
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
    throw new AccountError('offline');
  }
  const data = (await response.json()) as T & { error?: ApiError; field?: string };
  if (!response.ok) throw new AccountError(data.error ?? 'server_error', data.field, data);
  return data;
}

type AccountReply = { account: Account | null };

export const loadAccount = () => call<AccountReply>('/api/me').then((r) => r.account);
export const googleAvailable = () =>
  call<{ available: boolean }>('/api/auth/google').then((r) => r.available);
export const signUp = (body: {
  username: string;
  key: string;
  email: string;
  nickname: string;
  look: BearLook;
  parentConfirmed: boolean;
}) => call<AccountReply>('/api/auth/signup', 'POST', body).then((r) => r.account!);
export const signIn = (username: string, key: string) =>
  call<AccountReply>('/api/auth/signin', 'POST', { username, key }).then((r) => r.account!);
export const signOut = () => call<AccountReply>('/api/auth/signout', 'POST', {});
export const updateProfile = (changes: {
  leaderboard?: boolean;
  nickname?: string;
  look?: BearLook;
  email?: string | null;
}) => call<AccountReply>('/api/me', 'PATCH', changes).then((r) => r.account!);
export const changePassword = (currentKey: string, newKey: string) =>
  call<{ ok: true }>('/api/me/password', 'POST', { currentKey, newKey });
export const deleteAccount = () => call<AccountReply>('/api/me', 'DELETE', {});
export const completeGoogle = (body: {
  nickname: string;
  look: BearLook;
  parentConfirmed: boolean;
}) => call<AccountReply>('/api/auth/google/complete', 'POST', body).then((r) => r.account!);
