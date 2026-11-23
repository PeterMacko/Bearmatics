// Profile bears (SCRUM-97, SCRUM-249): an original bear face drawn in code from five parts
// (fur, background, head, neck, eyes; see shared/bearLook.ts). The eight first bears keep their
// exact drawing: their colours and extras (hat, scarf, bow, glasses, crown) are unchanged here.
import type { BearLook } from '../../shared/bearLook';

export type Fur = { fur: string; inner: string; muzzle: string; ears?: string; patches?: boolean };

/** Fur colours, in part order: brown, dark brown, honey, white (polar), panda, pink, blue, mint. */
export const FURS: Fur[] = [
  { fur: '#ad754c', inner: '#e7b48c', muzzle: '#fff0ce' },
  { fur: '#6f4a33', inner: '#c99a72', muzzle: '#f1d4a4' },
  { fur: '#e2a43a', inner: '#f7d48b', muzzle: '#fff4d6' },
  { fur: '#f4f1ea', inner: '#ffd9d2', muzzle: '#ffffff' },
  { fur: '#f7f4ee', inner: '#2f2a2c', muzzle: '#ffffff', ears: '#2f2a2c', patches: true },
  { fur: '#c66a73', inner: '#f2b8bc', muzzle: '#ffe3e4' },
  { fur: '#5f8fc7', inner: '#bcd8f5', muzzle: '#eaf4ff' },
  { fur: '#5aa58a', inner: '#bfe6d4', muzzle: '#eefaf3' },
];

/** Background colours of the first eight bears, in their order. */
export const BACKGROUNDS = [
  '#ffdc79',
  '#8cc5ef',
  '#97ccef',
  '#b9e3c6',
  '#ffd0a8',
  '#ffe9a6',
  '#ffc9bd',
  '#ed746c',
];

export const INK = '#342c30';

