import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

export default function HintDialog({ title, closeLabel, nextLabel, nextDisabled, onClose, onNext, triggerRef, children }: {
  title: string; closeLabel: string; nextLabel: string; nextDisabled: boolean;
  onClose: () => void; onNext: () => void; triggerRef: RefObject<HTMLButtonElement | null>; children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = triggerRef.current;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, [triggerRef]);
  return <div className="modal-backdrop hint-backdrop"><div ref={dialogRef} className="hint-dialog" role="dialog" aria-modal="true" aria-labelledby="hint-title" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}><div className="hint-dialog-header"><h2 id="hint-title">{title}</h2><button type="button" onClick={onClose}>{closeLabel}</button></div>
    <div className="hint-dialog-content" tabIndex={0}>{children}</div>
    <div className="hint-dialog-actions"><button type="button" disabled={nextDisabled} onClick={onNext}>{nextLabel}</button></div>
  </div></div>;
}
