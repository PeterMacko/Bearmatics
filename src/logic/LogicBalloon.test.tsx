import { readFileSync } from 'node:fs';
import { fireEvent, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { advance, tap } from '../testing/ui';
import * as bearPath from './bearPath';
import type { BearPuzzle } from './bearPath';
import { DEMO_KEYS } from '../demoSeen';

const DEMO_SEEN_KEY = DEMO_KEYS['bear-path'];
import { DEMO_MS } from './LogicDemo';
import { BACK_MS, STEP_MS } from './LogicPracticeView';
import {
  BALLOON_BOX,
  BALLOON_FADE_MS,
  BALLOON_IDLE_MS,
  BALLOON_SHOW_MS,
  balloonBoard,
  balloonSide,
  useIdleBalloon,
} from './useIdleBalloon';
import { openLogic } from '../testing/openCourse';

// SCRUM-289 / SCRUM-294: the picture demo once per device, and the "?" balloon.

const at = (row: number, col: number) => ({ row, col });
/** Bear at row 2, column 1; honey at row 3, column 3 (right, right, down). */
const PUZZLE: BearPuzzle = { bear: at(1, 0), honey: at(2, 2) };
const exact = (name: string) => screen.getByRole('button', { name });
const demo = () => document.querySelector('.logic-demo');
const board = () => document.querySelector('.logic-board');
const balloon = () => document.querySelector<HTMLElement>('.logic-balloon');
const plan = (...arrows: string[]) => arrows.forEach((arrow) => tap(arrow));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(bearPath, 'generateBearSession').mockImplementation((size) =>
    Array.from({ length: size }, () => PUZZLE),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Start (from the Logic menu); the demo, if it plays, is left running. */
function start(size = '5 exercises') {
  fireEvent.click(screen.getByRole('radio', { name: size }));
  tap('Let’s plan');
}
/** Back to the Logic menu (nothing planned: no question). */
const back = () => fireEvent.click(screen.getByRole('button', { name: 'Choose level' }));

describe('demo once per device', () => {
  test('fresh device: the demo plays; after it finished, later lessons (both levels) start with the puzzle', () => {
    expect(localStorage.getItem(DEMO_SEEN_KEY)).toBeNull();
    openLogic();
    start();
    expect(demo()).not.toBeNull();
    expect(board()).toBeNull();
    advance(DEMO_MS - 10);
    expect(localStorage.getItem(DEMO_SEEN_KEY)).toBeNull();
    advance(20);
    expect(demo()).toBeNull();
    expect(localStorage.getItem(DEMO_SEEN_KEY)).toBe('1');
    back();
    start();
    expect(demo()).toBeNull();
    expect(board()).not.toBeNull();
    expect(board()).toHaveFocus();
    back();
    fireEvent.click(screen.getByRole('radio', { name: /^Level 2 · Around the stones/ }));
    start();
    expect(demo()).toBeNull();
    expect(board()).not.toBeNull();
  });

  test('leaving during the demo is not "seen": the next lesson shows it again', () => {
    openLogic();
    start();
    advance(DEMO_MS - 200);
    back();
    expect(localStorage.getItem(DEMO_SEEN_KEY)).toBeNull();
    advance(DEMO_MS);
    expect(localStorage.getItem(DEMO_SEEN_KEY)).toBeNull();
    start();
    expect(demo()).not.toBeNull();
  });

  test('the flag set on Level 2 counts for Level 1 too (one flag per device)', () => {
    openLogic();
    fireEvent.click(screen.getByRole('radio', { name: /^Level 2 · Around the stones/ }));
    start();
    advance(DEMO_MS + 10);
    back();
    fireEvent.click(screen.getByRole('radio', { name: /^Level 1 · Bear goes to the honey/ }));
    start();
    expect(demo()).toBeNull();
  });

  test('Show me still replays the demo after the flag is set', () => {
    localStorage.setItem(DEMO_SEEN_KEY, '1');
    openLogic();
    start();
    expect(demo()).toBeNull();
    plan('Right');
    tap('Show me');
    expect(screen.getByRole('img', { name: /^Demo/ })).toBeInTheDocument();
    advance(DEMO_MS + 10);
    expect(demo()).toBeNull();
    expect(screen.getByRole('list', { name: /^Arrows:/ })).toHaveAccessibleName('Arrows: right');
  });

  test('blocked storage (reading and writing throw): the demo plays at every lesson, as before', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    });
    openLogic();
    start();
    expect(demo()).not.toBeNull();
    advance(DEMO_MS + 10);
    expect(board()).not.toBeNull();
    back();
    start();
    expect(demo()).not.toBeNull();
  });
});

