import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, test, vi } from 'vitest';
import App from '../App';
import { copy } from '../i18n';
import { MATH_LEVELS, SMALL_MATH_LEVELS } from '../courses';
import { openMathematics } from '../testing/openMathematics';
import AboutPage from './AboutPage';
import { aboutCopy, SHOTS } from './aboutCopy';
import { aboutHref, aboutRoute, browserLanguage } from './aboutRoute';

describe('About page addresses (SCRUM-218)', () => {
  it.each([
    ['/about/sk', ['en-US'], { language: 'sk', explicit: true }],
    ['/about/sk/', ['en-US'], { language: 'sk', explicit: true }],
    ['/about/en', ['sk-SK'], { language: 'en', explicit: true }],
    ['/about/en/', ['sk'], { language: 'en', explicit: true }],
    ['/about', ['sk-SK', 'en'], { language: 'sk', explicit: false }],
    ['/about/', ['sk'], { language: 'sk', explicit: false }],
    ['/about', ['en-GB', 'sk'], { language: 'en', explicit: false }],
    ['/about', ['de-DE'], { language: 'en', explicit: false }],
    ['/about', [], { language: 'en', explicit: false }],
    ['/about/xx', ['sk-SK'], { language: 'sk', explicit: false }],
    ['/about/xx', ['cs-CZ'], { language: 'en', explicit: false }],
    ['/about/SK', ['en'], { language: 'en', explicit: false }],
  ])('%s with browser languages %j', (path, languages, route) => {
    expect(aboutRoute(path, languages)).toEqual(route);
  });

  it.each([
    '/',
    '/index.html',
    '/aboutx',
    '/abouts/sk',
    '/about/sk/more',
    '/api/about',
    '/x/about',
  ])('%s is the app, not the About page', (path) => {
    expect(aboutRoute(path, ['sk'])).toBeNull();
  });

  it('follows only the preferred (first) browser language', () => {
    expect(browserLanguage(['SK'])).toBe('sk');
    expect(browserLanguage(['sk-SK', 'en'])).toBe('sk');
    expect(browserLanguage(['en-US', 'sk-SK'])).toBe('en');
    expect(aboutHref('sk')).toBe('/about/sk');
    expect(aboutHref('en')).toBe('/about/en');
  });
});

