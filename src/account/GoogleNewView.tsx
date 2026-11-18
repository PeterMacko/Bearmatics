import { useState, type FormEvent } from 'react';
import * as api from './api';
import { AccountError, type Account } from './api';
import {
  BearPicker,
  Field,
  GoogleButton,
  Message,
  ParentCheck,
  Screen,
  SubmitButton,
  useAction,
  type Common,
} from './fields';
import { errorText, firstProblem, nicknameProblem } from './problems';

export function GoogleNewView({
  t,
  headingRef,
  onPrivacy,
  onSignedIn,
}: Common & { onSignedIn: (account: Account) => void }) {
  const [nickname, setNickname] = useState('');
  const [bear, setBear] = useState(1);
  const [parent, setParent] = useState(false);
  const { busy, error, setError, run } = useAction();
  const [expired, setExpired] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = firstProblem([nicknameProblem(t, nickname), !parent && t.errors.parent]);
    if (problem) {
      setError(problem);
      return;
    }
    void run(
      async () =>
        onSignedIn(
          await api.completeGoogle({ nickname: nickname.trim(), bear, parentConfirmed: parent }),
        ),
      (e) => {
        setExpired(e instanceof AccountError && e.code === 'google_expired');
        return errorText(t, e);
      },
    );
  };
  return (
    <Screen t={t} title={t.googleNewTitle} intro={t.googleNewIntro} headingRef={headingRef}>
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
        {expired ? (
          <GoogleButton t={t} />
        ) : (
          <SubmitButton busy={busy} label={t.continueLabel} working={t.working} />
        )}
      </form>
    </Screen>
  );
}
