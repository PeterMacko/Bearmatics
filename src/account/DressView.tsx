// SCRUM-249: "Dress your bear" (parts, live preview, Surprise me, Save/Cancel) and the sign-up
// choice of 4 random looks with Customize.
import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import {
  LOOK_PARTS,
  PART_COUNTS,
  randomLook,
  randomLooks,
  sameLook,
  type BearLook,
  type LookPart,
} from '../../shared/bearLook';
import Icon from '../Icon';
import MenuHeading from '../MenuHeading';
import BearIcon from './BearIcon';
import { describeLook } from './bearLook';
import LookPartIcon from './LookPartIcon';
import { useDressLayout } from './useDressLayout';
import { Message, useAction, type T } from './fields';
import { errorText } from './problems';

/** Tells App that a sub-screen is open (`close` cancels it, used by the bar's Back). */
type SubView = (close: (() => void) | null) => void;

/**
 * The dress screen opened from a form: while open the form is replaced (its state is kept by
 * the parent), Back in the bar cancels it, and closing it puts focus back on the opener.
 */
export function useDressing(onSubView?: SubView) {
  const [dressing, setDressing] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (dressing) {
      wasOpen.current = true;
      onSubView?.(() => setDressing(false));
    } else if (wasOpen.current) {
      wasOpen.current = false;
      onSubView?.(null);
      opener.current?.focus();
    }
  }, [dressing, onSubView]);
  // Leaving the whole screen while dressing: the bar's Back must not keep the old close.
  useEffect(() => () => onSubView?.(null), [onSubView]);
  return {
    dressing,
    opener,
    open: () => setDressing(true),
    close: () => setDressing(false),
  };
}

/** One part (fur, background, ...): a radio group; each choice shows only that part (SCRUM-273). */
function PartChoices({
  t,
  part,
  look,
  onChange,
}: {
  t: T;
  part: LookPart;
  look: BearLook;
  onChange: (look: BearLook) => void;
}) {
  const name = useId();
  const names: readonly string[] = t.look[part];
  return (
    <fieldset className="look-part">
      <legend>{t.look.parts[part]}</legend>
      <div className="look-options">
        {Array.from({ length: PART_COUNTS[part] }, (_, index) => {
          const option = { ...look, [part]: index };
          return (
            <label key={index} className="look-option" title={names[index]}>
              <input
                type="radio"
                name={name}
                value={index}
                checked={look[part] === index}
                aria-label={names[index]}
                onChange={() => onChange(option)}
              />
              <LookPartIcon part={part} index={index} size={44} />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function DressView({
  t,
  initial,
  onSave,
  onCancel,
}: {
  t: T;
  initial: BearLook;
  /** Saves the look (may throw an AccountError); the caller closes the screen afterwards. */
  onSave: (look: BearLook) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [look, setLook] = useState(initial);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const action = useAction();
  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(
      async () => onSave(look),
      (e) => errorText(t, e),
    );
  };
  const surprise = () => {
    let next = randomLook();
    while (sameLook(next, look)) next = randomLook();
    setLook(next);
  };
  // SCRUM-273: heading, big bear and Save | Cancel stay in view; only the choices scroll.
  const screenRef = useDressLayout(t.look.dress);
  return (
    <section ref={screenRef} className="account-screen dress-screen">
      <MenuHeading
        eyebrow={t.eyebrow}
        title={t.look.dress}
        intro={t.look.dressIntro}
        headingRef={headingRef}
      />
      <form
        className="account-form dress-form"
        onSubmit={submit}
        onKeyDown={(event) => {
          // QA256-01: Enter on a choice would submit the form (save and close); only Save does.
          if (event.key === 'Enter' && (event.target as HTMLElement).matches('input[type="radio"]'))
            event.preventDefault();
        }}
        noValidate
        aria-busy={action.busy}
      >
        <div className="dress-preview">
          <BearIcon look={look} size={120} label={describeLook(t.look, look)} />
          <button className="secondary-button" type="button" onClick={surprise}>
            <Icon name="wand" />
            {t.look.surprise}
          </button>
        </div>
        {/* tabIndex -1: Firefox would make the scrolling pane its own Tab stop (before the
            first choice); the choices inside are reachable and scroll it themselves. */}
        <div className="dress-choices" tabIndex={-1}>
          {LOOK_PARTS.map((part) => (
            <PartChoices key={part} t={t} part={part} look={look} onChange={setLook} />
          ))}
        </div>
        <Message error={action.error} />
        <div className="account-actions dress-actions">
          <button className="primary account-submit" type="submit" disabled={action.busy}>
            <Icon name="tick" />
            {action.busy ? t.working : t.save}
          </button>
          <button className="secondary-button" type="button" onClick={onCancel}>
            <Icon name="cross" />
            {t.look.cancel}
          </button>
        </div>
      </form>
    </section>
  );
}

/** 4 random looks (a new set each time the screen opens), the chosen one and its replacement. */
export function useLookChoice() {
  const [looks, setLooks] = useState(() => randomLooks(4));
  const [chosen, setChosen] = useState(0);
  return {
    looks,
    chosen,
    look: looks[chosen],
    setChosen,
    /** After Customize: the dressed look takes the chosen one's place. */
    replace: (look: BearLook) =>
      setLooks((all) => all.map((old, index) => (index === chosen ? look : old))),
  };
}

/** Sign-up and first Google sign-in: 4 random looks to choose from, and Customize. */
export function LookChoice({
  t,
  looks,
  chosen,
  onChoose,
  onCustomize,
  customizeRef,
}: {
  t: T;
  looks: BearLook[];
  chosen: number;
  onChoose: (index: number) => void;
  onCustomize: () => void;
  customizeRef: RefObject<HTMLButtonElement | null>;
}) {
  const name = useId();
  return (
    <fieldset className="bear-picker">
      <legend>{t.chooseBear}</legend>
      <div className="bear-options">
        {looks.map((look, index) => {
          const label = describeLook(t.look, look);
          return (
            <label key={index} className="bear-option" title={label}>
              <input
                type="radio"
                name={name}
                value={index}
                checked={chosen === index}
                aria-label={label}
                onChange={() => onChoose(index)}
              />
              <BearIcon look={look} size={52} />
            </label>
          );
        })}
      </div>
      <button
        ref={customizeRef}
        className="secondary-button look-customize"
        type="button"
        onClick={onCustomize}
      >
        {t.look.customize}
      </button>
    </fieldset>
  );
}
