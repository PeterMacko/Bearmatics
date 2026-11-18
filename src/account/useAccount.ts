import { useEffect, useState } from 'react';
import type { AccountScreen } from './AccountViews';
import { googleAvailable, loadAccount, type Account } from './api';

/**
 * The optional account (SCRUM-97) and which account screen is open. Everything works signed
 * out; the server may be missing. `onScreenChange` runs on every screen change (App then moves
 * focus to the new screen's heading).
 */
export function useAccount(onScreenChange: () => void) {
  const [account, setAccount] = useState<Account | null>(null);
  // False until the first /api/me answer: a lesson started before it waits for the answer.
  const [accountKnown, setAccountKnown] = useState(false);
  const [accountScreen, setAccountScreen] = useState<AccountScreen | null>(null);
  const [privacyFrom, setPrivacyFrom] = useState<AccountScreen | null>(null);
  const [accountNotice, setAccountNotice] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const openAccount = (next: AccountScreen | null, notice = '') => {
    onScreenChange();
    if (next === 'privacy') setPrivacyFrom(accountScreen);
    setAccountNotice(notice);
    setAccountScreen(next);
  };
  return {
    account,
    setAccount,
    accountKnown,
    setAccountKnown,
    accountScreen,
    setAccountScreen,
    privacyFrom,
    accountNotice,
    setAccountNotice,
    googleReady,
    setGoogleReady,
    openAccount,
  };
}

/**
 * Loads the account once on start, and reads the result of a Google sign-in round trip
 * (/?account=<result>). A separate hook so App keeps this effect after its navigation focus
 * effect (unchanged effect order).
 */
export function useAccountLoad({
  setAccount,
  setAccountKnown,
  setGoogleReady,
  setAccountScreen,
  setAccountNotice,
}: Pick<
  ReturnType<typeof useAccount>,
  'setAccount' | 'setAccountKnown' | 'setGoogleReady' | 'setAccountScreen' | 'setAccountNotice'
>) {
  useEffect(() => {
    let live = true;
    loadAccount()
      .then(
        (found) => live && setAccount(found),
        () => {},
      )
      .finally(() => live && setAccountKnown(true));
    googleAvailable().then(
      (ready) => live && setGoogleReady(ready),
      () => {},
    );
    // Result of a Google sign-in round trip: /?account=<result>. Remove it from the address.
    const result = new URLSearchParams(window.location.search).get('account');
    if (result) {
      window.history.replaceState(null, '', window.location.pathname);
      if (result === 'google-new') setAccountScreen('google-new');
      else if (result !== 'signed-in') {
        setAccountScreen('signin');
        setAccountNotice(result);
      }
    }
    return () => {
      live = false;
    };
    // Runs once: state setters never change.
  }, [setAccount, setAccountKnown, setGoogleReady, setAccountScreen, setAccountNotice]);
}
