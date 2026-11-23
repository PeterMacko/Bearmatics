import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { fill } from '../i18n';
import BearIcon from './BearIcon';
import { OLD_BEARS } from '../../shared/bearLook';
import * as api from './api';
import type { Account } from './api';
import {
  BearPicker,
  CheckRow,
  Field,
  Message,
  PrivacyLink,
  Screen,
  SubmitButton,
  useAction,
  type Common,
  type T,
} from './fields';
import { passwordKey } from './passwordKey';
import { errorText, nicknameProblem } from './problems';
import { validEmail, validPassword } from './rules';

type Saves = { t: T; account: Account; onAccount: (account: Account) => void };

export function ProfileView({
  t,
  headingRef,
  onPrivacy,
  account,
  onAccount,
  onSignedOut,
}: Common & {
  account: Account;
  onAccount: (account: Account) => void;
  onSignedOut: (reason: 'signed-out' | 'deleted') => void;
}) {
  // Created here, before the forms' own ids, so every id stays as it was.
  const switchId = useId();
  return (
    <Screen
      t={t}
      title={fill(t.profileTitle, { name: account.nickname })}
      intro={
        account.kind === 'google'
          ? t.signedInGoogle
          : fill(t.signedInAs, { username: account.username ?? '' })
      }
      headingRef={headingRef}
    >
      <div className="profile-badge" aria-hidden="true">
        <BearIcon look={OLD_BEARS[account.bear] ?? OLD_BEARS[1]} size={72} />
      </div>
      <LookForm t={t} account={account} onAccount={onAccount} />
      <LeaderboardSwitch t={t} id={switchId} account={account} onAccount={onAccount} />
      {account.kind === 'password' && (
        <>
          <EmailForm t={t} account={account} onAccount={onAccount} />
          <PasswordForm t={t} account={account} />
        </>
      )}
      <LeaveSection t={t} onSignedOut={onSignedOut} onPrivacy={onPrivacy} />
    </Screen>
  );
}

/** Nickname and bear. */
function LookForm({ t, account, onAccount }: Saves) {
  const [nickname, setNickname] = useState(account.nickname);
  const [bear, setBear] = useState(account.bear);
  const look = useAction();
  const saveLook = (event: FormEvent) => {
    event.preventDefault();
    const problem = nicknameProblem(t, nickname);
    if (problem) return look.setError(problem);
    void look.run(
      async () => {
        onAccount(await api.updateProfile({ nickname: nickname.trim(), bear }));
        look.setNote(t.saved);
      },
      (e) => errorText(t, e),
    );
  };
  return (
    <form className="account-form" onSubmit={saveLook} noValidate aria-busy={look.busy}>
      <h3>{t.profileLook}</h3>
      <Field
        label={t.nickname}
        hint={t.nicknameHint}
        value={nickname}
        onChange={setNickname}
        autoComplete="off"
        maxLength={20}
      />
      <BearPicker t={t} value={bear} onChange={setBear} />
      <Message error={look.error} note={look.note} />
      <SubmitButton busy={look.busy} label={t.save} working={t.working} />
    </form>
  );
}

/** SCRUM-148: shown on the leaderboard or not; switches at once and back if saving fails. */
function LeaderboardSwitch({ t, id, account, onAccount }: Saves & { id: string }) {
  const board = useAction();
  const [boardOn, setBoardOn] = useState(account.leaderboard);
  return (
    <section className="account-form leaderboard-setting" aria-busy={board.busy}>
      <h3>{t.leaderboardTitle}</h3>
      <CheckRow
        id={id}
        label={t.leaderboardSwitch}
        checked={boardOn}
        busy={board.busy}
        describedBy={`${id}-hint`}
        onChange={(leaderboard) => {
          // Not `disabled` while saving: that drops keyboard focus (QA154-05).
          if (board.busy) return;
          setBoardOn(leaderboard); // at once; back if saving fails
          void board.run(
            async () => {
              onAccount(await api.updateProfile({ leaderboard }));
              board.setNote(t.saved);
            },
            (failure) => {
              setBoardOn(!leaderboard);
              return errorText(t, failure);
            },
          );
        }}
      />
      <p className="account-hint" id={`${id}-hint`}>
        {t.leaderboardHint}
      </p>
      <Message error={board.error} note={board.note} />
    </section>
  );
}

