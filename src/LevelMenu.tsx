import type { Level } from './math/engine';
import type { Copy } from './i18n';

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const SIZES = [5, 10, 20];

/** Level menu: level choice, exercise count and the start button. */
export default function LevelMenu({
  t,
  level,
  size,
  onLevelChange,
  onSizeChange,
  onStart,
}: {
  t: Copy;
  level: Level;
  size: number;
  onLevelChange: (level: Level) => void;
  onSizeChange: (size: number) => void;
  onStart: () => void;
}) {
  return (
    <section className="selection">
      <div className="menu-heading">
        <p className="eyebrow">{t.trail}</p>
        <h2>{t.choose}</h2>
        <p className="intro">{t.intro}</p>
      </div>
      <fieldset className="level-options">
        <legend className="sr-only">{t.level}</legend>
        {LEVELS.map((n) => (
          <label className={`level-option level-${n}`} key={n}>
            <input
              type="radio"
              name="level"
              value={n}
              checked={level === n}
              onChange={() => onLevelChange(n)}
            />
            <span className="level-number" aria-hidden="true">
              {n}
            </span>
            <span>
              <span className="level-title">
                {t.level} {n} · {t.levels[n]}
              </span>
              <span className="level-detail">{t.details[n]}</span>
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
