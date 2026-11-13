import { useEffect, useRef } from 'react';
import type { Copy } from './i18n';

/** Modal asking whether to leave an unfinished session. */
export default function LeaveDialog({
  t,
  onStay,
  onLeave,
}: {
  t: Copy;
  onStay: () => void;
  onLeave: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Focus the first button on open; return focus to the opener on close.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="leave-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-title"
        aria-describedby="leave-description"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onStay();
          }
          if (event.key === 'Tab') {
            const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button');
            if (!buttons?.length) return;
            const first = buttons[0],
              last = buttons[buttons.length - 1];
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
        <h2 id="leave-title">{t.leaveTitle}</h2>
        <p id="leave-description">{t.leaveText}</p>
        <button className="primary" onClick={onStay}>
          {t.stay}
        </button>
        <button className="text-button" onClick={onLeave}>
          {t.leave}
        </button>
      </div>
    </div>
  );
}
