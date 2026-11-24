// SCRUM-262: original drawings for the Logic course (bear on the grid, honey pot, paw dots,
// arrows, the Go and Show me icons). All decorative: the board and buttons carry the text.
import type { Arrow } from './bearPath';

/** The bear's head on the grid: neutral, happy (found the honey) or gently sad. */
export function GridBear({ mood }: { mood: 'neutral' | 'happy' | 'sad' }) {
  const mouth =
    mood === 'happy' ? 'M24 39q8 8 16 0' : mood === 'sad' ? 'M25 42q7-5 14 0' : 'M26 40q6 4 12 0';
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" data-mood={mood}>
      <circle cx="15" cy="16" r="9" fill="#8a5a3b" />
      <circle cx="49" cy="16" r="9" fill="#8a5a3b" />
      <circle cx="15" cy="16" r="4.5" fill="#d9a77e" />
      <circle cx="49" cy="16" r="4.5" fill="#d9a77e" />
      <circle cx="32" cy="34" r="23" fill="#a8714a" />
      <ellipse cx="32" cy="40" rx="11" ry="9" fill="#ecc9a3" />
      <ellipse cx="32" cy="35" rx="4.2" ry="3.2" fill="#3a2418" />
      {mood === 'happy' ? (
        <>
          <path d="M19 27q4-4 8 0M37 27q4-4 8 0" stroke="#3a2418" strokeWidth="3" fill="none" />
        </>
      ) : (
        <>
          <circle cx="23" cy="28" r="3.2" fill="#3a2418" />
          <circle cx="41" cy="28" r="3.2" fill="#3a2418" />
        </>
      )}
      {mood === 'sad' && (
        <path d="M18 24l8-3M46 24l-8-3" stroke="#3a2418" strokeWidth="2.4" strokeLinecap="round" />
      )}
      <path d={mouth} stroke="#3a2418" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** A honey pot with a lid and a drip. */
export function HoneyPot() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="16" y="9" width="32" height="9" rx="4" fill="#a5642a" />
      <path
        d="M18 18h28c5 6 7 14 5 22-2 10-10 16-19 16s-17-6-19-16c-2-8 0-16 5-22z"
        fill="#f2a93b"
      />
      <path d="M19 18h26c0 6-3 8-6 8s-3 5-6 5-3-5-7-5-7-2-7-8z" fill="#ffd35c" />
      <path
        d="M22 44q10 5 20 0"
        stroke="#c47a17"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A grey stone (Level 2, SCRUM-289): a rounded rock with a light top and a soft shadow. */
export function Stone() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <ellipse cx="32" cy="53" rx="25" ry="5" fill="#0000001f" />
      <path
        d="M9 47c-3-9 1-19 9-25 5-9 15-13 25-10 9 3 14 11 14 20 4 6 2 13-4 16-6 3-15 4-22 4-8 0-16-1-20-3-2-1-2-1-2-2z"
        fill="#8e979f"
      />
      <path
        d="M14 34c2-6 6-10 11-12 4-7 12-9 19-7 6 2 10 7 10 13-6-3-13-3-19 0-8-4-15-2-21 6z"
        fill="#b7bfc6"
      />
      <path
        d="M22 22q6-6 14-6"
        stroke="#dde2e6"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M17 47q10 3 22 0M42 38l5 4"
        stroke="#6e777f"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Small paw print left on a walked cell after a wrong try. */
export function Paw() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <ellipse cx="12" cy="15" rx="5" ry="4.2" />
      <circle cx="6" cy="9.5" r="2.1" />
      <circle cx="10" cy="6.5" r="2.1" />
      <circle cx="14" cy="6.5" r="2.1" />
      <circle cx="18" cy="9.5" r="2.1" />
    </svg>
  );
}

const ROTATION: Record<Arrow, number> = { right: 0, down: 90, left: 180, up: 270 };

/** A thick arrow (drawn pointing right, turned for the direction). */
export function ArrowIcon({ arrow }: { arrow: Arrow }) {
  return (
    <svg
      className="arrow-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ transform: `rotate(${ROTATION[arrow]}deg)` }}
    >
      <path
        d="M4 12h14M12.5 5.5L19 12l-6.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Remove last: a key with a cross (backspace shape). */
export function RemoveIcon() {
  return (
    <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M9 5h11a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H9l-6.5-7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 9l6 6M17.5 9l-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Show me: an eye. */
export function EyeIcon() {
  return (
    <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    </svg>
  );
}

/** A pointing finger (the demo's tap). */
export function Finger() {
  return (
    <svg viewBox="0 0 32 40" aria-hidden="true" focusable="false">
      <path
        d="M12 4a3 3 0 0 1 6 0v14l7 2c3 1 4 3 3.5 6L27 34c-.5 3-3 5-6 5h-6c-3 0-5-1.5-6.5-4L4 27c-1-2 0-4 2-4.5 1.5-.5 3 .2 4 1.5l2 2.5z"
        fill="#fff3e6"
        stroke="#5c3b28"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The "?" speech balloon (SCRUM-289): a white bubble with its tail at the bottom corner toward
 * the bear's mouth (bottom left; `side="left"` mirrors the bubble, never the "?").
 */
export function QuestionBalloon({ side }: { side: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 100 92" aria-hidden="true" focusable="false">
      <g transform={side === 'left' ? 'matrix(-1 0 0 1 100 0)' : undefined}>
        <path
          d="M28 4h48a20 20 0 0 1 20 20v22a20 20 0 0 1-20 20H34L6 88l10-24A20 20 0 0 1 8 46V24A20 20 0 0 1 28 4z"
          fill="#fff"
          stroke="#5c3b28"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </g>
      <text
        x="52"
        y="50"
        textAnchor="middle"
        fontSize="46"
        fontWeight="800"
        fontFamily="inherit"
        fill="#2f5f93"
      >
        ?
      </text>
    </svg>
  );
}
