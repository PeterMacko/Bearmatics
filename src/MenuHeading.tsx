import type { RefObject } from 'react';

/** Menu heading: optional back arrow beside the eyebrow, then a focusable screen heading. */
export default function MenuHeading({
  eyebrow,
  title,
  intro,
  headingRef,
  backLabel,
  onBack,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  backLabel?: string;
  onBack?: () => void;
}) {
  return (
    <div className="menu-heading">
      {onBack ? (
        <div className="menu-topline">
          <button
            type="button"
            className="corner-button menu-back"
            aria-label={backLabel}
            title={backLabel}
            onClick={onBack}
          >
            <span aria-hidden="true">←</span>
          </button>
          <p className="eyebrow">{eyebrow}</p>
        </div>
      ) : (
        <p className="eyebrow">{eyebrow}</p>
      )}
      <h2 ref={headingRef} tabIndex={-1}>
        {title}
      </h2>
      <p className="intro">{intro}</p>
    </div>
  );
}