describe('the "?" balloon', () => {
  test('first puzzle: pops in when the bear appears after the demo, fades after 3 s', () => {
    openLogic();
    start();
    expect(balloon()).toBeNull(); // hidden while the demo plays
    advance(DEMO_MS + 10);
    expect(balloon()).not.toBeNull();
    expect(balloon()).toHaveAttribute('data-phase', 'shown');
    advance(BALLOON_SHOW_MS - 20);
    expect(balloon()).toHaveAttribute('data-phase', 'shown');
    advance(30);
    expect(balloon()).toHaveAttribute('data-phase', 'fading');
    advance(BALLOON_FADE_MS);
    expect(balloon()).toBeNull();
  });

  test('first puzzle without the demo (already seen): pops in at once', () => {
    localStorage.setItem(DEMO_SEEN_KEY, '1');
    openLogic();
    start();
    expect(balloon()).toHaveAttribute('data-phase', 'shown');
  });

  test('a picture only: aria-hidden, no button, no text for screen readers, takes no taps', () => {
    localStorage.setItem(DEMO_SEEN_KEY, '1');
    openLogic();
    start();
    const b = balloon()!;
    expect(b).toHaveAttribute('aria-hidden', 'true');
    expect(b.closest('button, [role="button"], [tabindex]:not(.logic-board)')).toBeNull();
    expect(b.querySelector('button, a, [tabindex]')).toBeNull();
    // Inside the bear's picture box, which ignores pointer events (CSS), outside the board's
    // accessible name (the board is role=img with its own label).
    expect(b.closest('.logic-bear')).not.toBeNull();
    expect(screen.getByRole('img', { name: /^Bear: row 2/ })).toHaveAccessibleName(
      'Bear: row 2, column 1. Honey: row 3, column 3.',
    );
    expect(document.getElementById('answer-feedback')).toHaveTextContent('');
  });

  test('every 30 s without a tap or key it pops in again; a tap or a key restarts the 30 s', () => {
    localStorage.setItem(DEMO_SEEN_KEY, '1');
    openLogic();
    start(); // the bear appears at 0 s: first pop
    let now = 0;
    const until = (t: number) => {
      advance(t - now);
      now = t;
    };
    until(BALLOON_SHOW_MS + BALLOON_FADE_MS);
    expect(balloon()).toBeNull();
    until(29_990);
    expect(balloon()).toBeNull();
    until(30_000);
    expect(balloon()).toHaveAttribute('data-phase', 'shown');
    until(33_300);
    expect(balloon()).toBeNull();
    until(59_990);
    expect(balloon()).toBeNull();
    until(60_000); // a further 30 s
    expect(balloon()).toHaveAttribute('data-phase', 'shown');
    until(80_000);
    expect(balloon()).toBeNull();
    fireEvent.pointerDown(document.body); // a tap at 80 s: next pop at 110 s, not 90 s
    until(109_990);
    expect(balloon()).toBeNull();
    until(110_000);
    expect(balloon()).toHaveAttribute('data-phase', 'shown');
    until(130_000);
    fireEvent.keyDown(document.body, { key: 'Shift' }); // a key (even Shift) restarts it too
    until(159_990);
    expect(balloon()).toBeNull();
    until(160_000);
    expect(balloon()).not.toBeNull();
  });

  test('other puzzles (also review): not at the start, only after 30 s idle', () => {
    localStorage.setItem(DEMO_SEEN_KEY, '1');
    openLogic();
    start();
    // Puzzle 1 right, puzzle 2 wrong first (review later), then right.
    plan('Right', 'Right', 'Down');
    tap('Go');
    advance(STEP_MS * 4 + 200);
    expect(balloon()).toBeNull(); // hidden once solved
    tap('Next exercise');
    expect(balloon()).toBeNull();
    advance(BALLOON_IDLE_MS - 10);
    expect(balloon()).toBeNull();
    advance(20);
    expect(balloon()).toHaveAttribute('data-phase', 'shown');
    fireEvent.pointerDown(document.body);
    plan('Down');
    tap('Go');
    expect(balloon()).toBeNull(); // hidden while the bear walks
    advance(STEP_MS * 2 + BACK_MS + 200);
    tap('Remove last arrow');
    for (let i = 1; i < 5; i++) {
      plan('Right', 'Right', 'Down');
      tap('Go');
      advance(STEP_MS * 4 + 200);
      tap(i < 4 ? 'Next exercise' : 'Review tricky ones');
    }
    expect(screen.getByText('Review · 1 to practise')).toBeInTheDocument();
    expect(balloon()).toBeNull();
    advance(BALLOON_IDLE_MS - 10);
    expect(balloon()).toBeNull();
    advance(20);
    expect(balloon()).not.toBeNull();
  });

  test('hidden during Show me, during the walk and after solving; no first pop again after Show me', () => {
    openLogic();
    start();
    advance(DEMO_MS + 10);
    expect(balloon()).not.toBeNull();
    tap('Show me');
    expect(balloon()).toBeNull();
    advance(DEMO_MS + 10);
    expect(balloon()).toBeNull(); // the bear "first appears" only once
    advance(BALLOON_IDLE_MS - 100);
    expect(balloon()).toBeNull();
    advance(100); // 30 s after the demo ended
    expect(balloon()).not.toBeNull();
    plan('Right', 'Right', 'Down');
    tap('Go');
    expect(balloon()).toBeNull();
    advance(STEP_MS * 4 + 200);
    expect(exact('Next exercise')).toBeInTheDocument();
    advance(BALLOON_IDLE_MS * 3);
    expect(balloon()).toBeNull();
  });

  test('leaving the lesson stops every balloon timer', () => {
    localStorage.setItem(DEMO_SEEN_KEY, '1');
    const { result, unmount } = renderHook(() => useIdleBalloon({ active: true, first: true }));
    expect(result.current).toBe('shown');
    expect(vi.getTimerCount()).toBe(3); // idle, fade start, gone
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('reduced motion: the balloon appears and goes without growing or fading', () => {
    localStorage.setItem(DEMO_SEEN_KEY, '1');
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
        }) as unknown as MediaQueryList,
    );
    openLogic();
    start();
    expect(balloon()).toHaveAttribute('data-still', 'true');
  });
});

