import { useRef } from 'react';
import type { Copy } from './i18n';
import { useModalFocus } from './useModalFocus';

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
  const onKeyDown = useModalFocus(dialogRef, { onEscape: onStay, restoreTo: 'opener' });
  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="leave-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-title"
        aria-describedby="leave-description"
        onKeyDown={onKeyDown}
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
