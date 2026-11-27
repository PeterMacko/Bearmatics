import { useState, type RefObject } from 'react';
import { fill, type Copy } from './i18n';
import LevelAgePopup from './LevelAgePopup';
import { ageRange } from './levelAges';
import MenuHeading from './MenuHeading';
import { multiplierName, type Multiplier, type PointsCourse } from './progress/multipliers';
import { SESSION_SIZES } from './session';

/** One level in a menu: its value, the number the child sees, its name and optional detail. */
export type MenuLevel<L extends number> = {
  value: L;
  shown: number;
  title: string;
  detail?: string;
};

/**
 * Level menu of a course: level choice, exercise count and the start button.
 * Radio names and the start button's `type` differ per course (kept for tests and the DOM).
 */
export default function LevelMenu<L extends number>({
  t,
  course,
  className = 'selection',
  heading,
  levels,
  level,
  size,
  levelName = 'level',
  sizeName = 'size',
  startLabel,
  startType,
  onLevelChange,
  onSizeChange,
  onStart,
  headingRef,
  nextMultiplier,
  withoutSize,
}: {
  t: Copy;
  /** SCRUM-308: the course, for each level's suggested age (src/levelAges.ts). */
  course: PointsCourse;
  className?: string;
  heading: { eyebrow: string; title: string; intro: string };
  levels: readonly MenuLevel<L>[];
  level: L;
  size: number;
  /** `name` of the level radios. */
  levelName?: string;
  /** `name` of the exercise-count radios. */
  sizeName?: string;
  startLabel: string;
  /** The English start button has type="button"; the maths one has no type. */
  startType?: 'button';
  onLevelChange: (level: L) => void;
  onSizeChange: (size: number) => void;
  onStart: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /**
   * SCRUM-202: the multiplier the next play of a level (as shown) gets, signed in only. A small
   * sign shows it (star x1.5, 1/2, 1/4; nothing at x1) with a screen-reader text.
   */
  nextMultiplier?: (shown: number) => Multiplier | null;
  /** SCRUM-324: levels without an exercise-count choice (Pexeso): the count fieldset hides. */
  withoutSize?: (level: L) => boolean;
}) {
  // SCRUM-308 round 2: the open age popup (one at a time): its badge, text and opening time.
  const [popup, setPopup] = useState<{ anchor: HTMLElement; text: string; at: number } | null>(
    null,
  );
  return (
    <section className={className}>
      <MenuHeading {...heading} headingRef={headingRef} />
      <fieldset className="level-options">
        <legend className="sr-only">{t.level}</legend>
        {levels.map(({ value, shown, title, detail }) => {
          const next = nextMultiplier?.(shown);
          const sign = next && next !== 1 ? multiplierName(next) : null;
          const ages = ageRange(course, shown);
          return (
            <label className={`level-option level-${shown}`} key={value}>
              <input
                type="radio"
                name={levelName}
                value={value}
                checked={level === value}
                onChange={() => onLevelChange(value)}
              />
              <span className="level-number" aria-hidden="true">
                {shown}
                {sign && (
                  <span className={`next-play next-play-${sign}`} data-next-play={next}>
                    {t.points.nextPlaySign[sign]}
                  </span>
                )}
              </span>
              <span>
                <span className="level-title">
                  {t.level} {shown} · {title}
                </span>
                {detail !== undefined && <span className="level-detail">{detail}</span>}
                {ages && <span className="sr-only">{fill(t.levelAges, ages)}</span>}
                {sign && <span className="sr-only">{t.points.nextPlay[sign]}</span>}
              </span>
              {ages && (
                // A tap on the badge also chooses its level (the badge sits in the row's label).
                <span
                  className="level-age"
                  aria-hidden="true"
                  onClick={(e) => {
                    const anchor = e.currentTarget;
                    // Choose the row as a tap on it would, but focus its radio without scrolling:
                    // the label's own focus scrolls (Firefox at 200% text even jumps the page),
                    // which would carry the badge away from its popup.
                    e.preventDefault();
                    const radio = anchor.closest('label')?.querySelector('input');
                    radio?.focus({ preventScroll: true });
                    radio?.click();
                    const text = fill(t.levelAgesPopup, ages);
                    // A new `at` on every tap restarts the popup's closing time.
                    setPopup((open) => ({ anchor, text, at: (open?.at ?? 0) + 1 }));
                  }}
                >
                  {ages.from}–{ages.to}
                </span>
              )}
              <span className="selection-dot" aria-hidden="true" />
            </label>
          );
        })}
      </fieldset>
      <div className="menu-controls">
        {!withoutSize?.(level) && (
          <fieldset className="session-options">
            <legend>{t.count}</legend>
            {SESSION_SIZES.map((n) => (
              <label key={n}>
                <input
                  type="radio"
                  name={sizeName}
                  checked={size === n}
                  onChange={() => onSizeChange(n)}
                />
                <span>
                  {n} <span>{t.exercises}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <button
          type={startType}
          className="primary start-button"
          onClick={() => {
            setPopup(null);
            onStart();
          }}
        >
          {startLabel}
          <span aria-hidden="true"> →</span>
        </button>
      </div>
      {popup && (
        <LevelAgePopup
          anchor={popup.anchor}
          text={popup.text}
          openedAt={popup.at}
          onClose={() => setPopup(null)}
        />
      )}
    </section>
  );
}
