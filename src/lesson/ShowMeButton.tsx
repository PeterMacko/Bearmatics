import type { MouseEvent } from 'react';
import type { Copy } from '../i18n';
import { ignoreRepeatClick } from '../ignoreRepeatClick';
import { EyeIcon } from '../logic/LogicArt';

/**
 * "Show me" (plays the picture demo again). A double tap is one press; while `ariaDisabled` is
 * set, presses do nothing. Each screen passes its attribute as before (`false` stays in the DOM).
 */
export default function ShowMeButton({
  t,
  className = '',
  ariaDisabled,
  onShowMe,
}: {
  t: Copy;
  /** Extra class after `secondary logic-show-me`. */
  className?: string;
  ariaDisabled: boolean | undefined;
  onShowMe: () => void;
}) {
  return (
    <button
      type="button"
      className={`secondary logic-show-me${className ? ` ${className}` : ''}`}
      aria-disabled={ariaDisabled}
      onClick={(event: MouseEvent) => {
        if (ignoreRepeatClick(event) || ariaDisabled) return;
        onShowMe();
      }}
    >
      <EyeIcon />
      {t.showMe}
    </button>
  );
}