/** Five-point star path around (cx, cy). */
function star(cx: number, cy: number, outer: number, inner: number) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${points.join('L')}z`;
}

/** Beads along the necklace curve (quadratic from (17,51) via (32,63) to (47,51)). */
const BEADS = [0.08, 0.24, 0.4, 0.6, 0.76, 0.92].map((s) => ({
  x: (1 - s) ** 2 * 17 + 2 * (1 - s) * s * 32 + s ** 2 * 47,
  y: (1 - s) ** 2 * 51 + 2 * (1 - s) * s * 63 + s ** 2 * 51,
}));
const BEAD_COLOURS = ['#ffd23f', '#e0567a', '#4f9be0', '#4f9be0', '#e0567a', '#ffd23f'];

/**
 * Shared part shapes (SCRUM-273): the whole bear below and the part-only choice pictures
 * (LookPartIcon) draw the same shapes. `outline` (choice pictures only) gives the coral hat and
 * scarf a darker edge so they stand out on the pale choice tile; the bear itself is unchanged.
 */
export const ITEM_OUTLINE = '#b63e45';

export function Head({ item, outline = false }: { item: number; outline?: boolean }) {
  switch (item) {
    case 1: // cap: dome with a button and a brim to the side
      return (
        <g>
          <path d="M18 17q0-12 14-12t14 12z" fill="#7b4fc0" />
          <rect x="38" y="14" width="20" height="4.5" rx="2.2" fill="#563390" />
          <circle cx="32" cy="5.5" r="2" fill="#563390" />
        </g>
      );
    case 2: // hat (first bear 2)
      return (
        <g>
          <rect
            x="20"
            y="6"
            width="24"
            height="8"
            rx="3"
            fill="#ed746c"
            {...(outline ? { stroke: ITEM_OUTLINE, strokeWidth: 1 } : {})}
          />
          <rect x="15" y="13" width="34" height="4" rx="2" fill="#b63e45" />
        </g>
      );
    case 3: // crown (first bear 8)
      return <path d="M20 14l4-9 8 6 8-6 4 9z" fill="#ffe080" stroke="#b97c12" strokeWidth="1.5" />;
    case 4: // bow (first bear 5)
      return (
        <g fill="#356da6">
          <path d="M32 12l-9-6v12z" />
          <path d="M32 12l9-6v12z" />
          <circle cx="32" cy="12" r="3" />
        </g>
      );
    case 5: // flower by the right ear
      return (
        <g>
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            return (
              <circle
                key={i}
                cx={(49 + 4.6 * Math.cos(angle)).toFixed(2)}
                cy={(10 + 4.6 * Math.sin(angle)).toFixed(2)}
                r="3.8"
                fill="#ff8fb1"
                stroke="#c93b6b"
                strokeWidth="0.9"
              />
            );
          })}
          <circle cx="49" cy="10" r="3" fill="#ffd23f" stroke="#c98a12" strokeWidth="0.8" />
        </g>
      );
    default:
      return null;
  }
}

export function Neck({ item, outline = false }: { item: number; outline?: boolean }) {
  switch (item) {
    case 1: // bow tie
      return (
        <g fill="#7b4fc0" stroke="#4a2c80" strokeWidth="1" strokeLinejoin="round">
          <path d="M32 58l-10-6v12z" />
          <path d="M32 58l10-6v12z" />
          <circle cx="32" cy="58" r="3" />
        </g>
      );
    case 2: // tie
      return (
        <g fill="#d63c4a" stroke="#8f1f2b" strokeWidth="1" strokeLinejoin="round">
          {/* Peter: lower, below the mouth (it read as a tongue); the blade runs off the edge. */}
          <path d="M27.5 56h9l-2 4.5h-5z" />
          <path d="M29.5 60.5h5l3.5 6h-12z" />
        </g>
      );
    case 3: // scarf (first bear 3)
      return (
        <path
          d="M14 55q18 8 36 0l-2 6q-16 5-32 0z"
          fill="#ed746c"
          {...(outline ? { stroke: ITEM_OUTLINE, strokeWidth: 1, strokeLinejoin: 'round' } : {})}
        />
      );
    case 4: // necklace: coloured beads on a string
      return (
        <g>
          <path d="M17 51q15 12 30 0" fill="none" stroke="#8a6a3c" strokeWidth="1" />
          {BEADS.map((bead, i) => (
            <circle
              key={i}
              cx={bead.x.toFixed(2)}
              cy={bead.y.toFixed(2)}
              r="2.6"
              fill={BEAD_COLOURS[i]}
              stroke={INK}
              strokeWidth="0.6"
            />
          ))}
        </g>
      );
    case 5: // medal on a ribbon
      return (
        <g>
          {/* Peter: lower, ribbon beside the medal instead of above it (it read as a tongue). */}
          <path d="M18 52.5l9.5 5M46 52.5l-9.5 5" fill="none" stroke="#356da6" strokeWidth="3.5" />
          <circle cx="32" cy="58" r="5.5" fill="#ffd23f" stroke="#b97c12" strokeWidth="1.5" />
          <path d={star(32, 58.3, 3, 1.3)} fill="#b97c12" />
        </g>
      );
    default:
      return null;
  }
}

export function Eyes({ item, eyeColour }: { item: number; eyeColour: string }) {
  switch (item) {
    case 1: // glasses (first bear 6)
      return (
        <g fill="none" stroke="#21466d" strokeWidth="2">
          <circle cx="23" cy="30" r="6" />
          <circle cx="41" cy="30" r="6" />
          <path d="M29 30h6" />
        </g>
      );
    case 2: // sunglasses
      return (
        <g>
          <path d="M28 29.5h8" stroke="#1f1b1d" strokeWidth="2" />
          <rect x="15" y="25" width="15" height="10" rx="4.5" fill="#1f1b1d" />
          <rect x="34" y="25" width="15" height="10" rx="4.5" fill="#1f1b1d" />
          <path
            d="M18 28.5l3-2M37 28.5l3-2"
            stroke="#ffffff"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </g>
      );
    case 3: // star glasses
      return (
        <g stroke="#c93b6b" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M29 30h6" fill="none" strokeWidth="2" />
          <path d={star(23, 30.5, 8.5, 4.4)} fill="#ffd23f" fillOpacity="0.45" />
          <path d={star(41, 30.5, 8.5, 4.4)} fill="#ffd23f" fillOpacity="0.45" />
          <circle cx="23" cy="30" r="2.6" fill={eyeColour} stroke="none" />
          <circle cx="41" cy="30" r="2.6" fill={eyeColour} stroke="none" />
        </g>
      );
    default:
      return null;
  }
}

/** Panda eyes are white on their dark patches; every other bear has dark eyes. */
export const eyeColourOf = (fur: Fur) => (fur.patches ? '#ffffff' : INK);

/**
 * The plain bear face: ears, head, panda patches, muzzle, eyes, nose and mouth. `outline` (the
 * fur choice pictures) draws a dark edge round the ears and head, so pale furs (polar, panda)
 * stay visible on a pale tile.
 */
export function Face({ fur, outline }: { fur: Fur; outline?: string }) {
  const eyeColour = eyeColourOf(fur);
  const edge = outline ? { stroke: outline, strokeWidth: 1.5 } : {};
  return (
    <>
      <circle cx="16" cy="20" r="10" fill={fur.ears ?? fur.fur} {...edge} />
      <circle cx="48" cy="20" r="10" fill={fur.ears ?? fur.fur} {...edge} />
      <circle cx="16" cy="20" r="5" fill={fur.inner} />
      <circle cx="48" cy="20" r="5" fill={fur.inner} />
      <ellipse cx="32" cy="35" rx="24" ry="23" fill={fur.fur} {...edge} />
      {fur.patches && (
        <g fill="#2f2a2c">
          <ellipse cx="23" cy="30" rx="6" ry="7" transform="rotate(-20 23 30)" />
          <ellipse cx="41" cy="30" rx="6" ry="7" transform="rotate(20 41 30)" />
        </g>
      )}
      <ellipse cx="32" cy="43" rx="15" ry="12" fill={fur.muzzle} />
      <circle cx="23" cy="30" r="3" fill={eyeColour} />
      <circle cx="41" cy="30" r="3" fill={eyeColour} />
      <path d="M27 38q5-4 10 0q0 6-5 6t-5-6" fill={INK} />
      <path d="M24 46q8 9 16 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

/** Drawn when an answer carries no look (never crash the whole app over a missing icon). */
const PLAIN: BearLook = { fur: 0, background: 0, head: 0, neck: 0, eyes: 0 };

export default function BearIcon({
  look = PLAIN,
  size = 48,
  label,
}: {
  look?: BearLook;
  size?: number;
  /** Spoken name (the look described); without it the picture is decorative. */
  label?: string;
}) {
  const fur = FURS[look.fur] ?? FURS[0];
  const background = BACKGROUNDS[look.background] ?? BACKGROUNDS[0];
  return (
    <svg
      className="bear-icon"
      data-look={[look.fur, look.background, look.head, look.neck, look.eyes].join('.')}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      focusable="false"
    >
      <rect width="64" height="64" rx="16" fill={background} />
      <Face fur={fur} />
      <Neck item={look.neck} />
      <Eyes item={look.eyes} eyeColour={eyeColourOf(fur)} />
      <Head item={look.head} />
    </svg>
  );
}
