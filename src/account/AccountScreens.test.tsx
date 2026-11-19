import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { copy } from '../i18n';
import AccountScreens from './AccountScreens';
import type { AccountScreen } from './AccountViews';

const t = copy.en.account;
const show = (props: { screen: AccountScreen; notice?: string; signedIn?: boolean }) =>
  render(
    <AccountScreens
      t={t}
      screen={props.screen}
      account={
        props.signedIn
          ? {
              kind: 'password',
              username: 'kid',
              nickname: 'Cub',
              bear: 1,
              email: null,
              leaderboard: true,
            }
          : null
      }
      notice={props.notice ?? ''}
      googleReady={false}
      headingRef={createRef()}
      onAccount={vi.fn()}
      onOpen={vi.fn()}
    />,
  );

describe('AccountScreens', () => {
  it.each([
    ['signin', t.signInTitle],
    ['signup', t.createTitle],
    ['google-new', t.googleNewTitle],
    ['privacy', t.privacyTitle],
  ] as const)('shows the %s screen', (name, title) => {
    show({ screen: name });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(title);
  });

  it('shows the profile only when signed in, else sign in', () => {
    show({ screen: 'profile' });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(t.signInTitle);
  });

  it('turns only known notice keys into text', () => {
    const { unmount } = show({ screen: 'signin', notice: 'google-cancelled' });
    expect(screen.getByRole('status')).toHaveTextContent(t.errors.googleFailed);
    unmount();
    show({ screen: 'signin', notice: '<b>hello</b>' });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
