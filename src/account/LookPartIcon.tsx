// SCRUM-273: the choice pictures on "Dress your bear" show only the part being chosen (a colour
// tile, the plain face, or the item alone, enlarged), drawn with BearIcon's own shapes.
import type { LookPart } from '../../shared/bearLook';
import { BACKGROUNDS, Eyes, Face, FURS, Head, INK, Neck } from './BearIcon';

/** The pale tile behind faces, items and "None" (the background choices are their colour). */
export const PART_TILE = '#f4efe9';
/** Thin edge of every tile, so pale tiles and backgrounds read as tiles on the page. */
export const TILE_EDGE = '#cfc4bb';
/** Outline round the faces (pale furs: polar, panda) and the colour of the "no" sign. */
export const PART_OUTLINE = INK;
export const NONE_SIGN = '#626178';

/** Square part of the drawing: left, top, size. */
type Crop = readonly [x: number, y: number, size: number];

/** Square part of the 64x64 bear drawing that holds the face. */
const FACE_CROP: Crop = [4, 6, 56];

/**
 * Per item: the square part of the 64x64 bear drawing that holds it, so the item fills the
 * tile. Index 0 ("None") has no crop. The cap keeps its side brim, the necklace its whole string
 * of beads, and the tie is shown whole inside the tile (a blade running off the edge was cut flat
 * on the tile border, QA279-01).
 */
const ITEM_CROPS: Record<'head' | 'neck' | 'eyes', readonly (Crop | null)[]> = {
  head: [null, [16, -10, 44], [13, -6.5, 38], [17, -5, 30], [20, 0, 24], [38.5, -0.5, 21]],
  neck: [null, [20, 46, 24], [24.5, 53.5, 15], [12, 39, 40], [14.5, 36.5, 35], [15.5, 41, 33]],
  eyes: [null, [14, 12, 36], [13, 11, 38], [12.5, 11.5, 39]],
};

function Item({ part, index }: { part: 'head' | 'neck' | 'eyes'; index: number }) {
  if (part === 'head') return <Head item={index} outline />;
  if (part === 'neck') return <Neck item={index} outline />;
  return <Eyes item={index} eyeColour={INK} />;
}

/** The picture of one choice: only that part, never a whole bear. Decorative (the radio is named). */
export default function LookPartIcon({
  part,
  index,
  size = 40,
}: {
  part: LookPart;
  index: number;
  size?: number;
}) {
  const crop = part === 'fur' ? FACE_CROP : part === 'background' ? null : ITEM_CROPS[part][index];
  const tile = part === 'background' ? (BACKGROUNDS[index] ?? BACKGROUNDS[0]) : PART_TILE;
  const fur = FURS[index] ?? FURS[0];
  return (
    <svg
      className="look-part-icon"
      data-part={part}
      data-choice={index}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="14"
        fill={tile}
        stroke={TILE_EDGE}
        strokeWidth="1.5"
      />
      {crop ? (
        <svg
          x="5"
          y="5"
          width="54"
          height="54"
          viewBox={`${crop[0]} ${crop[1]} ${crop[2]} ${crop[2]}`}
          overflow="hidden"
          data-shape={part === 'fur' ? 'face' : 'item'}
        >
          {part === 'fur' ? (
            <Face fur={fur} outline={PART_OUTLINE} />
          ) : (
            <Item part={part as 'head' | 'neck' | 'eyes'} index={index} />
          )}
        </svg>
      ) : (
        part !== 'background' && (
          // "None": a circle with a slash.
          <g data-shape="none" fill="none" stroke={NONE_SIGN} strokeWidth="4" strokeLinecap="round">
            <circle cx="32" cy="32" r="16" />
            <path d="M20.7 43.3L43.3 20.7" />
          </g>
        )
      )}
    </svg>
  );
}
