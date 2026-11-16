/**
 * Original streak icons, decorative (SCRUM-118): flame (a lesson done today), shadow flame
 * (not yet today, or no streak), ice cube (frozen streak). `flicker` makes the flame burn.
 */
export type StreakLook = 'flame' | 'shadow' | 'ice';

export default function StreakIcon({
  look,
  size = 28,
  flicker = false,
}: {
  look: StreakLook;
  size?: number;
  flicker?: boolean;
}) {
  if (look === 'ice')
    return (
      <svg
        className="streak-icon ice"
        viewBox="0 0 32 32"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M16 3 27 9v14l-11 6L5 23V9z"
          fill="#d6effc"
          stroke="#5aa5d6"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M5 9l11 6 11-6M16 15v14" fill="none" stroke="#5aa5d6" strokeWidth="1.6" />
        <path
          d="M9 12.5l3 1.7M20 14l3-1.7"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  const shadow = look === 'shadow';
  return (
    <svg
      className={`streak-icon ${look}${flicker ? ' flicker' : ''}`}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="flame-outer"
        d="M16 2c1 6 8 9 8 17a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 1 5 3 5-1-5 0-10 1-14z"
        fill={shadow ? '#e6ddd6' : '#ff9a3c'}
        stroke={shadow ? '#b9aea6' : '#d4561b'}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeDasharray={shadow ? '3 2' : undefined}
      />
      {!shadow && (
        <path
          className="flame-inner"
          d="M16 15c2 3 4 4 4 7a4 4 0 0 1-8 0c0-2 1-3 2-4 0 1 1 2 2 2 0-2-.5-3 0-5z"
          fill="#ffe08a"
        />
      )}
    </svg>
  );
}
