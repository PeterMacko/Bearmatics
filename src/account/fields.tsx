// Shared pieces of the account screens: fields, messages, buttons and the request runner.
import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Copy } from '../i18n';
import MenuHeading from '../MenuHeading';

export type T = Copy['account'];

/** Props every account screen gets. */
export type Common = {
  t: T;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onPrivacy: () => void;
  /** SCRUM-249: a sub-screen (dress) opened or closed; App's Back then closes it. */
  onSubView?: (close: (() => void) | null) => void;
};

/** Runs one request at a time with a busy flag and a single message line. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  // A ref, not state: a fast double tap must not send the request twice.
  const running = useRef(false);
  const run = async (work: () => Promise<void>, onError: (e: unknown) => string) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    setNote('');
    try {
      await work();
    } catch (e) {
      setError(onError(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return { busy, error, note, setError, setNote, run };
}

export function Message({ error, note }: { error: string; note?: string }) {
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

export function Field({
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

/**
 * A checkbox row (`.parent-check`). The caller owns the id (its `useId` call keeps its place).
 * `busy` marks it aria-disabled instead of `disabled`, which would drop keyboard focus.
 */
export function CheckRow({
  id,
  label,
  checked,
  busy,
  describedBy,
  onChange,
  children,
}: {
  id: string;
  label: string;
  checked: boolean;
  busy?: boolean;
  describedBy?: string;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="parent-check">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-disabled={busy || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function PrivacyLink({ t, onPrivacy }: { t: T; onPrivacy: () => void }) {
  return (
    <button type="button" className="link-button" onClick={onPrivacy}>
      {t.privacyLink}
    </button>
  );
}

/** The parent's confirmation with the privacy link (sign-up and Google completion). */
export function ParentCheck({
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
    <CheckRow id={id} label={t.parent} checked={checked} onChange={onChange}>
      <PrivacyLink t={t} onPrivacy={onPrivacy} />
    </CheckRow>
  );
}

/** The form's main button; `working` replaces the label while the request runs. */
export function SubmitButton({
  busy,
  label,
  working,
}: {
  busy: boolean;
  label: string;
  working?: string;
}) {
  return (
    <button className="primary account-submit" type="submit" disabled={busy}>
      {busy && working !== undefined ? working : label}
    </button>
  );
}

export function GoogleButton({ t }: { t: T }) {
  return (
    <a className="google-button" href="/api/auth/google/start">
      <span aria-hidden="true" className="google-mark">
        G
      </span>
      {t.google}
    </a>
  );
}

export function Screen({
  t,
  title,
  intro,
  headingRef,
  children,
}: {
  t: T;
  title: string;
  intro: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  return (
    <section className="account-screen">
      <MenuHeading eyebrow={t.eyebrow} title={title} intro={intro} headingRef={headingRef} />
      {children}
    </section>
  );
}
