import type { RefObject } from 'react';
import type { Level } from './math/engine';
import type { CourseLevel } from './courses';
import type { Copy } from './i18n';
import MenuHeading from './MenuHeading';

const SIZES = [5, 10, 20];

/** Level menu of a maths course: level choice, exercise count and the start button. */
export default function LevelMenu({
  t,
  levels,
  heading,
  level,
  size,
  onLevelChange,
  onSizeChange,
  onStart,
  headingRef,
}: {
  t: Copy;
  levels: CourseLevel[];
  heading: { eyebrow: string; title: string; intro: string };
  level: Level;
  size: number;
  onLevelChange: (level: Level) => void;
  onSizeChange: (size: number) => void;
  onStart: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section className="selection">
      <MenuHeading {...heading} headingRef={headingRef} />
      <fieldset className="level-options">
        <legend className="sr-only">{t.level}</legend>
        {levels.map(({ value, shown }) => (
          <label className={`level-option level-${shown}`} key={value}>
            <input
              type="radio"
              name="level"
              value={value}
              checked={level === value}
              onChange={() => onLevelChange(value)}
            />
            <span className="level-number" aria-hidden="true">
              {shown}
            </span>
            <span>
              <span className="level-title">
                {t.level} {shown} · {t.levels[value]}
              </span>
              <span className="level-detail">{t.details[value]}</span>
            </span>
            <span className="selection-dot" aria-hidden="true" />
          </label>
        ))}
      </fieldset>
      <div className="menu-controls">
        <fieldset className="session-options">
          <legend>{t.count}</legend>
          {SIZES.map((n) => (
            <label key={n}>
              <input
                type="radio"
                name="size"
                checked={size === n}
                onChange={() => onSizeChange(n)}
              />
              <span>
                {n} <span>{t.exercises}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <button className="primary start-button" onClick={onStart}>
          {t.start}
          <span aria-hidden="true"> →</span>
        </button>
      </div>
    </section>
  );
}
