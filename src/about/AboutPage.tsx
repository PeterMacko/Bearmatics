import { useEffect, useRef, type MouseEvent } from 'react';
import { copy, type Language } from '../i18n';
import { MATH_LEVELS, SMALL_MATH_LEVELS } from '../courses';
import { PrivacyList } from '../account/PrivacyList';
import { aboutCopy, SHOT_SIZE, type Shot } from './aboutCopy';
import { aboutHref, appHref } from './aboutRoute';
import './about.css';

const LANGUAGES: { value: Language; name: string; short: string }[] = [
  { value: 'sk', name: 'Slovenčina', short: 'SK' },
  { value: 'en', name: 'English', short: 'EN' },
];

/**
 * The fixed top bar: logo + Bearmatics (opens the app in the page's language) and the language
 * switch. Its height (it grows with large text) becomes the page's `scroll-padding-top`, so in-page
 * jumps and keyboard focus land below it (plus `scroll-margin-top` in about.css).
 */
function AboutBar({ language, label }: { language: Language; label: string }) {
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = bar.current!;
    const root = document.documentElement;
    const update = () => {
      // Focus scrolling (Tab, Shift+Tab) and jumps keep clear of the bar in both engines.
      root.style.scrollPaddingTop = `${element.offsetHeight}px`;
    };
    update();
    // Firefox leaves a partly visible link where it is when Tab/Shift+Tab reaches it, even with
    // most of it under the bar: bring a keyboard-focused link fully below the bar.
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || element.contains(target)) return;
      if (!target.matches(':focus-visible')) return;
      if (target.getBoundingClientRect().top < element.getBoundingClientRect().bottom)
        target.scrollIntoView({ block: 'nearest' });
    };
    document.addEventListener('focusin', onFocus);
    if (typeof ResizeObserver === 'undefined')
      return () => document.removeEventListener('focusin', onFocus);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      document.removeEventListener('focusin', onFocus);
      observer.disconnect();
      root.style.removeProperty('scroll-padding-top');
    };
  }, []);
  return (
    <header className="about-bar" ref={bar}>
      <div className="about-bar-inner">
        <a className="about-home" href={appHref(language)}>
          <img src="/favicon.svg" alt="" width={32} height={32} />
          <span className="about-home-name">Bearmatics</span>
        </a>
        <nav className="about-languages" aria-label={label}>
          {LANGUAGES.map(({ value, name, short }) => (
            <a
              key={value}
              href={aboutHref(value)}
              lang={value}
              hrefLang={value}
              aria-current={value === language ? 'page' : undefined}
            >
              {/* Full name where there is room, EN/SK on small screens; the name stays full. */}
              <span className="about-lang-name">{name}</span>
              <span className="about-lang-short" aria-hidden="true">
                {short}
              </span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

/**
 * An in-page jump: the browser scrolls to the target (below the fixed bar, scroll-margin-top in
 * about.css), then focus moves to it so keyboard and screen reader users continue there.
 */
function focusTarget(event: MouseEvent<HTMLAnchorElement>) {
  const { hash } = event.currentTarget;
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  const focus = () => target.focus({ preventScroll: true });
  // After the browser's own jump (hashchange): focusing earlier, Firefox's jump resets where Tab
  // continues from. Already at that address there is no hashchange.
  if (location.hash === hash) setTimeout(focus);
  else window.addEventListener('hashchange', focus, { once: true });
}

/** One phone screenshot; only loaded when it scrolls near (the app never loads these). */
function Screenshot({ language, shot }: { language: Language; shot: Shot }) {
  const { caption, alt } = aboutCopy[language].shots[shot];
  const src = `/about/${language}/${shot}.webp`;
  return (
    <figure className="about-shot">
      {/* The full-size picture in a new tab (Tester observation O1: the text is small). */}
      <a
        className="about-shot-link"
        href={src}
        target="_blank"
        rel="noopener"
        aria-label={`${alt} ${aboutCopy[language].opensFull}`}
      >
        <img
          src={src}
          width={SHOT_SIZE.width}
          height={SHOT_SIZE.height}
          loading="lazy"
          decoding="async"
          alt={alt}
        />
      </a>
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
 * English. Its own page at /about[/sk|/en]: no app bar, no sounds. The Bearmatics link and the language
 * switch are ordinary links, so they work like any web page (new tab, back, refresh).
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
      <AboutBar language={language} label={a.languages} />
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
              {a.dataLast}{' '}
              <a href="#about-store" onClick={focusTarget}>
                {t.account.privacyTitle}
              </a>
            </li>
          </ul>
          <h3 id="about-store" tabIndex={-1}>
            {t.account.privacyTitle}
          </h3>
          <p>{t.account.privacy[0]}</p>
          <PrivacyList lines={t.account.privacy.slice(1)} />
        </section>
      </main>
    </div>
  );
}
