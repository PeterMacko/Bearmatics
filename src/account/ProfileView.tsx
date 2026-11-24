import { useId, useRef, useState, type RefObject } from 'react';
import Icon from '../Icon';
import { fill } from '../i18n';
import MenuHeading from '../MenuHeading';
import { BearFullScreen } from './BearFullScreen';
import BearIcon from './BearIcon';
import { describeLook } from './bearLook';
import { DressView, useDressing } from './DressView';
import * as api from './api';
import type { Account } from './api';
import { PrivacyLink, type Common, type T } from './fields';
import {
  EmailWindow,
  GrownUpWindow,
  LeaderboardWindow,
  NicknameWindow,
  PasswordWindow,
} from './ProfileWindows';

type ProfileWindowName = 'nickname' | 'email' | 'leaderboard' | 'password' | 'sign-out' | 'delete';

/**
 * The profile (SCRUM-281): the bear beside the greeting, short read-only rows with a pencil each,
 * then Change password, Sign out and Delete account. Every change happens in a small window;
 * Sign out and Delete account first ask a grown-up question. A tap on the bear shows it full
 * screen.
 */
export function ProfileView({
  t,
  headingRef,
  onPrivacy,
  onSubView,
  account,
  onAccount,
  onSignedOut,
  random = () => Math.random(),
}: Common & {
  account: Account;
  onAccount: (account: Account) => void;
  onSignedOut: (reason: 'signed-out' | 'deleted') => void;
  /** Random source of the grown-up question (tests pass a fixed one). */
  random?: () => number;
}) {
  const {
    dressing,
    opener: dressOpener,
    open: openDress,
    close: closeDress,
  } = useDressing(onSubView);
  // One line for "Saved." and the other results; a live region that is always there.
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<ProfileWindowName | null>(null);
  const nicknameRef = useRef<HTMLButtonElement>(null);
  const emailRef = useRef<HTMLButtonElement>(null);
  const leaderboardRef = useRef<HTMLButtonElement>(null);
  const passwordRef = useRef<HTMLButtonElement>(null);
  const signOutRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const bearRef = useRef<HTMLButtonElement>(null);
  const bearId = useId();
  const [bigBear, setBigBear] = useState(false);
  const show = (name: ProfileWindowName) => {
    setNote('');
    setOpen(name);
  };
  const close = () => setOpen(null);
  const done = (message: string) => {
    setOpen(null);
    setNote(message);
  };
  const password = account.kind === 'password';
  const edit = { t, account, onAccount, onDone: done, onClose: close };
  return (
    <>
      {dressing && (
        <DressView
          t={t}
          initial={account.look}
          onSave={async (look) => {
            onAccount(await api.updateProfile({ look }));
            setNote(t.saved);
            closeDress();
          }}
          onCancel={() => {
            setNote('');
            closeDress();
          }}
        />
      )}
      <div hidden={dressing}>
        <section className="account-screen profile-screen">
          <div className="profile-top">
            <MenuHeading
              eyebrow={t.eyebrow}
              title={fill(t.profileTitle, { name: account.nickname })}
              intro={
                account.kind === 'google'
                  ? t.signedInGoogle
                  : fill(t.signedInAs, { username: account.username ?? '' })
              }
              headingRef={headingRef}
            />
            <div className="profile-bear">
              <button
                ref={bearRef}
                type="button"
                className="profile-bear-button"
                aria-label={t.showBearBig}
                aria-describedby={`${bearId}-look`}
                title={t.showBearBig}
                onClick={() => setBigBear(true)}
              >
                <BearIcon look={account.look} size={72} />
              </button>
              <span id={`${bearId}-look`} className="sr-only">
                {describeLook(t.look, account.look)}
              </span>
              <button
                ref={dressOpener}
                type="button"
                className="profile-dress"
                onClick={() => {
                  setNote('');
                  openDress();
                }}
              >
                <Icon name="pencil" />
                {t.look.dress}
              </button>
            </div>
          </div>
          <dl className="profile-rows">
            <ProfileRow
              label={t.nickname}
              value={account.nickname}
              editLabel={t.changeNickname}
              buttonRef={nicknameRef}
              onEdit={() => show('nickname')}
            />
            {password && (
              <ProfileRow
                label={t.emailRow}
                value={account.email ?? t.noEmail}
                editLabel={t.changeEmail}
                buttonRef={emailRef}
                onEdit={() => show('email')}
              />
            )}
            <ProfileRow
              label={t.leaderboardTitle}
              value={account.leaderboard ? t.yes : t.no}
              editLabel={t.changeLeaderboard}
              buttonRef={leaderboardRef}
              onEdit={() => show('leaderboard')}
            />
          </dl>
          <p className="account-note profile-note" role="status">
            {note}
          </p>
          <ProfileButtons
            t={t}
            password={password}
            passwordRef={passwordRef}
            signOutRef={signOutRef}
            deleteRef={deleteRef}
            onOpen={show}
            onPrivacy={onPrivacy}
          />
        </section>
      </div>
      {bigBear && (
        <BearFullScreen
          look={account.look}
          label={describeLook(t.look, account.look)}
          closeLabel={t.closeWindow}
          triggerRef={bearRef}
          onClose={() => setBigBear(false)}
        />
      )}
      {open === 'nickname' && <NicknameWindow {...edit} triggerRef={nicknameRef} />}
      {open === 'email' && <EmailWindow {...edit} triggerRef={emailRef} />}
      {open === 'leaderboard' && <LeaderboardWindow {...edit} triggerRef={leaderboardRef} />}
      {open === 'password' && <PasswordWindow {...edit} triggerRef={passwordRef} />}
      {(open === 'sign-out' || open === 'delete') && (
        <GrownUpWindow
          t={t}
          kind={open}
          random={random}
          triggerRef={open === 'delete' ? deleteRef : signOutRef}
          onClose={close}
          onSignedOut={onSignedOut}
        />
      )}
    </>
  );
}

