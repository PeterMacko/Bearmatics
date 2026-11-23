import { useState, type FormEvent } from 'react';
import * as api from './api';
import type { Account } from './api';
import {
  BearPicker,
  Field,
  Message,
  ParentCheck,
  Screen,
  SubmitButton,
  useAction,
  type Common,
} from './fields';
import { OLD_BEARS } from '../../shared/bearLook';
import { passwordKey } from './passwordKey';
import { errorText, firstProblem, nicknameProblem } from './problems';
import { validEmail, validPassword, validUsername } from './rules';

export function SignUpView({
  t,
  headingRef,
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
  const nicknameWrong = nicknameProblem(t, nickname);
  const problem = firstProblem([
    !validUsername(username) && t.errors.username,
    !validPassword(password) && t.errors.password,
    password !== again && t.errors.mismatch,
    !validEmail(email) && t.errors.email,
    nicknameWrong,
    !parent && t.errors.parent,
  ]);
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
            look: OLD_BEARS[bear],
            parentConfirmed: parent,
          }),
        ),
      (e) => errorText(t, e),
    );
  };
  return (
    <Screen t={t} title={t.createTitle} intro={t.createIntro} headingRef={headingRef}>
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
          invalid={checked && !!nicknameWrong}
        />
        <BearPicker t={t} value={bear} onChange={setBear} />
        <ParentCheck t={t} checked={parent} onChange={setParent} onPrivacy={onPrivacy} />
        <Message error={error} />
        <SubmitButton busy={busy} label={t.createAccount} working={t.working} />
      </form>
    </Screen>
  );
}
