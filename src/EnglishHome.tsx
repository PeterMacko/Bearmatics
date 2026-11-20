import type { RefObject } from 'react';
import type { Copy } from './i18n';
import LevelMenu from './LevelMenu';
import type { Multiplier } from './progress/multipliers';

/** English course level: 1-2 listen and choose (english/words.ts ListenLevel), 3 listen and write. */
export type EnglishLevel = 1 | 2 | 3;
const LEVELS: readonly EnglishLevel[] = [1, 2, 3];

/**
 * English course home: levels and exercise count in the same menu layout as Mathematics.
 * Levels 1-2: listen and choose; level 3: listen and write.
 */
export default function EnglishHome({
  t,
  level,
  size,
  headingRef,
  nextMultiplier,
  onLevelChange,
  onSizeChange,
  onStart,
}: {
  t: Copy;
  level: EnglishLevel;
  size: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** SCRUM-202: the next play's multiplier per level (signed in only). */
  nextMultiplier?: (shown: number) => Multiplier | null;
  onLevelChange: (level: EnglishLevel) => void;
  onSizeChange: (size: number) => void;
  onStart: () => void;
}) {
  return (
    <LevelMenu
      t={t}
      className="selection english-home"
      heading={{ eyebrow: t.englishTrail, title: t.englishChoose, intro: t.englishIntro }}
      levels={LEVELS.map((n) => ({ value: n, shown: n, title: t.englishLevels[n] }))}
      level={level}
      size={size}
      levelName="english-level"
      sizeName="english-size"
      startLabel={t.englishStart}
      startType="button"
      onLevelChange={onLevelChange}
      onSizeChange={onSizeChange}
      onStart={onStart}
      headingRef={headingRef}
      nextMultiplier={nextMultiplier}
    />
  );
}
