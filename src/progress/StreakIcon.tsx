/** Original flame (streak) and ice cube (frozen streak) icons, decorative (SCRUM-118). */
export default function StreakIcon({ frozen, size = 28 }: { frozen: boolean; size?: number }) {
  return frozen ? (
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
      <path d="M9 12.5l3 1.7M20 14l3-1.7" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg
      className="streak-icon flame"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M16 2c1 6 8 9 8 17a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 1 5 3 5-1-5 0-10 1-14z"
        fill="#ff9a3c"
        stroke="#d4561b"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 15c2 3 4 4 4 7a4 4 0 0 1-8 0c0-2 1-3 2-4 0 1 1 2 2 2 0-2-.5-3 0-5z"
        fill="#ffe08a"
      />
    </svg>
  );
}
