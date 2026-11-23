import type { RefObject } from 'react';
import type { Copy } from './i18n';
import MenuHeading from './MenuHeading';

export type Course = 'small' | 'logic' | 'math' | 'english';

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

const ICONS = { small: SmallMathIcon, logic: LogicIcon, math: MathIcon, english: EnglishIcon };

/** First screen: choose Small maths, Logic, Maths or English. */
export default function CourseChoice({
  t,
  headingRef,
  onChoose,
}: {
  t: Copy;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChoose: (course: Course) => void;
}) {
  const courses: { id: Course; title: string; detail: string }[] = [
    { id: 'small', title: t.smallCourse, detail: t.smallCourseDetail },
    { id: 'logic', title: t.logicCourse, detail: t.logicCourseDetail },
    { id: 'math', title: t.mathCourse, detail: t.mathCourseDetail },
    { id: 'english', title: t.englishCourse, detail: t.englishCourseDetail },
  ];
  return (
    <section className="selection course-choice">
      <MenuHeading
        eyebrow={t.courseEyebrow}
        title={t.courseChoose}
        intro={t.courseIntro}
        headingRef={headingRef}
      />
      <ul className="level-options course-options" aria-label={t.courses}>
        {courses.map(({ id, title, detail }) => {
          const Icon = ICONS[id];
          return (
            <li key={id}>
              <button
                type="button"
                className={`level-option course-option course-${id}`}
                aria-labelledby={`course-${id}-title`}
                aria-describedby={`course-${id}-detail`}
                onClick={() => onChoose(id)}
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