describe('balloon placement', () => {
  test('on every one of the 16 bear cells the balloon stays inside the board, in the bear row', () => {
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++) {
        const [left, top, right, bottom] = balloonBoard({ row, col });
        expect(left, `${row},${col}`).toBeGreaterThanOrEqual(0);
        expect(right, `${row},${col}`).toBeLessThanOrEqual(4);
        expect(top).toBeGreaterThanOrEqual(row);
        expect(bottom).toBeLessThanOrEqual(row + 1);
        expect(balloonSide({ row, col })).toBe(col === 3 ? 'left' : 'right');
      }
  });

  test('it reaches only into the next cell of the bear row, so it never covers the honey', () => {
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++) {
        const [left, , right] = balloonBoard({ row, col });
        const reached = [Math.floor(left), Math.ceil(right) - 1];
        // Cells touched: the bear's own and one neighbour 1 move away; the honey is 2+ away.
        for (const c of reached) expect(Math.abs(c - col)).toBeLessThanOrEqual(1);
        expect(new Set(reached).size).toBe(2);
      }
    // The CSS box is the pinned one (in % of the bear's cell).
    const logicCss = readFileSync('src/styles/logic.css', 'utf8');
    expect(BALLOON_BOX).toEqual({ from: 0.68, width: 0.64, top: 0, height: 0.58 });
    const rule = logicCss.match(/\n\.logic-balloon \{([^}]*)\}/)![1];
    for (const [prop, value] of [
      ['top', BALLOON_BOX.top],
      ['left', BALLOON_BOX.from],
      ['width', BALLOON_BOX.width],
      ['height', BALLOON_BOX.height],
    ] as const)
      expect(rule).toContain(`${prop}: ${Math.round(value * 100)}%;`);
    expect(logicCss).toMatch(/\.logic-balloon\[data-side='left'\] \{[^}]*right: 68%;/);
  });
});
