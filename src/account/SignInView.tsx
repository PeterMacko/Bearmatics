import { useState, type FormEvent } from 'react';
import * as api from './api';
import type { Account } from './api';
import {
  Field,
  GoogleButton,
  Message,
  PrivacyLink,
  Screen,
  SubmitButton,
  useAction,
  type Common,
} from './fields';
import { passwordKey } from './passwordKey';
import { errorText } from './problems';

export function SignInView({
  t,
  headingRef,
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
    <Screen t={t} title={t.signInTitle} intro={t.signInIntro} headingRef={headingRef}>
      {googleReady && (
        <>
          <GoogleButton t={t} />
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
        <SubmitButton busy={busy} label={t.submitSignIn} working={t.working} />
      </form>
      <p className="account-switch">
        {t.noAccount}{' '}
        <button type="button" className="link-button" onClick={onCreate}>
          {t.createAccount}
        </button>
      </p>
      <p className="account-switch">
        <PrivacyLink t={t} onPrivacy={onPrivacy} />
      </p>
    </Screen>
  );
}
