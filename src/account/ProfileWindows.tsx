// SCRUM-281: the profile's small windows. Every change happens in one of them. X, Cancel, Escape
// or a tap on the dark background outside (Peter's review) close them without saving.
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import HintDialog from '../HintDialog';
import Icon from '../Icon';
import { fill } from '../i18n';
import { ignoreSettlingTap, SCREEN_SETTLE_MS } from '../tapGuard';
import * as api from './api';
import type { Account } from './api';
import { CheckRow, Field, Message, useAction, type T } from './fields';
import { checkGrownUp, grownUpQuestion } from './grownUp';
import { passwordKey } from './passwordKey';
import { errorText, nicknameProblem } from './problems';
import { validEmail, validPassword } from './rules';

/** What every window gets: closing it, and where focus goes back to. */
type WindowProps = {
  t: T;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
};

/** Edit windows also save: `onDone(note)` closes the window and announces the note. */
type EditProps = WindowProps & {
  account: Account;
  onAccount: (account: Account) => void;
  onDone: (note: string) => void;
};

/** A press counts only after the window has been open this long (double-tap guard). */

/**
 * iPhone and iPad keep the page and cover it with the on-screen keyboard (only the visual
 * viewport shrinks): the window then stays inside the visible part and scrolls inside, so its
 * buttons can be reached. Android shrinks the page itself, which `100dvh` already follows.
 */
function useVisibleWindow(inside: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const backdrop = inside.current?.closest<HTMLElement>('.modal-backdrop');
    const view = window.visualViewport;
    if (!backdrop || !view) return;
    const fit = () => {
      const covered = window.innerHeight - view.height > 1 || view.offsetTop > 0;
      if (covered && view.scale <= 1.01) {
        backdrop.style.top = `${view.offsetTop}px`;
        backdrop.style.bottom = 'auto';
        backdrop.style.height = `${view.height}px`;
        backdrop.style.setProperty('--window-height', `${view.height}px`);
      } else {
        backdrop.style.removeProperty('top');
        backdrop.style.removeProperty('bottom');
        backdrop.style.removeProperty('height');
        backdrop.style.removeProperty('--window-height');
      }
    };
    fit();
    view.addEventListener('resize', fit);
    view.addEventListener('scroll', fit);
    return () => {
      view.removeEventListener('resize', fit);
      view.removeEventListener('scroll', fit);
    };
  }, [inside]);
}

