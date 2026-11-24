import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useModalFocus } from './useModalFocus';
import { useShadeClose } from './useShadeClose';

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
  settleMs = 0,
}: {
  title: string;
  closeLabel: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  titleId?: string;
  /** A tap on the shade outside the window closes it (leaderboard, badge details). */
  closeOnShade?: boolean;
  /** Shade taps this soon after opening are ignored (a double tap on the opener, SCRUM-281). */
  settleMs?: number;
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
  // A tap on the shade closes (start and end on the shade; stray second taps swallowed).
  const { shadeProps } = useShadeClose(onClose, { enabled: closeOnShade, settleMs });
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
