/** Eight original bear-face icons for profiles (drawn for Bearmatics, like the favicon). */
type Look = {
  fur: string;
  inner: string;
  muzzle: string;
  background: string;
  extra?: 'bow' | 'hat' | 'glasses' | 'patches' | 'star' | 'leaf' | 'crown' | 'scarf';
};

const LOOKS: Record<number, Look> = {
  1: { fur: '#ad754c', inner: '#e7b48c', muzzle: '#fff0ce', background: '#ffdc79', extra: 'star' },
  2: { fur: '#6f4a33', inner: '#c99a72', muzzle: '#f1d4a4', background: '#8cc5ef', extra: 'hat' },
  3: { fur: '#f4f1ea', inner: '#ffd9d2', muzzle: '#ffffff', background: '#97ccef', extra: 'scarf' },
  4: {
    fur: '#f7f4ee',
    inner: '#2f2a2c',
    muzzle: '#ffffff',
    background: '#b9e3c6',
    extra: 'patches',
  },
  5: { fur: '#c66a73', inner: '#f2b8bc', muzzle: '#ffe3e4', background: '#ffd0a8', extra: 'bow' },
  6: {
    fur: '#5f8fc7',
    inner: '#bcd8f5',
    muzzle: '#eaf4ff',
    background: '#ffe9a6',
    extra: 'glasses',
  },
  7: { fur: '#5aa58a', inner: '#bfe6d4', muzzle: '#eefaf3', background: '#ffc9bd', extra: 'leaf' },
  8: { fur: '#e2a43a', inner: '#f7d48b', muzzle: '#fff4d6', background: '#ed746c', extra: 'crown' },
};

export default function BearIcon({ bear, size = 48 }: { bear: number; size?: number }) {
  const look = LOOKS[bear] ?? LOOKS[1];
  const panda = look.extra === 'patches';
  return (
    <svg
      className="bear-icon"
      data-bear={bear}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="16" fill={look.background} />
      <circle cx="16" cy="20" r="10" fill={panda ? '#2f2a2c' : look.fur} />
      <circle cx="48" cy="20" r="10" fill={panda ? '#2f2a2c' : look.fur} />
      <circle cx="16" cy="20" r="5" fill={look.inner} />
      <circle cx="48" cy="20" r="5" fill={look.inner} />
      <ellipse cx="32" cy="35" rx="24" ry="23" fill={look.fur} />
      {panda && (
        <g fill="#2f2a2c">
          <ellipse cx="23" cy="30" rx="6" ry="7" transform="rotate(-20 23 30)" />
          <ellipse cx="41" cy="30" rx="6" ry="7" transform="rotate(20 41 30)" />
        </g>
      )}
      <ellipse cx="32" cy="43" rx="15" ry="12" fill={look.muzzle} />
      <circle cx="23" cy="30" r="3" fill={panda ? '#ffffff' : '#342c30'} />
      <circle cx="41" cy="30" r="3" fill={panda ? '#ffffff' : '#342c30'} />
      <path d="M27 38q5-4 10 0q0 6-5 6t-5-6" fill="#342c30" />
      <path
        d="M24 46q8 9 16 0"
        fill="none"
        stroke="#342c30"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {look.extra === 'star' && <path d="M51 5l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ed746c" />}
      {look.extra === 'hat' && (
        <g>
          <rect x="20" y="6" width="24" height="8" rx="3" fill="#ed746c" />
          <rect x="15" y="13" width="34" height="4" rx="2" fill="#b63e45" />
        </g>
      )}
      {look.extra === 'scarf' && <path d="M14 55q18 8 36 0l-2 6q-16 5-32 0z" fill="#ed746c" />}
      {look.extra === 'bow' && (
        <g fill="#356da6">
          <path d="M32 12l-9-6v12z" />
          <path d="M32 12l9-6v12z" />
          <circle cx="32" cy="12" r="3" />
        </g>
      )}
      {look.extra === 'glasses' && (
        <g fill="none" stroke="#21466d" strokeWidth="2">
          <circle cx="23" cy="30" r="6" />
          <circle cx="41" cy="30" r="6" />
          <path d="M29 30h6" />
        </g>
      )}
      {look.extra === 'leaf' && <path d="M50 4q10 6 4 16q-10-4-4-16z" fill="#3f8f5e" />}
      {look.extra === 'crown' && (
        <path d="M20 14l4-9 8 6 8-6 4 9z" fill="#ffe080" stroke="#b97c12" strokeWidth="1.5" />
      )}
    </svg>
  );
}
