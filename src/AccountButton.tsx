import { fill, type Copy } from './i18n';
import BearIcon from './account/BearIcon';
import type { Account } from './account/api';

/** App bar button: "Sign in", or the bear and nickname (opens the profile). */
export function AccountButton({
  t,
  account,
  onClick,
}: {
  t: Copy['account'];
  account: Account | null;
  onClick: () => void;
}) {
  const label = account ? fill(t.profileButton, { name: account.nickname }) : t.signIn;
  return (
    <button
      type="button"
      className={`account-button ${account ? 'signed-in' : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {account ? (
        <BearIcon look={account.look} size={32} />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="account-person">
          <circle cx="12" cy="8" r="4" fill="currentColor" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor" />
        </svg>
      )}
      <span className="account-button-text">{account ? account.nickname : t.signIn}</span>
    </button>
  );
}
