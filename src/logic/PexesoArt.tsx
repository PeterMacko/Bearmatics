// SCRUM-324: the 15 Pexeso card pictures and the card back. One picture per card, drawn on a
// 64x64 grid. Shapes AND colours differ (fair to colour-blind children); the first five reuse
// the Small maths motifs (PictureGroup). Original local vectors, no assets or network requests.
import { PictureMotif, type PictureTheme } from '../PictureGroup';
import type { PexesoPicture } from './pexeso';

const MOTIFS: Partial<Record<PexesoPicture, PictureTheme>> = {
  bear: 'bears',
  pirate: 'pirates',
  lollipop: 'lollipops',
  boat: 'boats',
  plane: 'aircraft',
};

const svgProps = {
  viewBox: '0 0 64 64',
  'aria-hidden': true,
  focusable: false,
  fill: 'none',
  stroke: '#34334f',
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** The face of a card (decorative: the card button carries the name). */
export function PexesoFace({ picture }: { picture: PexesoPicture }) {
  const motif = MOTIFS[picture];
  if (motif) return <PictureMotif theme={motif} />;
  return (
    <svg {...svgProps}>
      {picture === 'apple' && (
        <>
          <path d="M32 19c-1-6 1-10 4-13" />
          <path d="M35 13c5-6 13-6 16-3-4 6-11 7-16 3z" fill="#6cc070" />
          <path
            d="M32 20c-8-6-25-5-25 14 0 14 10 25 18 25 3 0 5-2 7-2s4 2 7 2c8 0 18-11 18-25 0-19-17-20-25-14z"
            fill="#e0453a"
          />
          <path d="M17 33q1-7 7-9" stroke="#fffdf8" strokeWidth="3" />
        </>
      )}
      {picture === 'fish' && (
        <>
          <path d="M5 17l14 15L5 47z" fill="#f59a3e" />
          <path d="M30 20q4-10 14-7-1 6-8 9" fill="#f59a3e" />
          <ellipse cx="35" cy="32" rx="23" ry="14" fill="#f59a3e" />
          <path d="M26 21q-5 11 0 22" />
          <circle cx="47" cy="28" r="3" fill="#34334f" stroke="none" />
          <path d="M51 37q-3 3-7 2" />
        </>
      )}
      {picture === 'ball' && (
        <>
          <circle cx="32" cy="32" r="26" fill="#fffdf8" />
          <path d="M32 23l9 6.5-3.4 10.5H26.4L23 29.5z" fill="#34334f" />
          <path d="M32 23V7M41 29.5l15-4.5M37.6 40l9 12.5M26.4 40l-9 12.5M23 29.5L8 25" />
          <path d="M24 8l8-1 8 1-8 6zM55 22l2 9-2 8-5-9zM9 22l-2 9 2 8 5-9z" fill="#34334f" />
          <path d="M42 55l-10 3-10-3 10-4z" fill="#34334f" />
        </>
      )}
      {picture === 'house' && (
        <>
          <path d="M42 20V9h7v18" fill="#b5523b" />
          <path d="M12 28h40v29H12z" fill="#fff3d3" />
          <path d="M5 31L32 8l27 23z" fill="#b5523b" />
          <path d="M27 41h10v16H27z" fill="#356da6" />
          <path d="M16 35h8v8h-8zM40 35h8v8h-8z" fill="#8cc5ef" />
          <path d="M4 57h56" />
        </>
      )}
      {picture === 'tree' && (
        <>
          <path d="M28 40h8v19h-8z" fill="#8a5a36" />
          <path
            d="M17 45c-9 0-13-12-4-17-2-13 11-21 19-15 8-6 21 2 19 15 9 5 5 17-4 17z"
            fill="#4caf50"
          />
          <circle cx="24" cy="30" r="2.5" fill="#e0453a" stroke="none" />
          <circle cx="40" cy="24" r="2.5" fill="#e0453a" stroke="none" />
          <circle cx="38" cy="37" r="2.5" fill="#e0453a" stroke="none" />
          <path d="M8 59h48" />
        </>
      )}
      {picture === 'star' && (
        <path
          d="M32 6l6.5 17.1 18.2.9-14.2 11.4 4.8 17.6L32 43l-15.3 10 4.8-17.6L7.3 24l18.2-.9z"
          fill="#ffc93c"
        />
      )}
      {picture === 'flower' && (
        <>
          <path d="M32 34v25" stroke="#3f8f46" strokeWidth="3.5" />
          <path d="M32 52c-9-1-13-7-13-11 7 0 12 4 13 11z" fill="#6cc070" />
          <g fill="#f48fb1">
            <circle cx="32" cy="12" r="9" />
            <circle cx="43.4" cy="20.3" r="9" />
            <circle cx="39" cy="33.7" r="9" />
            <circle cx="25" cy="33.7" r="9" />
            <circle cx="20.6" cy="20.3" r="9" />
          </g>
          <circle cx="32" cy="24" r="7" fill="#ffdc79" />
        </>
      )}
      {picture === 'car' && (
        <>
          <path d="M5 46V35l8-3 8-12h21l10 12 7 3v11z" fill="#356da6" />
          <path d="M23 24h7v8H17zM34 24h7l6 8H34z" fill="#e3f1ff" />
          <path d="M55 38h4" stroke="#ffdc79" strokeWidth="3.5" />
          <circle cx="18" cy="47" r="7" fill="#34334f" />
          <circle cx="46" cy="47" r="7" fill="#34334f" />
          <circle cx="18" cy="47" r="2.5" fill="#fffdf8" stroke="none" />
          <circle cx="46" cy="47" r="2.5" fill="#fffdf8" stroke="none" />
        </>
      )}
      {picture === 'umbrella' && (
        <>
          <path d="M32 31v20c0 7-9 7-9 0" strokeWidth="3" />
          <path
            d="M5 31C5 16 17 7 32 7s27 9 27 24c-4-4-10-4-13.5 0-3.5-4-9.5-4-13.5 0-4-4-10-4-13.5 0-3.5-4-9.5-4-13.5 0z"
            fill="#9b6bd6"
          />
          <path d="M32 7c-6 6-8 15-6.5 24M32 7c6 6 8 15 6.5 24" />
          <path d="M32 7V3" />
        </>
      )}
      {picture === 'butterfly' && (
        <>
          <path d="M30 30C22 9 3 9 5 24c1 9 13 11 25 6z" fill="#3bbfad" />
          <path d="M34 30C42 9 61 9 59 24c-1 9-13 11-25 6z" fill="#3bbfad" />
          <path d="M30 34c-12 0-21 10-15 18 5 6 13-3 15-18z" fill="#3bbfad" />
          <path d="M34 34c12 0 21 10 15 18-5 6-13-3-15-18z" fill="#3bbfad" />
          <circle cx="16" cy="21" r="3.5" fill="#ffdc79" stroke="none" />
          <circle cx="48" cy="21" r="3.5" fill="#ffdc79" stroke="none" />
          <path d="M32 21v29" strokeWidth="5" />
          <path d="M31 21q-3-9-9-12M33 21q3-9 9-12" />
        </>
      )}
    </svg>
  );
}

/** The back of every card: a yellow bear paw on blue (decorative). */
export function PexesoBack() {
  return (
    <svg {...svgProps} stroke="none">
      <path
        d="M0 16L16 0M0 40L40 0M0 64L64 0M24 64L64 24M48 64L64 48"
        stroke="#7aa3d0"
        strokeWidth="5"
      />
      <g fill="#ffdc79" stroke="#34334f" strokeWidth="2">
        <ellipse cx="32" cy="41" rx="12" ry="10" />
        <circle cx="17" cy="27" r="5" />
        <circle cx="26.5" cy="19" r="5" />
        <circle cx="37.5" cy="19" r="5" />
        <circle cx="47" cy="27" r="5" />
      </g>
    </svg>
  );
}
