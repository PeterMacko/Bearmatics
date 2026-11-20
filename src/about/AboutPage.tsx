import { useEffect } from 'react';
import { copy, type Language } from '../i18n';
import { MATH_LEVELS, SMALL_MATH_LEVELS } from '../courses';
import { PrivacyList } from '../account/PrivacyList';
import { aboutCopy, SHOT_SIZE, type Shot } from './aboutCopy';
import { aboutHref } from './aboutRoute';
import './about.css';

const LANGUAGES: { value: Language; name: string }[] = [
  { value: 'sk', name: 'Slovenčina' },
  { value: 'en', name: 'English' },
];

/** One phone screenshot; only loaded when it scrolls near (the app never loads these). */
function Screenshot({ language, shot }: { language: Language; shot: Shot }) {
  const { caption, alt } = aboutCopy[language].shots[shot];
  return (
    <figure className="about-shot">
      <img
        src={`/about/${language}/${shot}.webp`}
        width={SHOT_SIZE.width}
        height={SHOT_SIZE.height}
        loading="lazy"
        decoding="async"
        alt={alt}
      />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function Shots({ language, shots }: { language: Language; shots: Shot[] }) {
  return (
    <div className="about-shots">
      {shots.map((shot) => (
        <Screenshot key={shot} language={language} shot={shot} />
      ))}
    </div>
  );
}

/**
 * About page for parents (SCRUM-218): what the app does today, with screenshots, in Slovak and
 * English. Its own page at /about[/sk|/en]: no app bar, no sounds. Language switch and "Open
 * Bearmatics" are ordinary links, so they work like any web page (new tab, back, refresh).
 */
export default function AboutPage({ language }: { language: Language }) {
  const a = aboutCopy[language];
  const t = copy[language];
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = a.pageTitle;
  }, [language, a.pageTitle]);
  const level = (shown: number, name: string, detail: string) => (
    <li key={shown}>
      {t.level} {shown}: {name} ({detail})
    </li>
  );
  return (
    <div className="about-page">
      <header className="about-header">
        <span className="about-brand">Bearmatics</span>
        <nav className="about-languages" aria-label={a.languages}>
          {LANGUAGES.map(({ value, name }) => (
            <a
              key={value}
              href={aboutHref(value)}
              lang={value}
              hrefLang={value}
              aria-current={value === language ? 'page' : undefined}
            >
              {name}
            </a>
          ))}
        </nav>
        <a className="about-open" href="/">
          {a.open}
        </a>
      </header>
      <main className="about-main">
        <h1>{a.title}</h1>
        <p className="about-intro">{a.intro}</p>
        <Shots language={language} shots={['course']} />

        <section aria-labelledby="about-courses">
          <h2 id="about-courses">{a.coursesTitle}</h2>
          <ul className="about-courses">
            <li>
              <strong>{t.smallCourse}</strong>, {a.smallLead}:
              <ul>
                {SMALL_MATH_LEVELS.map(({ value, shown }) =>
                  level(shown, t.levels[value], a.levelDetails[value]),
                )}
              </ul>
            </li>
            <li>
              <strong>{t.mathCourse}</strong>:
              <ul>
                {MATH_LEVELS.map(({ value, shown }) =>
                  level(shown, t.levels[value], a.levelDetails[value]),
                )}
              </ul>
            </li>
            <li>
              <strong>{t.englishCourse}</strong>, {a.englishLead}:
              <ul>
                {([1, 2, 3] as const).map((value) => (
                  <li key={value}>
                    {t.level} {value}: {t.englishLevels[value]}
                  </li>
                ))}
              </ul>
            </li>
          </ul>
          <Shots language={language} shots={['small-maths', 'take-away', 'english']} />
        </section>

        <section aria-labelledby="about-lesson">
          <h2 id="about-lesson">{a.lessonTitle}</h2>
          <ul>
            {a.lesson.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <Shots language={language} shots={['summary']} />
        </section>

        <section aria-labelledby="about-sign-in">
          <h2 id="about-sign-in">{a.signInTitle}</h2>
          <ul>
            {a.signIn.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <Shots language={language} shots={['app-bar', 'leaderboard']} />
        </section>

        <section aria-labelledby="about-data">
          <h2 id="about-data">{a.dataTitle}</h2>
          <ul>
            {a.data.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>
              {a.dataLast} <a href="#about-store">{t.account.privacyTitle}</a>
            </li>
          </ul>
          <h3 id="about-store">{t.account.privacyTitle}</h3>
          <p>{t.account.privacy[0]}</p>
          <PrivacyList lines={t.account.privacy.slice(1)} />
        </section>
      </main>
      <footer className="about-footer">
        <a className="about-open" href="/">
          {a.open}
        </a>
      </footer>
    </div>
  );
}
