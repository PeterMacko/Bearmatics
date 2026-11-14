import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { Copy } from '../i18n';
import MenuHeading from '../MenuHeading';
import BearIcon from './BearIcon';
import * as api from './api';
import { AccountError, type Account } from './api';
import { passwordKey } from './passwordKey';
import { BEARS, validEmail, validNickname, validPassword, validUsername } from './rules';

export type AccountScreen = 'signin' | 'signup' | 'profile' | 'google-new' | 'privacy';
type T = Copy['account'];

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

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
    default:
      return t.errors.generic;
  }
}

/** Runs one request at a time with a busy flag and a single message line. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const run = async (work: () => Promise<void>, onError: (e: unknown) => string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      await work();
    } catch (e) {
      setError(onError(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, note, setError, setNote, run };
}

function Message({ error, note }: { error: string; note?: string }) {
  return (
    <>
      <p className="account-error" role="alert">
        {error}
      </p>
      {note ? (
        <p className="account-note" role="status">
          {note}
        </p>
      ) : null}
    </>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  autoComplete,
  invalid,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  invalid?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="account-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <span id={`${id}-hint`} className="account-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function BearPicker({
  t,
  value,
  onChange,
}: {
  t: T;
  value: number;
  onChange: (bear: number) => void;
}) {
  const name = useId();
  return (
    <fieldset className="bear-picker">
      <legend>{t.chooseBear}</legend>
      <div className="bear-options">
        {BEARS.map((bear) => (
          <label key={bear} className="bear-option" title={t.bears[bear - 1]}>
            <input
              type="radio"
              name={name}
              value={bear}
              checked={value === bear}
              aria-label={t.bears[bear - 1]}
              onChange={() => onChange(bear)}
            />
            <BearIcon bear={bear} size={52} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ParentCheck({
  t,
  checked,
  onChange,
  onPrivacy,
}: {
  t: T;
  checked: boolean;
  onChange: (value: boolean) => void;
  onPrivacy: () => void;
}) {
  const id = useId();
  return (
    <div className="parent-check">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>{t.parent}</label>
      <button type="button" className="link-button" onClick={onPrivacy}>
        {t.privacyLink}
      </button>
    </div>
  );
}

function Screen({
  t,
  title,
  intro,
  headingRef,
  backLabel,
  onBack,
  children,
}: {
  t: T;
  title: string;
  intro: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className="account-screen">
      <MenuHeading
        eyebrow={t.eyebrow}
        title={title}
        intro={intro}
        headingRef={headingRef}
        backLabel={backLabel}
        onBack={onBack}
      />
      {children}
    </section>
  );
}

type Common = {
  t: T;
  backLabel: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onPrivacy: () => void;
};

export function SignInView({
  t,
  backLabel,
  headingRef,
  onBack,
  onPrivacy,
  googleReady,
  notice,
  onCreate,
  onSignedIn,
}: Common & {
  googleReady: boolean;
  notice: string;
  onCreate: () => void;
  onSignedIn: (account: Account) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(
      async () => onSignedIn(await api.signIn(username, await passwordKey(username, password))),
      (e) => errorText(t, e),
    );
  };
  return (
    <Screen
      t={t}
      title={t.signInTitle}
      intro={t.signInIntro}
      headingRef={headingRef}
      backLabel={backLabel}
      onBack={onBack}
    >
      {googleReady && (
        <>
          <a className="google-button" href="/api/auth/google/start">
            <span aria-hidden="true" className="google-mark">
              G
            </span>
            {t.google}
          </a>
          <p className="account-or">{t.or}</p>
        </>
      )}
      <form className="account-form" onSubmit={submit} noValidate aria-busy={busy}>
        <Field
          label={t.username}
          value={username}
          onChange={setUsername}
          autoComplete="username"
          maxLength={20}
        />
        <Field
          label={t.password}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <Message error={error} note={error ? '' : notice} />
        <button className="primary account-submit" type="submit" disabled={busy}>
          {busy ? t.working : t.submitSignIn}
        </button>
      </form>
      <p className="account-switch">
        {t.noAccount}{' '}
        <button type="button" className="link-button" onClick={onCreate}>
          {t.createAccount}
        </button>
      </p>
      <p className="account-switch">
        <button type="button" className="link-button" onClick={onPrivacy}>
          {t.privacyLink}
        </button>
      </p>
    </Screen>
  );
}

export function SignUpView({
  t,
  backLabel,
  headingRef,
  onBack,
  onPrivacy,
  onSignedIn,
}: Common & { onSignedIn: (account: Account) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [bear, setBear] = useState(1);
  const [parent, setParent] = useState(false);
  const [checked, setChecked] = useState(false);
  const { busy, error, setError, run } = useAction();
  const problem = !validUsername(username)
    ? t.errors.username
    : !validPassword(password)
      ? t.errors.password
      : password !== again
        ? t.errors.mismatch
        : !validEmail(email)
          ? t.errors.email
          : !validNickname(nickname)
            ? t.errors.nickname
            : !parent
              ? t.errors.parent
              : '';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (problem) {
      setError(problem);
      return;
    }
    void run(
      async () =>
        onSignedIn(
          await api.signUp({
            username,
            key: await passwordKey(username, password),
            email: email.trim(),
            nickname: nickname.trim(),
            bear,
            parentConfirmed: parent,
          }),
        ),
      (e) => errorText(t, e),
    );
  };
  return (
    <Screen
      t={t}
      title={t.createTitle}
      intro={t.createIntro}
      headingRef={headingRef}
      backLabel={backLabel}
      onBack={onBack}
    >
      <form className="account-form" onSubmit={submit} noValidate aria-busy={busy}>
        <Field
          label={t.username}
          hint={t.usernameHint}
          value={username}
          onChange={setUsername}
          autoComplete="username"
          maxLength={20}
          invalid={checked && !validUsername(username)}
        />
        <Field
          label={t.password}
          hint={t.passwordHint}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          invalid={checked && !validPassword(password)}
        />
        <Field
          label={t.passwordAgain}
          type="password"
          value={again}
          onChange={setAgain}
          autoComplete="new-password"
          invalid={checked && password !== again}
        />
        <p className="account-note">{t.writeDown}</p>
        <Field
          label={t.email}
          hint={t.emailHint}
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          maxLength={254}
          invalid={checked && !validEmail(email)}
        />
        <Field
          label={t.nickname}
          hint={t.nicknameHint}
          value={nickname}
          onChange={setNickname}
          autoComplete="off"
          maxLength={20}
          invalid={checked && !validNickname(nickname)}
        />
        <BearPicker t={t} value={bear} onChange={setBear} />
        <ParentCheck t={t} checked={parent} onChange={setParent} onPrivacy={onPrivacy} />
        <Message error={error} />
        <button className="primary account-submit" type="submit" disabled={busy}>
          {busy ? t.working : t.createAccount}
        </button>
      </form>
    </Screen>
  );
}

export function GoogleNewView({
  t,
  backLabel,
  headingRef,
  onBack,
  onPrivacy,
  onSignedIn,
}: Common & { onSignedIn: (account: Account) => void }) {
  const [nickname, setNickname] = useState('');
  const [bear, setBear] = useState(1);
  const [parent, setParent] = useState(false);
  const { busy, error, setError, run } = useAction();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = !validNickname(nickname) ? t.errors.nickname : !parent ? t.errors.parent : '';
    if (problem) {
      setError(problem);
      return;
    }
    void run(
      async () =>
        onSignedIn(
          await api.completeGoogle({ nickname: nickname.trim(), bear, parentConfirmed: parent }),
        ),
      (e) => errorText(t, e),
    );
  };
  return (
    <Screen
      t={t}
      title={t.googleNewTitle}
      intro={t.googleNewIntro}
      headingRef={headingRef}
      backLabel={backLabel}
      onBack={onBack}
    >
      <form className="account-form" onSubmit={submit} noValidate aria-busy={busy}>
        <Field
          label={t.nickname}
          hint={t.nicknameHint}
          value={nickname}
          onChange={setNickname}
          autoComplete="off"
          maxLength={20}
        />
        <BearPicker t={t} value={bear} onChange={setBear} />
        <ParentCheck t={t} checked={parent} onChange={setParent} onPrivacy={onPrivacy} />
        <Message error={error} />
        <button className="primary account-submit" type="submit" disabled={busy}>
          {busy ? t.working : t.continueLabel}
        </button>
      </form>
    </Screen>
  );
}

export function ProfileView({
  t,
  backLabel,
  headingRef,
  onBack,
  onPrivacy,
  account,
  onAccount,
  onSignedOut,
}: Common & {
  account: Account;
  onAccount: (account: Account) => void;
  onSignedOut: (reason: 'signed-out' | 'deleted') => void;
}) {
  const [nickname, setNickname] = useState(account.nickname);
  const [bear, setBear] = useState(account.bear);
  const [email, setEmail] = useState(account.email ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const look = useAction();
  const mail = useAction();
  const pass = useAction();
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
  const saveLook = (event: FormEvent) => {
    event.preventDefault();
    if (!validNickname(nickname)) return look.setError(t.errors.nickname);
    void look.run(async () => {
      onAccount(await api.updateProfile({ nickname: nickname.trim(), bear }));
      look.setNote(t.saved);
    }, onError);
  };
  const saveEmail = (value: string | null) => {
    if (value !== null && (value.trim() === '' || !validEmail(value))) {
      return mail.setError(t.errors.email);
    }
    void mail.run(async () => {
      const updated = await api.updateProfile({ email: value === null ? null : value.trim() });
      onAccount(updated);
      setEmail(updated.email ?? '');
      mail.setNote(value === null ? t.emailRemoved : t.saved);
    }, onError);
  };
  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    if (!validPassword(next)) return pass.setError(t.errors.password);
    if (next !== again) return pass.setError(t.errors.mismatch);
    const username = account.username ?? '';
    void pass.run(async () => {
      await api.changePassword(
        await passwordKey(username, current),
        await passwordKey(username, next),
      );
      setCurrent('');
      setNext('');
      setAgain('');
      pass.setNote(t.passwordChanged);
    }, onError);
  };
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
      backLabel={backLabel}
      onBack={onBack}
    >
      <div className="profile-badge" aria-hidden="true">
        <BearIcon bear={account.bear} size={72} />
      </div>
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
        <button className="primary account-submit" type="submit" disabled={look.busy}>
          {look.busy ? t.working : t.save}
        </button>
      </form>
      {account.kind === 'password' && (
        <>
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
              <button className="primary account-submit" type="submit" disabled={mail.busy}>
                {t.saveEmail}
              </button>
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
            <button className="primary account-submit" type="submit" disabled={pass.busy}>
              {pass.busy ? t.working : t.changePassword}
            </button>
          </form>
        </>
      )}
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
        <button type="button" className="link-button" onClick={onPrivacy}>
          {t.privacyLink}
        </button>
      </div>
    </Screen>
  );
}

const LINK = /(https:\/\/\S+[^\s.])/;

export function PrivacyView({ t, backLabel, headingRef, onBack }: Omit<Common, 'onPrivacy'>) {
  return (
    <Screen
      t={t}
      title={t.privacyTitle}
      intro={t.privacy[0]}
      headingRef={headingRef}
      backLabel={backLabel}
      onBack={onBack}
    >
      <ul className="privacy-list">
        {t.privacy.slice(1).map((line) => (
          <li key={line}>
            {line.split(LINK).map((part, index) =>
              LINK.test(part) ? (
                <a key={index} href={part} target="_blank" rel="noreferrer">
                  {part}
                </a>
              ) : (
                part
              ),
            )}
          </li>
        ))}
      </ul>
    </Screen>
  );
}

/** Header button on the course choice screen: "Sign in", or the bear and nickname. */
export function AccountButton({
  t,
  account,
  onClick,
}: {
  t: T;
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
        <BearIcon bear={account.bear} size={32} />
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