/** The window frame: title, X, a form with the content, the error line and the buttons. */
function ProfileWindow({
  t,
  name,
  title,
  triggerRef,
  onClose,
  onSubmit,
  busy,
  error,
  errorKey,
  children,
  actions,
}: WindowProps & {
  name: string;
  title: string;
  onSubmit: () => void;
  busy: boolean;
  error: string;
  /** Changes when the same message is shown again, so it is announced again. */
  errorKey?: number;
  children: ReactNode;
  actions: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  useVisibleWindow(form);
  return (
    <HintDialog
      titleId={`profile-${name}-title`}
      title={title}
      closeLabel={t.closeWindow}
      onClose={onClose}
      triggerRef={triggerRef}
      closeOnShade
      settleMs={SCREEN_SETTLE_MS}
    >
      <form
        ref={form}
        className={`profile-window profile-window-${name}`}
        noValidate
        aria-busy={busy}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        <Message key={errorKey} error={error} />
        <div className="account-actions profile-window-actions">{actions}</div>
      </form>
    </HintDialog>
  );
}

/** Save (tick) and Cancel (cross). Save is never `disabled` while saving (focus would drop). */
function SaveCancel({ t, busy, onCancel }: { t: T; busy: boolean; onCancel: () => void }) {
  return (
    <>
      <button type="submit" className="primary" aria-disabled={busy || undefined}>
        <Icon name="tick" />
        {busy ? t.working : t.save}
      </button>
      <button type="button" className="secondary" onClick={onCancel}>
        <Icon name="cross" />
        {t.look.cancel}
      </button>
    </>
  );
}

export function NicknameWindow({ t, account, onAccount, onDone, triggerRef, onClose }: EditProps) {
  const [nickname, setNickname] = useState(account.nickname);
  const save = useAction();
  const submit = () => {
    if (save.busy) return;
    const problem = nicknameProblem(t, nickname);
    if (problem) return save.setError(problem);
    void save.run(
      async () => {
        onAccount(await api.updateProfile({ nickname: nickname.trim() }));
        onDone(t.saved);
      },
      (e) => errorText(t, e),
    );
  };
  return (
    <ProfileWindow
      t={t}
      name="nickname"
      title={t.changeNickname}
      triggerRef={triggerRef}
      onClose={onClose}
      onSubmit={submit}
      busy={save.busy}
      error={save.error}
      actions={<SaveCancel t={t} busy={save.busy} onCancel={onClose} />}
    >
      <Field
        label={t.nickname}
        hint={t.nicknameHint}
        value={nickname}
        onChange={setNickname}
        autoComplete="off"
        maxLength={20}
        first
      />
    </ProfileWindow>
  );
}

export function EmailWindow({ t, account, onAccount, onDone, triggerRef, onClose }: EditProps) {
  const [email, setEmail] = useState(account.email ?? '');
  const save = useAction();
  const saveEmail = (value: string | null) => {
    if (save.busy) return;
    if (value !== null && (value.trim() === '' || !validEmail(value))) {
      return save.setError(t.errors.email);
    }
    void save.run(
      async () => {
        onAccount(await api.updateProfile({ email: value === null ? null : value.trim() }));
        onDone(value === null ? t.emailRemoved : t.saved);
      },
      (e) => errorText(t, e),
    );
  };
  return (
    <ProfileWindow
      t={t}
      name="email"
      title={t.changeEmail}
      triggerRef={triggerRef}
      onClose={onClose}
      onSubmit={() => saveEmail(email)}
      busy={save.busy}
      error={save.error}
      actions={
        <>
          <SaveCancel t={t} busy={save.busy} onCancel={onClose} />
          {account.email && (
            <button
              type="button"
              className="secondary profile-remove-email"
              aria-disabled={save.busy || undefined}
              onClick={() => saveEmail(null)}
            >
              {t.removeEmail}
            </button>
          )}
        </>
      }
    >
      <Field
        label={t.email}
        hint={t.emailHint}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        maxLength={254}
        first
      />
    </ProfileWindow>
  );
}

/** Shown on the leaderboard or not: saved only on Save (SCRUM-281; before, at once). */
export function LeaderboardWindow({
  t,
  account,
  onAccount,
  onDone,
  triggerRef,
  onClose,
}: EditProps) {
  const id = useId();
  const [on, setOn] = useState(account.leaderboard);
  const save = useAction();
  const submit = () => {
    if (save.busy) return;
    void save.run(
      async () => {
        onAccount(await api.updateProfile({ leaderboard: on }));
        onDone(t.saved);
      },
      (e) => errorText(t, e),
    );
  };
  return (
    <ProfileWindow
      t={t}
      name="leaderboard"
      title={t.leaderboardTitle}
      triggerRef={triggerRef}
      onClose={onClose}
      onSubmit={submit}
      busy={save.busy}
      error={save.error}
      actions={<SaveCancel t={t} busy={save.busy} onCancel={onClose} />}
    >
      <CheckRow
        id={id}
        label={t.leaderboardSwitch}
        checked={on}
        busy={save.busy}
        describedBy={`${id}-hint`}
        onChange={(value) => {
          if (!save.busy) setOn(value);
        }}
        first
      />
      <p className="account-hint" id={`${id}-hint`}>
        {t.leaderboardHint}
      </p>
    </ProfileWindow>
  );
}

export function PasswordWindow({
  t,
  account,
  onDone,
  triggerRef,
  onClose,
}: Omit<EditProps, 'onAccount'>) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const save = useAction();
  const submit = () => {
    if (save.busy) return;
    if (!validPassword(next)) return save.setError(t.errors.password);
    if (next !== again) return save.setError(t.errors.mismatch);
    const username = account.username ?? '';
    void save.run(
      async () => {
        await api.changePassword(
          await passwordKey(username, current),
          await passwordKey(username, next),
        );
        onDone(t.passwordChanged);
      },
      (e) => errorText(t, e),
    );
  };
  return (
    <ProfileWindow
      t={t}
      name="password"
      title={t.passwordTitle}
      triggerRef={triggerRef}
      onClose={onClose}
      onSubmit={submit}
      busy={save.busy}
      error={save.error}
      actions={<SaveCancel t={t} busy={save.busy} onCancel={onClose} />}
    >
      <Field
        label={t.currentPassword}
        type="password"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        first
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
    </ProfileWindow>
  );
}

