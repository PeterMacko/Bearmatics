// SCRUM-299: pictures of the "What comes next?" rows (no new art: the Small maths motifs in
// their dice layout and the Logic arrows) and their names for screen readers.
import { pointsText, type Copy } from '../i18n';
import { dicePositions, PictureMotif } from '../PictureGroup';
import { ArrowIcon } from './LogicArt';
import type { PatternItem } from './patterns';

/** The picture of one place or choice (decorative: the row and the buttons carry the names). */
export function PatternPicture({ item }: { item: PatternItem }) {
  if (item.kind === 'motif')
    return (
      <span className="pattern-picture pattern-motif" aria-hidden="true">
        <PictureMotif theme={item.motif} />
      </span>
    );
  if (item.kind === 'arrow')
    return (
      <span className="pattern-picture pattern-arrow" aria-hidden="true">
        <ArrowIcon arrow={item.arrow} />
      </span>
    );
  return (
    <span className="pattern-picture pattern-dice" aria-hidden="true" data-count={item.count}>
      {dicePositions[item.count].map(([row, column]) => (
        <span
          key={`${row}-${column}`}
          className="pattern-pip"
          style={{ gridRow: row + 1, gridColumn: column + 1 }}
        >
          <PictureMotif theme={item.motif} />
        </span>
      ))}
    </span>
  );
}

type PatternCopy = Copy['pattern'];

/** "bear", "3 bears" / "3 medvede", "arrow pointing down" (lower case, for lists). */
export function itemName(t: PatternCopy, item: PatternItem): string {
  if (item.kind === 'motif') return t.names[item.motif];
  if (item.kind === 'arrow') return t.arrows[item.arrow];
  return pointsText(t.counted[item.motif], item.count);
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The row as one sentence: "Pirate, bear, pirate, bear, pirate, bear, question mark". After a
 * right answer the gap reads as the picture that filled it.
 */
export function rowLabel(
  t: PatternCopy,
  places: readonly PatternItem[],
  gap: number,
  filled: boolean,
): string {
  return capitalize(
    places.map((item, i) => (i === gap && !filled ? t.gap : itemName(t, item))).join(', '),
  );
}