/** E-mail for password accounts: save or remove. */
function EmailForm({ t, account, onAccount }: Saves) {
  const [email, setEmail] = useState(account.email ?? '');
  const mail = useAction();
  const saveEmail = (value: string | null) => {
    if (value !== null && (value.trim() === '' || !validEmail(value))) {
      return mail.setError(t.errors.email);
    }
    void mail.run(
      async () => {
        const updated = await api.updateProfile({ email: value === null ? null : value.trim() });
        onAccount(updated);
        setEmail(updated.email ?? '');
        mail.setNote(value === null ? t.emailRemoved : t.saved);
      },
      (e) => errorText(t, e),
    );
  };
  return (
    <form
      className="account-form"
      noValidate
      aria-busy={mail.busy}
      onSubmit={(event) => {
        event.preventDefault();
        saveEmail(email);
      }}
    >
      <h3>{t.emailTitle}</h3>
      <Field
        label={t.email}
        hint={account.email ? t.emailHint : `${t.noEmail} ${t.emailHint}`}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        maxLength={254}
      />
      <Message error={mail.error} note={mail.note} />
      <div className="account-actions">
        <SubmitButton busy={mail.busy} label={t.saveEmail} />
        {account.email && (
          <button
            className="secondary-button"
            type="button"
            disabled={mail.busy}
            onClick={() => saveEmail(null)}
          >
            {t.removeEmail}
          </button>
        )}
      </div>
    </form>
  );
}

/** Password change for password accounts. */
function PasswordForm({ t, account }: Omit<Saves, 'onAccount'>) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const pass = useAction();
  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    if (!validPassword(next)) return pass.setError(t.errors.password);
    if (next !== again) return pass.setError(t.errors.mismatch);
    const username = account.username ?? '';
    void pass.run(
      async () => {
        await api.changePassword(
          await passwordKey(username, current),
          await passwordKey(username, next),
        );
        setCurrent('');
        setNext('');
        setAgain('');
        pass.setNote(t.passwordChanged);
      },
      (e) => errorText(t, e),
    );
  };
  return (
    <form className="account-form" onSubmit={savePassword} noValidate aria-busy={pass.busy}>
      <h3>{t.passwordTitle}</h3>
      <Field
        label={t.currentPassword}
        type="password"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
      />
      <Field
        label={t.newPassword}
        hint={t.passwordHint}
        type="password"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
      />
      <Field
        label={t.newPasswordAgain}
        type="password"
        value={again}
        onChange={setAgain}
        autoComplete="new-password"
      />
      <Message error={pass.error} note={pass.note} />
      <SubmitButton busy={pass.busy} label={t.changePassword} working={t.working} />
    </form>
  );
}

/** Sign out, delete the account (asks first) and the privacy link. */
function LeaveSection({
  t,
  onSignedOut,
  onPrivacy,
}: {
  t: T;
  onSignedOut: (reason: 'signed-out' | 'deleted') => void;
  onPrivacy: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const leave = useAction();
  const keepRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const firstConfirm = useRef(true);
  useEffect(() => {
    if (firstConfirm.current) {
      firstConfirm.current = false;
      return;
    }
    (confirmDelete ? keepRef : deleteRef).current?.focus();
  }, [confirmDelete]);
  const onError = (e: unknown) => errorText(t, e);
  return (
    <div className="account-form account-leave">
      <Message error={leave.error} />
      <button
        className="secondary-button"
        type="button"
        disabled={leave.busy}
        onClick={() =>
          void leave.run(async () => {
            await api.signOut();
            onSignedOut('signed-out');
          }, onError)
        }
      >
        {t.signOut}
      </button>
      {confirmDelete ? (
        <div className="delete-confirm" role="group" aria-label={t.deleteAccount}>
          <p>{t.deleteWarning}</p>
          <div className="account-actions">
            <button
              ref={keepRef}
              className="primary account-submit"
              type="button"
              onClick={() => setConfirmDelete(false)}
            >
              {t.keep}
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={leave.busy}
              onClick={() =>
                void leave.run(async () => {
                  await api.deleteAccount();
                  onSignedOut('deleted');
                }, onError)
              }
            >
              {t.deleteConfirm}
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={deleteRef}
          className="danger-button"
          type="button"
          onClick={() => setConfirmDelete(true)}
        >
          {t.deleteAccount}
        </button>
      )}
      <PrivacyLink t={t} onPrivacy={onPrivacy} />
    </div>
  );
}