/** Label, value and a borderless pencil (48 x 48) that opens the value's window. */
function ProfileRow({
  label,
  value,
  editLabel,
  buttonRef,
  onEdit,
}: {
  label: string;
  value: string;
  editLabel: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onEdit: () => void;
}) {
  return (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd>
        <span className="profile-value">{value}</span>
        <button
          ref={buttonRef}
          type="button"
          className="profile-edit"
          aria-label={editLabel}
          title={editLabel}
          onClick={onEdit}
        >
          <Icon name="pencil" />
        </button>
      </dd>
    </div>
  );
}

/** Change password (password accounts), Sign out, Delete account and the privacy link. */
function ProfileButtons({
  t,
  password,
  passwordRef,
  signOutRef,
  deleteRef,
  onOpen,
  onPrivacy,
}: {
  t: T;
  password: boolean;
  passwordRef: RefObject<HTMLButtonElement | null>;
  signOutRef: RefObject<HTMLButtonElement | null>;
  deleteRef: RefObject<HTMLButtonElement | null>;
  onOpen: (name: ProfileWindowName) => void;
  onPrivacy: () => void;
}) {
  return (
    <div className="account-form account-leave profile-buttons">
      {password && (
        <button
          ref={passwordRef}
          className="secondary-button"
          type="button"
          onClick={() => onOpen('password')}
        >
          <Icon name="key" />
          {t.changePassword}
        </button>
      )}
      <button
        ref={signOutRef}
        className="secondary-button"
        type="button"
        onClick={() => onOpen('sign-out')}
      >
        <Icon name="door" />
        {t.signOut}
      </button>
      <button
        ref={deleteRef}
        className="danger-button"
        type="button"
        onClick={() => onOpen('delete')}
      >
        <Icon name="bin" />
        {t.deleteAccount}
      </button>
      <PrivacyLink t={t} onPrivacy={onPrivacy} />
    </div>
  );
}
