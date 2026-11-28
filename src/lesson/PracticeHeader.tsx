import type { ReactNode } from 'react';
import type { Copy } from '../i18n';

/**
 * Lesson header: the level pill and the exercise position ("Exercise 3 of 10"). `children`
 * replace the position line (Pexeso: pairs, points and help).
 */
export default function PracticeHeader({
  t,
  level,
  position,
  children,
}: {
  t: Copy;
  /** The level number shown to the child. */
  level: number;
  position?: string;
  children?: ReactNode;
}) {
  return (
    <div className="practice-header">
      <div className="practice-top">
        <span className="level-pill">
          {t.level} {level}
        </span>
      </div>
      {children ?? (
        <p className="exercise-position" aria-live="polite">
          {position}
        </p>
      )}
    </div>
  );
}
