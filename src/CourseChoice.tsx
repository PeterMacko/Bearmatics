import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Copy } from './i18n';
import { ignoreRepeatClick, SCREEN_SETTLE_MS } from './ignoreRepeatClick';
import MenuHeading from './MenuHeading';
import { watchResize } from './watchResize';

export type Course = 'small' | 'logic' | 'math' | 'english' | 'wordsearch';

function SmallMathIcon() {
  // A die face: count the dots.
  const dots = [
    [20, 20],
    [44, 20],
    [32, 32],
    [20, 44],
    [44, 44],
  ];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#f7a8a0" />
      {dots.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" fill="#7a2e33" />
      ))}
    </svg>
  );
}

function MathIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#ffdc79" />
      <text x="17" y="30" fontSize="20" fontWeight="700" fill="#b63e45" textAnchor="middle">
        1
      </text>
      <text x="47" y="30" fontSize="20" fontWeight="700" fill="#356da6" textAnchor="middle">
        2
      </text>
      <text x="32" y="30" fontSize="18" fontWeight="700" fill="#382a22" textAnchor="middle">
        +
      </text>
      <text x="32" y="53" fontSize="20" fontWeight="700" fill="#382a22" textAnchor="middle">
        = 3
      </text>
    </svg>
  );
}

function LogicIcon() {
  // SCRUM-262: an arrow pointing to a honey pot.
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#c9e3b8" />
      <path
        d="M10 34h17M21 27l7 7-7 7"
        fill="none"
        stroke="#356da6"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="36" y="22" width="18" height="6" rx="3" fill="#a5642a" />
      <path d="M37 28h16c3 4 4 9 3 14-1 6-6 9-11 9s-10-3-11-9c-1-5 0-10 3-14z" fill="#f2a93b" />
      <path d="M38 33h14" stroke="#c47a17" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function EnglishIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        d="M10 8h44a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H28l-12 10v-10h-6a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8z"
        fill="#8cc5ef"
      />
      <text x="32" y="35" fontSize="17" fontWeight="700" fill="#21466d" textAnchor="middle">
        ABC
      </text>
    </svg>
  );
}

function WordSearchIcon() {
  // SCRUM-241: a small letter grid with one word marked (C-A-T).
  const letters = ['C', 'A', 'T', 'O', 'B', 'E', 'D', 'U', 'S'];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#ffd3b0" />
      <rect x="9" y="11" width="46" height="15" rx="7.5" fill="#8cc5ef" />
      {letters.map((letter, i) => (
        <text
          key={letter}
          x={17 + (i % 3) * 15}
          y={23 + Math.floor(i / 3) * 15}
          fontSize="12"
          fontWeight="700"
          fill={i < 3 ? '#21466d' : '#7a4a2a'}
          textAnchor="middle"
        >
          {letter}
        </text>
      ))}
    </svg>
  );
}

/** The course pictures (also on the "Bear picks a game" screen, SCRUM-309). */
export const COURSE_ICONS = {
  small: SmallMathIcon,
  logic: LogicIcon,
  math: MathIcon,
  english: EnglishIcon,
  wordsearch: WordSearchIcon,
};

