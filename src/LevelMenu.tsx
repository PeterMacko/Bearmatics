import type { RefObject } from 'react';
import type { Copy } from './i18n';
import MenuHeading from './MenuHeading';
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
}: {
  t: Copy;
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
}) {
  return (
    <section className={className}>
      <MenuHeading {...heading} headingRef={headingRef} />
      <fieldset className="level-options">
        <legend className="sr-only">{t.level}</legend>
        {levels.map(({ value, shown, title, detail }) => (
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
            </span>
            <span>
              <span className="level-title">
                {t.level} {shown} · {title}
              </span>
              {detail !== undefined && <span className="level-detail">{detail}</span>}
            </span>
            <span className="selection-dot" aria-hidden="true" />
          </label>
        ))}
      </fieldset>
      <div className="menu-controls">
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
        <button type={startType} className="primary start-button" onClick={onStart}>
          {startLabel}
          <span aria-hidden="true"> →</span>
        </button>
      </div>
    </section>
  );
}
