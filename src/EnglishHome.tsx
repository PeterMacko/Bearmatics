import type { RefObject } from 'react';
import type { Copy } from './i18n';
import MenuHeading from './MenuHeading';

export type EnglishLevel = 1 | 2 | 3;
const LEVELS: readonly EnglishLevel[] = [1, 2, 3];
const SIZES = [5, 10, 20];

/**
 * English course home: levels and exercise count in the same menu layout as Mathematics.
 * Levels 1-2: listen and choose; level 3: listen and write.
 */
export default function EnglishHome({
  t,
  level,
  size,
  headingRef,
  onLevelChange,
  onSizeChange,
  onBack,
  onStart,
}: {
  t: Copy;
  level: EnglishLevel;
  size: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onLevelChange: (level: EnglishLevel) => void;
  onSizeChange: (size: number) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <section className="selection english-home">
      <MenuHeading
        eyebrow={t.englishTrail}
        title={t.englishChoose}
        intro={t.englishIntro}
        headingRef={headingRef}
        backLabel={t.backToCourses}
        onBack={onBack}
      />
      <fieldset className="level-options">
        <legend className="sr-only">{t.level}</legend>
        {LEVELS.map((n) => (
          <label className={`level-option level-${n}`} key={n}>
            <input
              type="radio"
              name="english-level"
              value={n}
              checked={level === n}
              onChange={() => onLevelChange(n)}
            />
            <span className="level-number" aria-hidden="true">
              {n}
            </span>
            <span>
              <span className="level-title">
                {t.level} {n} · {t.englishLevels[n]}
              </span>
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
                name="english-size"
                checked={size === n}
                onChange={() => onSizeChange(n)}
              />
              <span>
                {n} <span>{t.exercises}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <button type="button" className="primary start-button" onClick={onStart}>
          {t.englishStart}
          <span aria-hidden="true"> →</span>
        </button>
      </div>
    </section>
  );
}
