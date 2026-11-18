import type { RefObject } from 'react';
import type { Copy } from '../i18n';
import {
  GoogleNewView,
  PrivacyView,
  ProfileView,
  SignInView,
  SignUpView,
  type AccountScreen,
} from './AccountViews';
import type { Account } from './api';

/** The open account screen (sign in, create, Google completion, profile or privacy). */
export default function AccountScreens({
  t,
  screen,
  account,
  notice: noticeKey,
  googleReady,
  headingRef,
  onAccount,
  onOpen,
}: {
  t: Copy['account'];
  screen: AccountScreen;
  account: Account | null;
  /** The notice key from the last screen change ('signed-out', a Google result...). */
  notice: string;
  googleReady: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAccount: (account: Account | null) => void;
  onOpen: (next: AccountScreen | null, notice?: string) => void;
}) {
  const common = {
    t,
    headingRef,
    onPrivacy: () => onOpen('privacy'),
  };
  const signedIn = (found: Account) => {
    onAccount(found);
    onOpen(null);
  };
  // Only known results become text; the address bar can never inject a message.
  const notices: Record<string, string> = {
    'google-unavailable': t.errors.googleUnavailable,
    'google-failed': t.errors.googleFailed,
    'google-cancelled': t.errors.googleFailed,
    'signed-out': t.signedOut,
    deleted: t.deleted,
  };
  const notice = notices[noticeKey] ?? '';
  if (screen === 'privacy') return <PrivacyView t={t} headingRef={headingRef} />;
  if (screen === 'signup') return <SignUpView {...common} onSignedIn={signedIn} />;
  if (screen === 'google-new') return <GoogleNewView {...common} onSignedIn={signedIn} />;
  if (screen === 'profile' && account)
    return (
      <ProfileView
        {...common}
        account={account}
        onAccount={onAccount}
        onSignedOut={(reason) => {
          onAccount(null);
          onOpen('signin', reason);
        }}
      />
    );
  return (
    <SignInView
      {...common}
      googleReady={googleReady}
      notice={notice}
      onCreate={() => onOpen('signup')}
      onSignedIn={signedIn}
    />
  );
}
