import type { ReactNode } from 'react';

/**
 * Original button icons (SCRUM-172), drawn in the button's text colour. Decorative only: the
 * button's text stays its accessible name, so every icon is hidden from assistive technology.
 */
export type IconName = 'replay' | 'list' | 'play' | 'door' | 'unlock' | 'cross' | 'tick' | 'back';

const SHAPES: Record<IconName, ReactNode> = {
  // Circular arrow: Play again and every Try again.
  replay: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 3.5v4.8h-4.8" />
    </>
  ),
  // List: three lines with dots (Choose level).
  list: (
    <>
      <circle cx="5" cy="6.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20" />
    </>
  ),
  // Play triangle: Keep practising.
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" strokeLinejoin="round" />,
  // Door with an arrow out: Choose a new trail.
  door: (
    <>
      <path d="M13 4H5.5v16H13" />
      <path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />
    </>
  ),
  // Open padlock: Unlock.
  unlock: (
    <>
      <rect x="4.5" y="11" width="15" height="9.5" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 7.6-1.7" />
    </>
  ),
  // Cross: No thanks.
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  // Tick: Yes.
  tick: <path d="M4.5 12.5l4.8 4.8L19.5 7" />,
  // Left arrow: Back.
  back: <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />,
};

export default function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="button-icon"
      data-icon={name}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[name]}
    </svg>
  );
}
