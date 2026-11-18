import type { Copy } from '../i18n';

/** Lesson header: the level pill and the exercise position ("Exercise 3 of 10"). */
export default function PracticeHeader({
  t,
  level,
  position,
}: {
  t: Copy;
  /** The level number shown to the child. */
  level: number;
  position: string;
}) {
  return (
    <div className="practice-header">
      <div className="practice-top">
        <span className="level-pill">
          {t.level} {level}
        </span>
      </div>
      <p className="exercise-position" aria-live="polite">
        {position}
      </p>
    </div>
  );
}
