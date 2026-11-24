import { useEffect, type KeyboardEvent, type RefObject } from 'react';

/**
 * Focus handling shared by the app's modal dialogs:
 * - on open, the dialog's first button takes focus, or the element marked `data-autofocus`
 *   (a window's first field or its safe button, SCRUM-281);
 * - on close, focus returns to `restoreTo`: a trigger ref (focused without scrolling), or
 *   'opener', the element that had focus when the dialog opened (focused normally);
 * - the returned keydown handler closes on Escape and keeps Tab inside the dialog, also when
 *   focus sits on a non-tabbable element in it (QA154-07);
 * - the dialog itself is focusable by script and mouse (tabindex -1, not in the Tab order), so a
 *   click on its padding or text keeps focus in the dialog instead of dropping it to body, where
 *   Escape and Tab would no longer reach the handler (SCRUM-281 for HintDialog, SCRUM-298 for
 *   every dialog using this hook, e.g. the leave confirmation).
 */
export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  {
    onEscape,
    restoreTo,
  }: { onEscape: () => void; restoreTo: RefObject<HTMLElement | null> | 'opener' },
) {
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
  }, [ref]);
  useEffect(() => {
    const opener =
      restoreTo === 'opener' ? (document.activeElement as HTMLElement | null) : restoreTo.current;
    (
      ref.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      ref.current?.querySelector<HTMLButtonElement>('button')
    )?.focus();
    return () => {
      if (!opener?.isConnected) return;
      if (restoreTo === 'opener') opener.focus();
      else opener.focus({ preventScroll: true });
    };
  }, [ref, restoreTo]);
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape();
    }
    if (event.key === 'Tab') {
      const controls = ref.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || ![...controls].includes(active)) {
        // Focus sits on a non-tabbable element (e.g. the leaderboard box after Try
        // again): the browser would leave the dialog (QA154-07).
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
}
