import { badgeLook } from './badges';

const METALS = {
  none: { face: '#efe9e5', rim: '#b9aea6', text: '#6f625a' },
  bronze: { face: '#e7a86b', rim: '#9a5b2c', text: '#4a2810' },
  silver: { face: '#dfe5ec', rim: '#8a97a6', text: '#2f3b4a' },
  gold: { face: '#ffd65c', rim: '#c08a12', text: '#5a3d00' },
};

/** Original bear badge: a bear head medal with the badge number (decorative; label elsewhere). */
export default function BadgeIcon({ badge, size = 40 }: { badge: number; size?: number }) {
  const { metal, stars } = badgeLook(badge);
  const colour = METALS[metal];
  return (
    <svg
      className={`badge-icon badge-${metal}`}
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="13" r="7" fill={colour.face} stroke={colour.rim} strokeWidth="2.5" />
      <circle cx="36" cy="13" r="7" fill={colour.face} stroke={colour.rim} strokeWidth="2.5" />
      <circle cx="24" cy="27" r="18" fill={colour.face} stroke={colour.rim} strokeWidth="3" />
      {Array.from({ length: Math.min(stars, 3) }, (_, i) => (
        <path
          key={i}
          transform={`translate(${24 + (i - (Math.min(stars, 3) - 1) / 2) * 9} 6) scale(0.32)`}
          d="M0-12 3.5-3.7 12-3.7 5.2 1.6 7.6 10 0 5 -7.6 10 -5.2 1.6 -12-3.7 -3.5-3.7z"
          fill="#fff6c2"
          stroke={colour.rim}
          strokeWidth="2"
        />
      ))}
      <text
        x="24"
        y="33"
        textAnchor="middle"
        fontSize={badge > 99 ? 13 : 17}
        fontWeight="800"
        fill={colour.text}
      >
        {badge}
      </text>
    </svg>
  );
}
