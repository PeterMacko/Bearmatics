import type { MouseEvent, RefObject } from 'react';
import { COURSE_ICONS } from '../CourseChoice';
import { SMALL_MATH_LEVELS } from '../courses';
import { fill, type Copy } from '../i18n';
import Icon from '../Icon';
import { ignoreRepeatClick, SCREEN_SETTLE_MS } from '../ignoreRepeatClick';
import { ageRange, MAX_AGE, MIN_AGE } from '../levelAges';
import { multiplierName, type Multiplier } from '../progress/multipliers';
import { SESSION_SIZES } from '../session';
import type { Game } from './picker';

/** A game's course name and level name as the menus show them. */
export function gameNames(t: Copy, game: Game): { course: string; level: string } {
  const { course, shown } = game;
  if (course === 'small') {
    const value = SMALL_MATH_LEVELS.find((l) => l.shown === shown)?.value ?? 0;
    return { course: t.smallCourse, level: t.levels[value] };
  }
  if (course === 'math') return { course: t.mathCourse, level: t.levels[shown as 1] };
  if (course === 'logic') return { course: t.logicCourse, level: t.logicLevels[shown as 1] };
  if (course === 'english') return { course: t.englishCourse, level: t.englishLevels[shown as 1] };
  return { course: t.searchCourse, level: t.searchLevels[shown as 1] };
}

/**
 * Guard for buttons that appear under the finger: the repeat click of a double tap
 * (`detail > 1`) and any tap right after the screen changed are ignored. Keyboard activation
 * (detail 0) always works.
 */
const guard = (event: MouseEvent, shownAt: number) =>
  ignoreRepeatClick(event, event.detail > 0 && performance.now() - shownAt < SCREEN_SETTLE_MS);

const AGES = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i) as (
  5 | 6 | 7 | 8 | 9
)[];

/** "How old are you?": 5, 6, 7, 8, 9+ (shown when no age is remembered, or to change it). */
export function PickAgeScreen({
  t,
  age,
  shownAt,
  headingRef,
  onAge,
}: {
  t: Copy;
  /** The remembered age when changing it (marked as chosen); null the first time. */
  age: number | null;
  shownAt: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAge: (age: number) => void;
}) {
  const c = t.bearPicks;
  return (
    <section className="selection pick-screen pick-age">
      <div className="menu-heading">
        <p className="eyebrow">{c.eyebrow}</p>
        <h2 ref={headingRef} tabIndex={-1}>
          {c.ageTitle}
        </h2>
        <p className="intro">{c.ageIntro}</p>
      </div>
      <div className="pick-panel">
        <div className="pick-ages" role="group" aria-label={c.ages}>
          {AGES.map((n) => (
            <button
              key={n}
              type="button"
              className="pick-age-button"
              aria-label={c.ageSaid[n]}
              aria-pressed={age === n}
              onClick={(event) => {
                if (!guard(event, shownAt)) onAge(n);
              }}
            >
              {c.ageShown[n]}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The game the bear picked: Play, Choose another, Stop, the exercise count and Change age. */
export function PickNextScreen({
  t,
  game,
  age,
  size,
  multiplier,
  shownAt,
  headingRef,
  onSize,
  onPlay,
  onAnother,
  onStop,
  onChangeAge,
  signedIn,
  signedOut,
  showSizes = true,
}: {
  t: Copy;
  game: Game;
  age: number;
  size: number;
  /** The table multiplier the next play of this game gets (signed in), as in the level menus. */
  multiplier: Multiplier | null;
  shownAt: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSize: (size: number) => void;
  onPlay: () => void;
  onAnother: () => void;
  onStop: () => void;
  onChangeAge: () => void;
  /** Only signed in lessons save points, so only then the mode's × 1.5 is shown. */
  signedIn: boolean;
  /** Known to be signed out: a note that signing in collects points. */
  signedOut: boolean;
  /** SCRUM-324: false for Pexeso (no exercise count; the remembered count stays). */
  showSizes?: boolean;
}) {
  const c = t.bearPicks;
  const names = gameNames(t, game);
  const ages = ageRange(game.course, game.shown);
  const sign = multiplier && multiplier !== 1 ? multiplierName(multiplier) : null;
  const CourseIcon = COURSE_ICONS[game.course];
  return (
    <section className="selection pick-screen pick-next">
      <div className="menu-heading">
        <p className="eyebrow">{c.eyebrow}</p>
        <h2 ref={headingRef} tabIndex={-1}>
          {c.nextTitle}
        </h2>
      </div>
      <div className="pick-panel">
        {/* Announced again when Choose another shows a new game. */}
        <div className={`pick-game course-${game.course}`} aria-live="polite" aria-atomic="true">
          <span className="course-icon pick-game-icon">
            <CourseIcon />
          </span>
          <span className="pick-game-text">
            <span className="pick-game-course">{names.course}</span>
            <span className="pick-game-tags">
              {ages && (
                <>
                  <span className="pick-tag pick-tag-age" aria-hidden="true">
                    {ages.from}–{ages.to}
                  </span>
                  <span className="sr-only">{fill(t.levelAges, ages)}</span>
                </>
              )}
              {sign && (
                <>
                  <span
                    className={`pick-tag pick-tag-table next-play-${sign}`}
                    aria-hidden="true"
                    data-next-play={multiplier}
                  >
                    {t.points.nextPlaySign[sign]}
                  </span>
                  <span className="sr-only">{t.points.nextPlay[sign]}</span>
                </>
              )}
              {signedIn && (
                <>
                  <span className="pick-tag pick-tag-mode" aria-hidden="true">
                    {c.modeSign}
                  </span>
                  <span className="sr-only">{c.modeSaid}</span>
                </>
              )}
            </span>
            <span className="pick-game-level">
              {t.level} {game.shown} · {names.level}
            </span>
          </span>
        </div>
        {signedOut && <p className="pick-note">{t.signInNote}</p>}
        {showSizes && (
          <fieldset className="session-options pick-sizes">
            <legend>{t.count}</legend>
            {SESSION_SIZES.map((n) => (
              <label key={n}>
                <input
                  type="radio"
                  name="pick-size"
                  checked={size === n}
                  onChange={() => onSize(n)}
                />
                <span>
                  {n} <span>{t.exercises}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="pick-actions">
          <button
            type="button"
            className="primary pick-play"
            onClick={(event) => {
              if (!guard(event, shownAt)) onPlay();
            }}
          >
            <Icon name="play" />
            {c.play}
          </button>
          <button
            type="button"
            className="secondary pick-another"
            onClick={(event) => {
              // Deliberate taps may follow each other; the repeat click of a double tap and the
              // rest of the tap that opened this screen do not pick again.
              if (!guard(event, shownAt)) onAnother();
            }}
          >
            <Icon name="replay" />
            {c.another}
          </button>
          <button
            type="button"
            className="secondary pick-stop"
            onClick={(event) => {
              if (!guard(event, shownAt)) onStop();
            }}
          >
            <Icon name="door" />
            {c.stop}
          </button>
          <button
            type="button"
            className="secondary pick-change-age"
            onClick={(event) => {
              if (!guard(event, shownAt)) onChangeAge();
            }}
          >
            {fill(c.changeAge, { age: c.ageShown[age as 5] })}
          </button>
        </div>
      </div>
    </section>
  );
}