describe.each(['en', 'sk'] as const)('About page in %s', (language) => {
  const a = aboutCopy[language];
  const t = copy[language];

  it('sets the page language and title and has headings in order', () => {
    render(<AboutPage language={language} />);
    expect(document.documentElement.lang).toBe(language);
    expect(document.title).toBe(a.pageTitle);
    const headings = screen
      .getAllByRole('heading')
      .map((heading) => `${heading.tagName} ${heading.textContent}`);
    expect(headings).toEqual([
      `H1 ${a.title}`,
      `H2 ${a.coursesTitle}`,
      `H2 ${a.lessonTitle}`,
      `H2 ${a.signInTitle}`,
      `H2 ${a.dataTitle}`,
      `H3 ${t.account.privacyTitle}`,
    ]);
    expect(screen.getByRole('main')).toHaveTextContent(a.intro);
  });

  it('shows the ten screenshots of its language (SCRUM-241: Word search; SCRUM-299: Logic patterns), lazily, sized and with alt text', () => {
    render(<AboutPage language={language} />);
    const images = screen.getAllByRole('img');
    expect(images.map((image) => image.getAttribute('src'))).toEqual(
      [
        'course',
        'small-maths',
        'take-away',
        'logic',
        'patterns',
        'english',
        'wordsearch',
        'summary',
        'app-bar',
        'leaderboard',
      ].map((shot) => `/about/${language}/${shot}.webp`),
    );
    expect(SHOTS).toHaveLength(10);
    for (const [index, image] of images.entries()) {
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image).toHaveAttribute('width', '390');
      expect(image).toHaveAttribute('height', '844');
      expect(image).toHaveAccessibleName(a.shots[SHOTS[index]].alt);
      expect(a.shots[SHOTS[index]].alt.length).toBeGreaterThan(30);
    }
    expect(new Set(images.map((image) => image.getAttribute('alt'))).size).toBe(10);
  });

  it('links every screenshot to its full-size file in a new tab (O1)', () => {
    render(<AboutPage language={language} />);
    for (const [index, image] of screen.getAllByRole('img').entries()) {
      const link = image.closest('a')!;
      expect(link).toHaveAttribute('href', image.getAttribute('src'));
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener');
      expect(link).toHaveAccessibleName(`${a.shots[SHOTS[index]].alt} ${a.opensFull}`);
    }
  });

  it('"Full details" moves focus to the What we store heading (O3)', async () => {
    render(<AboutPage language={language} />);
    const heading = screen.getByRole('heading', {
      level: 3,
      name: copy[language].account.privacyTitle,
    });
    expect(heading).toHaveAttribute('tabindex', '-1');
    const link = screen.getByRole('link', { name: copy[language].account.privacyTitle });
    expect(link).toHaveAttribute('href', '#about-store');
    fireEvent.click(link);
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('names every level exactly as the app does', () => {
    render(<AboutPage language={language} />);
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    for (const { value, shown } of [...SMALL_MATH_LEVELS, ...MATH_LEVELS])
      expect(items).toContain(`${t.level} ${shown}: ${t.levels[value]} (${a.levelDetails[value]})`);
    for (const value of [1, 2, 3] as const)
      expect(items).toContain(`${t.level} ${value}: ${t.englishLevels[value]}`);
    // SCRUM-262: Logic, level 1.
    expect(items).toContain(`${t.level} 1: ${t.logicLevels[1]} (${a.logicDetail})`);
    // SCRUM-289: Logic, level 2 (stones).
    expect(items).toContain(`${t.level} 2: ${t.logicLevels[2]} (${a.logicDetail2})`);
    // SCRUM-299: Logic, levels 3-5 (picture patterns).
    expect(items).toContain(`${t.level} 3: ${t.logicLevels[3]} (${a.logicDetail3})`);
    expect(items).toContain(`${t.level} 4: ${t.logicLevels[4]} (${a.logicDetail4})`);
    expect(items).toContain(`${t.level} 5: ${t.logicLevels[5]} (${a.logicDetail5})`);
    // SCRUM-241: Word search, levels 1-3 with their About details.
    for (const value of [1, 2, 3] as const)
      expect(items).toContain(
        `${t.level} ${value}: ${t.searchLevels[value]} (${a.searchDetails[value]})`,
      );
    for (const course of [
      t.smallCourse,
      t.logicCourse,
      t.mathCourse,
      t.englishCourse,
      t.searchCourse,
    ])
      expect(screen.getByText(course, { selector: 'strong' })).toBeInTheDocument();
  });

  it('SCRUM-289 / SCRUM-299: the privacy list says the device remembers the Logic demos were seen', () => {
    render(<AboutPage language={language} />);
    const list = document.querySelector<HTMLElement>('.privacy-list')!;
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toContain(
      language === 'en'
        ? 'On this device the app remembers that the Logic demos (the bear’s way and the picture rows) were seen; nothing is sent.'
        : 'Na tomto zariadení si aplikácia pamätá, že ukážky v Logike (cesta medveďa a rady obrázkov) už boli pozreté; nič sa neodosiela.',
    );
  });

  it('names the age 5–9 (SCRUM-262)', () => {
    render(<AboutPage language={language} />);
    expect(screen.getByRole('main')).toHaveTextContent(
      language === 'en' ? 'children aged 5–9' : 'pre deti od 5 do 9 rokov',
    );
  });

  it('shows the full "What we store" list of the profile', () => {
    render(<AboutPage language={language} />);
    const page = document.body.textContent!;
    for (const line of t.account.privacy) expect(page).toContain(line);
    const list = document.querySelector('.privacy-list')!;
    expect(within(list as HTMLElement).getAllByRole('listitem')).toHaveLength(
      t.account.privacy.length - 1,
    );
    expect(screen.getByRole('link', { name: t.account.privacyTitle })).toHaveAttribute(
      'href',
      '#about-store',
    );
    expect(screen.getByRole('link', { name: 'mr.petermacko@gmail.com' }).getAttribute('href')).toBe(
      'mailto:mr.petermacko@gmail.com',
    );
  });

  it('keeps the bear surprise a surprise', () => {
    render(<AboutPage language={language} />);
    const page = document.body.textContent!.toLowerCase();
    for (const word of ['brum', 'grrr', copy.en.bearTap.toLowerCase(), 'tap the bear', 'ťukni'])
      expect(page).not.toContain(word);
  });

  it('has a top bar with the logo + Bearmatics (app in this language) and the language switch', () => {
    render(<AboutPage language={language} />);
    const bar = screen.getByRole('banner');
    // The bar comes before the page title; the old "Open Bearmatics" links are gone.
    expect(bar.compareDocumentPosition(screen.getByRole('heading', { level: 1 }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /open bearmatics|otvoriť/i }),
    ).not.toBeInTheDocument();
    const home = within(bar).getByRole('link', { name: 'Bearmatics' });
    expect(home).toHaveAttribute('href', `/?lang=${language}`);
    const logo = home.querySelector('img')!;
    expect(logo).toHaveAttribute('src', '/favicon.svg');
    expect(logo).toHaveAttribute('alt', '');
    expect(screen.getAllByRole('link', { name: 'Bearmatics' })).toHaveLength(1);
    const switcher = within(bar).getByRole('navigation', { name: 'Language / Jazyk' });
    const links = within(switcher).getAllByRole('link');
    // Full accessible names (EN/SK is only the short visible text on small screens).
    expect(
      links.map((link) => [
        link.getAttribute('lang'),
        link.querySelector('.about-lang-name')!.textContent,
        link.querySelector('[aria-hidden="true"]')!.textContent,
        link.getAttribute('href'),
      ]),
    ).toEqual([
      ['sk', 'Slovenčina', 'SK', '/about/sk'],
      ['en', 'English', 'EN', '/about/en'],
    ]);
    expect(within(switcher).getByRole('link', { name: 'Slovenčina' })).toBe(links[0]);
    expect(within(switcher).getByRole('link', { name: 'English' })).toBe(links[1]);
    expect(links.find((link) => link.getAttribute('aria-current') === 'page')).toHaveAttribute(
      'href',
      `/about/${language}`,
    );
  });
});

test('Settings links to the About page in the current app language', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  const dialog = screen.getByRole('dialog', { name: 'Settings' });
  expect(within(dialog).getByRole('link', { name: 'About Bearmatics' })).toHaveAttribute(
    'href',
    '/about/en',
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Slovenčina' }));
  expect(within(dialog).getByRole('link', { name: 'O aplikácii' })).toHaveAttribute(
    'href',
    '/about/sk',
  );
});

test('the About link asks first when a lesson has unsaved work, and Stay keeps it', () => {
  render(<App />);
  openMathematics();
  fireEvent.click(screen.getByRole('button', { name: 'Let’s count' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  const link = screen.getByRole('link', { name: 'About Bearmatics' });
  // Not followed: the leave question comes first.
  expect(fireEvent.click(link)).toBe(false);
  expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Leave this trail?' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Keep practising' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue('7');
});

test('the About link opens straight away when nothing would be lost', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  // Followed like any link (jsdom does not navigate): no leave question.
  expect(fireEvent.click(screen.getByRole('link', { name: 'About Bearmatics' }))).toBe(true);
  expect(screen.queryByRole('dialog', { name: 'Leave this trail?' })).not.toBeInTheDocument();
});

test.each([
  ['en', "Let's play", '/?lang=en'],
  ['sk', 'Poď hrať', '/?lang=sk'],
] as const)(
  'the bar has a blue "%s" play button into the game in the page language',
  (language, name, href) => {
    render(<AboutPage language={language} />);
    const bar = screen.getByRole('banner');
    const play = within(bar).getByRole('link', { name });
    expect(play).toHaveAttribute('href', href);
    expect(play).toHaveClass('about-play');
    // After the language switch, so it reads last in the bar.
    const links = within(bar).getAllByRole('link');
    expect(links.at(-1)).toBe(play);
    // The short arrow is decoration; the words stay the name.
    expect(within(play).getByText('»')).toHaveAttribute('aria-hidden', 'true');
  },
);

test.each([
  [
    'en',
    'It also shows how long the lesson took and about how long one exercise took. The time is not saved anywhere.',
  ],
  [
    'sk',
    'Uvidíš aj, ako dlho lekcia trvala a koľko asi trval jeden príklad. Čas sa nikam neukladá.',
  ],
] as const)('SCRUM-211: the %s About page explains the lesson time', (language, sentence) => {
  render(<AboutPage language={language} />);
  expect(screen.getByText(sentence)).toBeInTheDocument();
});

test('SCRUM-258: the leaderboard sentence mentions the bear badge (EN and SK)', () => {
  expect(aboutCopy.en.signIn).toContain(
    'A leaderboard shows nickname, bear, bear badge, streak and points of players; you can hide yourself in the profile.',
  );
  expect(aboutCopy.sk.signIn).toContain(
    'Rebríček ukazuje prezývku, medveďa, medvedí odznak, sériu a body hráčov; v profile sa môžeš skryť.',
  );
});

test('SCRUM-281: the About page says Sign out and Delete account ask a grown-up question (EN and SK)', () => {
  expect(aboutCopy.en.signIn).toContain(
    'Sign out and Delete account first ask a question for a grown-up, so a child cannot press them by mistake.',
  );
  expect(aboutCopy.sk.signIn).toContain(
    'Pri odhlásení a zmazaní účtu sa najprv objaví otázka pre dospelého, aby to dieťa neurobilo omylom.',
  );
  for (const language of ['en', 'sk'] as const) {
    const { unmount } = render(<AboutPage language={language} />);
    expect(screen.getByText(aboutCopy[language].signIn.at(-1)!)).toBeInTheDocument();
    unmount();
  }
});

test.each([
  [
    'en',
    'Every level in the level menu shows a suggested age, for example 5–7. It is only a guide: every level can always be chosen.',
  ],
  [
    'sk',
    'Každá úroveň v ponuke úrovní ukazuje odporúčaný vek, napríklad 5–7. Je to len pomôcka: vybrať sa dá vždy každá úroveň.',
  ],
] as const)(
  'SCRUM-308: the %s About page says every level shows a suggested age',
  (language, sentence) => {
    render(<AboutPage language={language} />);
    expect(screen.getByText(sentence)).toBeInTheDocument();
    // Right after "Choose a level ...", in "How a lesson works".
    expect(aboutCopy[language].lesson.indexOf(sentence)).toBe(1);
  },
);
