// SCRUM-281 (Peter's review): a tap on the profile bear shows it full screen. Closes on a tap
// anywhere, the X or Escape; uses the shared modal focus and shade-close code.
import { useRef, type RefObject } from 'react';
import type { BearLook } from '../../shared/bearLook';
import { useModalFocus } from '../useModalFocus';
import { STRAY_TAP_MS, useShadeClose } from '../useShadeClose';
import BearIcon from './BearIcon';

export function BearFullScreen({
  look,
  label,
  closeLabel,
  triggerRef,
  onClose,
}: {
  look: BearLook;
  /** The look described: the picture's (and the view's) spoken name. */
  label: string;
  closeLabel: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = useModalFocus(ref, { onEscape: onClose, restoreTo: triggerRef });
  // Any tap closes; the second tap of a double tap on the bear button (within 600 ms) does not.
  const { shadeProps, close } = useShadeClose(onClose, { anywhere: true, settleMs: STRAY_TAP_MS });
  return (
    <div
      ref={ref}
      className="bear-full"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={onKeyDown}
      {...shadeProps}
    >
      <BearIcon look={look} size={64} label={label} />
      <button
        type="button"
        className="bear-full-close"
        aria-label={closeLabel}
        title={closeLabel}
        onClick={(event) => {
          // The layer's own tap handling would close a second time.
          event.stopPropagation();
          close(event);
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
