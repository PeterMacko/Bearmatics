import type { RefObject } from 'react';

/** Menu heading: eyebrow, then a focusable screen heading. Back lives in the app bar (SCRUM-133). */
export default function MenuHeading({
  eyebrow,
  title,
  intro,
  headingRef,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="menu-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2 ref={headingRef} tabIndex={-1}>
        {title}
      </h2>
      <p className="intro">{intro}</p>
    </div>
  );
}
