import {
  useLayoutEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useModalFocus } from './useModalFocus';

export default function HintDialog({
  title,
  closeLabel,
  nextLabel,
  nextDisabled,
  onClose,
  onNext,
  triggerRef,
  children,
  titleId = 'hint-title',
  closeOnShade = false,
}: {
  title: string;
  closeLabel: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  titleId?: string;
  /** A tap on the shade outside the window closes it (leaderboard, badge details). */
  closeOnShade?: boolean;
  onClose: () => void;
  onNext?: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!nextDisabled) return;
    const dialog = dialogRef.current;
    // Disabling the focused final-step button can move browser focus to body.
    // Keep Escape and the next Tab inside the modal rather than on inert content.
    const active = document.activeElement;
    if (dialog && (!dialog.contains(active) || active?.matches('button:disabled'))) {
      dialog.querySelector<HTMLButtonElement>('.dialog-close')?.focus({ preventScroll: true });
    }
  }, [nextDisabled]);
  const onKeyDown = useModalFocus(dialogRef, { onEscape: onClose, restoreTo: triggerRef });
  // Only a tap that starts AND ends on the shade closes: a drag (text selection, scrolling the
  // table) that starts inside the window and ends outside must not.
  const downOnShade = useRef(false);
  const shadeProps = closeOnShade
    ? {
        onPointerDown: (event: ReactPointerEvent) => {
          downOnShade.current = event.target === event.currentTarget;
        },
        // Keep focus in the window until it closes, so it returns to the trigger.
        onMouseDown: (event: ReactMouseEvent) => {
          if (event.target === event.currentTarget) event.preventDefault();
        },
        onClick: (event: ReactMouseEvent) => {
          if (event.target !== event.currentTarget || !downOnShade.current) return;
          downOnShade.current = false;
          // Closing uncovers the page under the finger: the second tap of a double tap must not
          // press a button there, so clicks are swallowed for a moment.
          // (mousedown too, or the second press moves focus away from the trigger.)
          const swallow = (press: Event) => {
            press.preventDefault();
            press.stopPropagation();
          };
          const kinds = ['mousedown', 'click', 'dblclick'];
          for (const kind of kinds) document.addEventListener(kind, swallow, true);
          window.setTimeout(() => {
            for (const kind of kinds) document.removeEventListener(kind, swallow, true);
          }, 600);
          onClose();
        },
      }
    : {};
  return (
    <div className="modal-backdrop hint-backdrop" {...shadeProps}>
      <div
        ref={dialogRef}
        id={titleId.replace(/-title$/, '-dialog')}
        className="hint-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <div className="hint-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="dialog-close"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="hint-dialog-content" tabIndex={0}>
          {children}
        </div>
        {onNext && (
          <div className="hint-dialog-actions">
            <button type="button" disabled={nextDisabled} onClick={onNext}>
              {nextLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