/** First screen: choose Small maths, Logic, Maths, English or Word search (last, SCRUM-241). */
export default function CourseChoice({
  t,
  headingRef,
  onChoose,
  onBearPicks,
  settleSince = null,
  signedOut = false,
}: {
  t: Copy;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChoose: (course: Course) => void;
  /** SCRUM-309: the "Bear picks a game" mode. */
  onBearPicks: () => void;
  /** When "Bear picks a game" Stop led here: taps within SCREEN_SETTLE_MS are its rest. */
  settleSince?: number | null;
  /** Known to be signed out: the intro invites to sign in and the mode shows no × 1.5. */
  signedOut?: boolean;
}) {
  // QA321-01: Stop's double tap must not open the card (or the mode) now under the finger.
  // Keyboard activation (detail 0) always works.
  const tooSoon = (event: { detail: number }) =>
    event.detail > 0 && settleSince !== null && performance.now() - settleSince < SCREEN_SETTLE_MS;
  // Peter: the Bear picks button ends where the course cards end. The card list keeps room for
  // its scrollbar (Chromium: 15 px, overlay scrollbars: 0), so the button gets the same room.
  const sectionRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const list = section?.querySelector<HTMLElement>('.course-options');
    if (!section || !list) return;
    const measure = () => {
      const style = getComputedStyle(list);
      const gutter =
        list.offsetWidth -
        list.clientWidth -
        parseFloat(style.borderLeftWidth) -
        parseFloat(style.borderRightWidth);
      section.style.setProperty('--course-gutter', `${Math.max(0, gutter)}px`);
    };
    measure();
    return watchResize(measure, [list], { frame: 'next' });
  }, []);
  const courses: { id: Course; title: string; detail: string }[] = [
    { id: 'small', title: t.smallCourse, detail: t.smallCourseDetail },
    { id: 'logic', title: t.logicCourse, detail: t.logicCourseDetail },
    { id: 'math', title: t.mathCourse, detail: t.mathCourseDetail },
    { id: 'english', title: t.englishCourse, detail: t.englishCourseDetail },
    { id: 'wordsearch', title: t.searchCourse, detail: t.searchCourseDetail },
  ];
  return (
    <section
      ref={sectionRef}
      className={`selection course-choice${signedOut ? ' signed-out' : ''}`}
    >
      <MenuHeading
        eyebrow={t.courseEyebrow}
        title={t.courseChoose}
        intro={signedOut ? t.signInNote : t.courseIntro}
        headingRef={headingRef}
      />
      {/* SCRUM-309: above the course cards. In the menu's controls row, so the shared menu
          layout counts it (useMenuLayout: heading, list, controls). */}
      <div className="menu-controls bear-picks-controls">
        <button
          type="button"
          className="primary bear-picks-button"
          aria-labelledby="bear-picks-title"
          aria-describedby="bear-picks-detail"
          onClick={(event) => {
            // Stop on the next-game screen leads here: its double tap must not start again.
            if (!ignoreRepeatClick(event, tooSoon(event))) onBearPicks();
          }}
        >
          <svg className="bear-picks-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="6" cy="6.5" r="3.2" />
            <circle cx="18" cy="6.5" r="3.2" />
            <circle cx="12" cy="13" r="8.5" />
            <circle cx="9" cy="11.5" r="1.2" className="bear-picks-eye" />
            <circle cx="15" cy="11.5" r="1.2" className="bear-picks-eye" />
            <ellipse cx="12" cy="16" rx="3" ry="2.2" className="bear-picks-eye" />
          </svg>
          <span className="bear-picks-text">
            <span id="bear-picks-title" className="bear-picks-title">
              {t.bearPicks.button}
            </span>
            <span id="bear-picks-detail" className="bear-picks-detail">
              {signedOut ? t.bearPicks.buttonDetailOut : t.bearPicks.buttonDetail}
            </span>
          </span>
          <span className="bear-picks-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
      <ul className="level-options course-options" aria-label={t.courses}>
        {courses.map(({ id, title, detail }) => {
          const Icon = COURSE_ICONS[id];
          return (
            <li key={id}>
              <button
                type="button"
                className={`level-option course-option course-${id}`}
                aria-labelledby={`course-${id}-title`}
                aria-describedby={`course-${id}-detail`}
                onClick={(event) => {
                  if (!ignoreRepeatClick(event, tooSoon(event))) onChoose(id);
                }}
              >
                <span className="course-icon">
                  <Icon />
                </span>
                <span>
                  <span id={`course-${id}-title`} className="level-title course-title">
                    {title}
                  </span>
                  <span id={`course-${id}-detail`} className="level-detail">
                    {detail}
                  </span>
                </span>
                <span className="course-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
