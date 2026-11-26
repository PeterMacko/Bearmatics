import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';
import { copy } from './i18n';
import LevelMenu from './LevelMenu';
import { LEVEL_AGES } from './levelAges';
import type { PointsCourse } from './progress/multipliers';
import { fakeServer, reply } from './testing/fakeServer';

// SCRUM-308 round 2 (Peter: "small popup when user click on years that say recommended for
// age"): a tap on a level's age badge opens a small aria-hidden popup "Recommended for ages 5–7"
// / "Odporúčané pre vek 5–7 rokov", and the same tap still chooses that level. One popup at a
// time; it closes on a tap elsewhere, Escape, Start and by itself after 3 s, never changing the
// chosen level.

const COURSES: PointsCourse[] = ['small', 'math', 'logic', 'english', 'wordsearch'];
const popupText = (lang: 'en' | 'sk', from: number, to: number) =>
  lang === 'en' ? `Recommended for ages ${from}–${to}` : `Odporúčané pre vek ${from}–${to} rokov`;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

function Menu({
  course,
  lang = 'en',
  onStart = () => {},
}: {
  course: PointsCourse;
  lang?: 'en' | 'sk';
  onStart?: () => void;
}) {
  const levels = LEVEL_AGES.filter((r) => r.course === course).map((r) => ({
    value: r.shown,
    shown: r.shown,
    title: `Game ${r.shown}`,
  }));
  const [level, setLevel] = useState(levels[0].value);
  const headingRef = useRef<HTMLHeadingElement>(null);
  return (
    <>
      <p data-testid="outside">elsewhere</p>
      <LevelMenu
        t={copy[lang]}
        course={course}
        heading={{ eyebrow: 'E', title: 'Levels', intro: 'Intro' }}
        levels={levels}
        level={level}
        size={10}
        startLabel="Start"
        onLevelChange={setLevel}
        onSizeChange={() => {}}
        onStart={onStart}
        headingRef={headingRef}
      />
    </>
  );
}

const badge = (shown: number) =>
  document.querySelector<HTMLElement>(`.level-option.level-${shown} .level-age`)!;
const popups = () => [...document.querySelectorAll<HTMLElement>('.level-age-popup')];
const radio = (shown: number) =>
  document.querySelector<HTMLInputElement>(`.level-option.level-${shown} input`)!;
/** A tap: pointerdown, then the click (the browser's order; touch gives the same click). */
const tap = (el: Element) => {
  fireEvent.pointerDown(el);
  fireEvent.click(el);
};

for (const lang of ['en', 'sk'] as const)
  test(`a tap on the age badge shows the age popup per table and chooses the level (${lang}, 21 levels)`, () => {
    let seen = 0;
    for (const course of COURSES) {
      const { unmount } = render(<Menu course={course} lang={lang} />);
      for (const row of LEVEL_AGES.filter((r) => r.course === course)) {
        tap(badge(row.shown));
        expect(popups().map((p) => p.textContent)).toEqual([popupText(lang, row.from, row.to)]);
        expect(popups()[0].getAttribute('aria-hidden')).toBe('true');
        // Rendered outside the level list (body), so the list's scroll box cannot clip it.
        expect(popups()[0].closest('.level-options')).toBeNull();
        expect(radio(row.shown)).toBeChecked();
        seen++;
      }
      unmount();
    }
    expect(seen).toBe(21);
  });

test('the badge stays aria-hidden and out of the tab order; accessible names unchanged', () => {
  render(<Menu course="math" />);
  tap(badge(4));
  expect(popups()).toHaveLength(1);
  expect(badge(4).getAttribute('aria-hidden')).toBe('true');
  expect(badge(4).hasAttribute('tabindex')).toBe(false);
  expect(screen.getByRole('radio', { name: /^Level 4 / })).toHaveAccessibleName(
    'Level 4 · Game 4Ages 7 to 9',
  );
});

test('a tap elsewhere closes the popup without changing the chosen level', () => {
  render(<Menu course="math" />);
  tap(badge(3));
  expect(popups()).toHaveLength(1);
  tap(screen.getByTestId('outside'));
  expect(popups()).toHaveLength(0);
  expect(radio(3)).toBeChecked();
});

test('a tap on the popup itself closes it and changes nothing', () => {
  render(<Menu course="math" />);
  tap(badge(5));
  tap(popups()[0]);
  expect(popups()).toHaveLength(0);
  expect(radio(5)).toBeChecked();
});

test('Escape closes the popup without changing the chosen level', () => {
  render(<Menu course="logic" />);
  tap(badge(2));
  expect(popups()).toHaveLength(1);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(popups()).toHaveLength(0);
  expect(radio(2)).toBeChecked();
});

test('only one popup: a tap on another badge closes the first and opens its own', () => {
  render(<Menu course="math" lang="sk" />);
  tap(badge(1));
  tap(badge(6));
  expect(popups().map((p) => p.textContent)).toEqual(['Odporúčané pre vek 8–9 rokov']);
  expect(radio(6)).toBeChecked();
  expect(radio(1)).not.toBeChecked();
});

test('the popup closes by itself after 3 s; a second tap on the same badge keeps it and restarts the time', () => {
  vi.useFakeTimers();
  render(<Menu course="english" />);
  tap(badge(3));
  act(() => vi.advanceTimersByTime(2000));
  expect(popups()).toHaveLength(1);
  tap(badge(3));
  act(() => vi.advanceTimersByTime(2000));
  expect(popups().map((p) => p.textContent)).toEqual(['Recommended for ages 8–9']);
  act(() => vi.advanceTimersByTime(1100));
  expect(popups()).toHaveLength(0);
  expect(radio(3)).toBeChecked();
});

test('Start closes the popup', () => {
  const onStart = vi.fn();
  render(<Menu course="wordsearch" onStart={onStart} />);
  tap(badge(2));
  expect(popups()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: /Start/ }));
  expect(onStart).toHaveBeenCalledTimes(1);
  expect(popups()).toHaveLength(0);
});

test('in the app: the Maths menu badge opens the popup; going back to the courses closes it', async () => {
  fakeServer(({ path }) => {
    if (path === '/api/me') return reply({ account: null });
    if (path === '/api/auth/google') return reply({ available: false });
    return reply({ error: 'not_found' }, 404);
  });
  render(<App />);
  await act(async () => {});
  fireEvent.click(document.querySelector<HTMLElement>('.course-option.course-math')!);
  tap(badge(4));
  expect(popups().map((p) => p.textContent)).toEqual(['Recommended for ages 7–9']);
  expect(screen.getByRole('radio', { name: /^Level 4 / })).toBeChecked();
  tap(screen.getByRole('button', { name: copy.en.backToCourses }));
  expect(popups()).toHaveLength(0);
});
