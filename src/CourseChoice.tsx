import type { RefObject } from 'react';
import type { Copy } from './i18n';
import MenuHeading from './MenuHeading';

export type Course = 'math' | 'english';

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

const ICONS = { math: MathIcon, english: EnglishIcon };

/** First screen: choose Mathematics or English. */
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
