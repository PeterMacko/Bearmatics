import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from './api';
import { useAccount, useAccountLoad } from './useAccount';

const api = vi.hoisted(() => ({
  loadAccount: vi.fn<() => Promise<Account | null>>(),
  googleAvailable: vi.fn<() => Promise<boolean>>(),
}));
vi.mock('./api', async (original) => ({ ...(await original<object>()), ...api }));

const KID: Account = {
  kind: 'password',
  username: 'kid',
  nickname: 'Cub',
  bear: 1,
  email: null,
  leaderboard: true,
};

/** Both hooks the way App uses them. */
const useBoth = (onScreenChange: () => void) => {
  const state = useAccount(onScreenChange);
  useAccountLoad(state);
  return state;
};

beforeEach(() => {
  api.loadAccount.mockResolvedValue(KID);
  api.googleAvailable.mockResolvedValue(true);
  window.history.replaceState(null, '', '/');
});
afterEach(() => vi.clearAllMocks());

describe('useAccount', () => {
  it('opens screens, remembers where privacy came from and reports each change', () => {
    api.loadAccount.mockReturnValue(new Promise(() => {}));
    const changed = vi.fn();
    const { result } = renderHook(() => useBoth(changed));
    act(() => result.current.openAccount('signup'));
    act(() => result.current.openAccount('privacy'));
    expect(result.current.accountScreen).toBe('privacy');
    expect(result.current.privacyFrom).toBe('signup');
    act(() => result.current.openAccount('signin', 'signed-out'));
    expect(result.current.accountNotice).toBe('signed-out');
    act(() => result.current.openAccount(null));
    expect(result.current.accountScreen).toBeNull();
    expect(result.current.accountNotice).toBe('');
    // Privacy keeps its origin until privacy is opened again.
    expect(result.current.privacyFrom).toBe('signup');
    expect(changed).toHaveBeenCalledTimes(4);
  });
});

describe('useAccountLoad', () => {
  it('loads the account and Google once', async () => {
    const { result, rerender } = renderHook(() => useBoth(() => {}));
    expect(result.current.accountKnown).toBe(false);
    await waitFor(() => expect(result.current.accountKnown).toBe(true));
    expect(result.current.account).toEqual(KID);
    expect(result.current.googleReady).toBe(true);
    rerender();
    expect(api.loadAccount).toHaveBeenCalledTimes(1);
    expect(api.googleAvailable).toHaveBeenCalledTimes(1);
  });

  it('knows the account after a failed load too (signed out)', async () => {
    api.loadAccount.mockRejectedValue(new Error('offline'));
    api.googleAvailable.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useBoth(() => {}));
    await waitFor(() => expect(result.current.accountKnown).toBe(true));
    expect(result.current.account).toBeNull();
    expect(result.current.googleReady).toBe(false);
  });

  it.each([
    ['google-new', 'google-new', ''],
    ['google-failed', 'signin', 'google-failed'],
    ['signed-in', null, ''],
  ])('reads ?account=%s from the address and removes it', async (value, screen, notice) => {
    window.history.replaceState(null, '', `/?account=${value}`);
    const { result } = renderHook(() => useBoth(() => {}));
    expect(window.location.search).toBe('');
    expect(result.current.accountScreen).toBe(screen);
    expect(result.current.accountNotice).toBe(notice);
    await waitFor(() => expect(result.current.accountKnown).toBe(true));
  });
});
