import './picture-groups.css';

export type PictureTheme = 'pirates' | 'bears' | 'lollipops' | 'boats' | 'aircraft';
/** Presentation-only ordering: cycle by original exercise index, never by retry. */
export const PICTURE_THEMES: readonly PictureTheme[] = Object.freeze(['pirates', 'bears', 'lollipops', 'boats', 'aircraft']);
export interface PictureGroupProps {
  /** Known counts are integers 0..6; null conceals the entire quantity. */
  count: number | null;
  theme: PictureTheme;
  /** Localized full accessible name for a known group, including its count. */
  label: string;
  /** Localized visible cue for zero; its accessible description belongs in label. */
  emptyLabel: string;
  /** Localized count-neutral name; the only label used when count is null. */
  unknownLabel: string;
}
const dicePositions: readonly (readonly (readonly [number, number])[])[] = [
  [], [[1, 1]], [[0, 0], [2, 2]], [[0, 0], [1, 1], [2, 2]],
  [[0, 0], [0, 2], [2, 0], [2, 2]],
  [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
];

/** Original local vectors, one object per pip; never an asset or network request. */
function PictureMotif({ theme }: { theme: PictureTheme }) {
  return <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="#34334f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {theme === 'bears' && <>
      <circle cx="16" cy="16" r="10" fill="#a96e45" /><circle cx="48" cy="16" r="10" fill="#a96e45" />
      <circle cx="16" cy="16" r="5" fill="#f1d4a4" /><circle cx="48" cy="16" r="5" fill="#f1d4a4" />
      <circle cx="32" cy="34" r="24" fill="#b87b4e" />
      <ellipse cx="32" cy="43" rx="13" ry="10" fill="#f1d4a4" stroke="none" />
      <g fill="#382a22" stroke="none"><circle cx="23" cy="31" r="3" /><circle cx="41" cy="31" r="3" /><ellipse cx="32" cy="39" rx="5" ry="3" /></g>
      <path d="M32 42v4m-6 0q6 7 12 0" />
    </>}
    {theme === 'pirates' && <>
      <path d="M49 14l11 4-8 6 7 7-13-4" fill="#ef7770" />
      <circle cx="10" cy="34" r="5" fill="#f1d4a4" /><circle cx="54" cy="34" r="5" fill="#f1d4a4" />
      <path d="M11 24h42v12c0 13-9 22-21 22S11 49 11 36z" fill="#f1d4a4" />
      <path d="M10 25C9 2 54 2 54 25z" fill="#ef7770" /><path d="M11 22h42" />
      <circle cx="25" cy="14" r="3" fill="#ffdc79" stroke="none" />
      <path d="M13 27l35 10" /><path d="M35 29h13v7q-7 10-13 0z" fill="#34334f" />
      <circle cx="23" cy="34" r="3" fill="#34334f" stroke="none" /><path d="M25 45q7 8 14 0" />
    </>}
    {theme === 'lollipops' && <>
      <path d="M29 34h6v25h-6z" fill="#f1d4a4" />
      <circle cx="32" cy="24" r="21" fill="#ffdc79" />
      <path d="M33 24c-6-5-10 5-3 8 12 5 19-12 7-18-17-8-29 15-14 25 6 4 14 3 20-1" stroke="#b63e45" strokeWidth="4" />
    </>}
    {theme === 'boats' && <>
      <path d="M32 6v38" /><path d="M28 10L9 36h19z" fill="#ffdc79" />
      <path d="M36 15v21h18z" fill="#ef7770" />
      <path d="M5 42h54L48 55H16z" fill="#8cc5ef" /><path d="M22 48h20" />
      <path d="M6 59q7 4 13 0m7 0q7 4 13 0m7 0q7 4 13 0" stroke="#356da6" />
    </>}
    {theme === 'aircraft' && <>
      <path d="M32 4c-4 0-5 7-5 12v7L5 36v7l22-7v13l-9 6v5l14-4 14 4v-5l-9-6V36l22 7v-7L37 23v-7c0-5-1-12-5-12z" fill="#8cc5ef" />
      <path d="M29 17h6" stroke="#356da6" strokeWidth="4" /><path d="M32 28v16" stroke="#fffdf8" />
    </>}
  </svg>;
}

export default function PictureGroup({ count, theme, label, emptyLabel, unknownLabel }: PictureGroupProps) {
  if (count !== null && (!Number.isInteger(count) || count < 0 || count > 6)) {
    throw new RangeError('PictureGroup count must be null or an integer from 0 to 6.');
  }
  // Branch before using the known label or constructing any quantity-dependent DOM.
  if (count === null) return <div className="picture-group picture-unknown" role="img" aria-label={unknownLabel}>
    <span className="picture-question" aria-hidden="true">?</span>
    <span className="picture-cue" aria-hidden="true">{unknownLabel}</span>
  </div>;
  if (count === 0) return <div className="picture-group picture-empty" role="img" aria-label={label}>
    <span className="picture-cue" aria-hidden="true">{emptyLabel}</span>
  </div>;
  return <div className="picture-group" role="img" aria-label={label}>
    <div className="picture-grid">
      {dicePositions[count].map(([row, column]) => <span className="picture-pip" key={`${row}-${column}`} data-picture-pip="" data-row={row} data-column={column} style={{ gridRow: row + 1, gridColumn: column + 1 }}>
        <PictureMotif theme={theme} />
      </span>)}
    </div>
  </div>;
}
