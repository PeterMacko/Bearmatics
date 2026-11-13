import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

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
}: {
  title: string;
  closeLabel: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  titleId?: string;
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
  useEffect(() => {
    const trigger = triggerRef.current;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [triggerRef]);
  return (
    <div className="modal-backdrop hint-backdrop">
      <div
        ref={dialogRef}
        id={titleId === 'hint-title' ? 'hint-dialog' : 'settings-dialog'}
        className="hint-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
          if (event.key === 'Tab') {
            const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), [tabindex="0"]',
            );
            if (!controls?.length) return;
            const first = controls[0],
              last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
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
