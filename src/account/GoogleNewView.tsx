import { useState, type FormEvent } from 'react';
import * as api from './api';
import { AccountError, type Account } from './api';
import { DressView, LookChoice, useDressing, useLookChoice } from './DressView';
import {
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
  onSubView,
  onSignedIn,
}: Common & { onSignedIn: (account: Account) => void }) {
  const [nickname, setNickname] = useState('');
  const choice = useLookChoice();
  const dress = useDressing(onSubView);
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
          await api.completeGoogle({
            nickname: nickname.trim(),
            look: choice.look,
            parentConfirmed: parent,
          }),
        ),
      (e) => {
        setExpired(e instanceof AccountError && e.code === 'google_expired');
        return errorText(t, e);
      },
    );
  };
  if (dress.dressing) {
    return (
      <DressView
        t={t}
        initial={choice.look}
        onSave={(look) => {
          choice.replace(look);
          dress.close();
        }}
        onCancel={dress.close}
      />
    );
  }
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
        <LookChoice
          t={t}
          looks={choice.looks}
          chosen={choice.chosen}
          onChoose={choice.setChosen}
          onCustomize={dress.open}
          customizeRef={dress.opener}
        />
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