/**
 * Sign out or Delete account, only after a grown-up answers a³ + b (a new question each time the
 * window opens and after a wrong answer; nothing is stored).
 */
export function GrownUpWindow({
  t,
  kind,
  random,
  triggerRef,
  onClose,
  onSignedOut,
}: WindowProps & {
  kind: 'sign-out' | 'delete';
  random: () => number;
  onSignedOut: (reason: 'signed-out' | 'deleted') => void;
}) {
  const [question, setQuestion] = useState(() => grownUpQuestion(random));
  const [answer, setAnswer] = useState('');
  const [tries, setTries] = useState(0);
  const leave = useAction();
  const field = useRef<HTMLInputElement>(null);
  const id = useId();
  // A double tap on Sign out / Delete account must not press the window's button below it.
  const openedAt = useRef<number | null>(null);
  useEffect(() => {
    openedAt.current = performance.now();
  }, []);
  const deleting = kind === 'delete';
  const act = () => {
    if (leave.busy) return;
    const result = checkGrownUp(question, answer);
    if (result !== 'right') {
      if (result === 'wrong') {
        setQuestion(grownUpQuestion(random));
        setAnswer('');
      }
      leave.setError(result === 'wrong' ? t.grownUpWrong : t.grownUpEmpty);
      setTries((n) => n + 1);
      field.current?.focus();
      return;
    }
    void leave.run(
      async () => {
        if (deleting) await api.deleteAccount();
        else await api.signOut();
        onSignedOut(deleting ? 'deleted' : 'signed-out');
      },
      (e) => errorText(t, e),
    );
  };
  const actLabel = deleting ? t.deleteConfirm : t.signOut;
  const actButton = (
    <button
      type="submit"
      className={deleting ? 'danger-button' : 'primary'}
      aria-disabled={leave.busy || undefined}
      onClick={(event) => {
        // The keyboard waits too (Enter right after opening is the opener's Enter).
        if (ignoreSettlingTap(event, openedAt.current, 'wait')) return;
      }}
    >
      <Icon name={deleting ? 'bin' : 'door'} />
      {leave.busy ? t.working : actLabel}
    </button>
  );
  const cancelButton = (
    <button
      type="button"
      className={deleting ? 'primary' : 'secondary'}
      data-autofocus={deleting || undefined}
      onClick={onClose}
    >
      {!deleting && <Icon name="cross" />}
      {deleting ? t.keep : t.look.cancel}
    </button>
  );
  return (
    <ProfileWindow
      t={t}
      name={kind}
      title={deleting ? t.deleteAccount : t.signOut}
      triggerRef={triggerRef}
      onClose={onClose}
      onSubmit={act}
      busy={leave.busy}
      error={leave.error}
      errorKey={tries}
      actions={
        deleting ? (
          <>
            {cancelButton}
            {actButton}
          </>
        ) : (
          <>
            {actButton}
            {cancelButton}
          </>
        )
      }
    >
      {deleting && <p className="profile-warning">{t.deleteWarning}</p>}
      <p className="grown-up-ask">{t.grownUpAsk}</p>
      <div className="account-field grown-up-field">
        <label htmlFor={id}>
          <span className="grown-up-question" aria-hidden="true">
            {question.a}³ + {question.b} = ?
          </span>
          <span className="sr-only">{fill(t.grownUpSaid, question)}</span>
        </label>
        <input
          ref={field}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="go"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={4}
          value={answer}
          data-autofocus={deleting ? undefined : true}
          data-1p-ignore=""
          data-lpignore="true"
          onChange={(event) => setAnswer(event.target.value)}
        />
      </div>
    </ProfileWindow>
  );
}
