import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';
import { copy } from './i18n';
import { LAYOUT } from './layoutSelectors';
import StreakChip from './progress/StreakChip';
import { openMathematics } from './testing/openMathematics';

// SCRUM-201 (CR-17): the layout hooks find their elements by class; a renamed class must not
// silently switch a measurement off.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const expectFound = (selectors: string[]) => {
  for (const selector of selectors)
    expect(document.querySelector(selector), selector).not.toBeNull();
};

test('the menu selectors of AppBar and useMenuLayout find their elements on the Maths menu', () => {
  render(<App />);
  openMathematics();
  expectFound([
    LAYOUT.menuEyebrow,
    LAYOUT.menuHeading,
    LAYOUT.heading,
    LAYOUT.levelList,
    LAYOUT.levelCard,
    LAYOUT.controls,
    LAYOUT.bear,
  ]);
  // useMenuLayout looks for heading, list, controls and bear inside the list's menu element.
  const menu = document.querySelector(LAYOUT.levelList)!.closest('.menu-shell')!;
  for (const selector of [LAYOUT.heading, LAYOUT.controls, LAYOUT.bear])
    expect(menu.querySelector(selector), selector).not.toBeNull();
});

test('a frozen streak in the bar carries the warm-up text AppBar looks for', () => {
  render(<StreakChip t={copy.en.points} streak={{ streak: 3, frozen: true, today: false }} />);
  expectFound([LAYOUT.streakWarmUp]);
});

test('the word grid selectors find the compact lesson and its word buttons', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Let’s listen/ })));
  expectFound([LAYOUT.compactPractice, LAYOUT.wordButton]);
  // useWordGrid reads the compact class from an ancestor of the grid.
  expect(document.querySelector(LAYOUT.wordButton)!.closest(LAYOUT.compactPractice)).not.toBeNull();
});
