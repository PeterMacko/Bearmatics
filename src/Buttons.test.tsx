import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { copy } from './i18n';
import SummaryView from './SummaryView';
import LeaveDialog from './LeaveDialog';
import FeedbackLine from './lesson/FeedbackLine';
import SummaryPoints from './progress/SummaryPoints';
import StreakOffer from './progress/StreakOffer';
import LeaderboardDialog from './progress/LeaderboardDialog';
import { staticFrame } from './progress/animation';

// SCRUM-172: former text buttons are secondary buttons; every listed button has its icon
// before the text, hidden from assistive technology, and keeps its accessible name.

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** The button by exact name; asserts the icon comes first and is decorative. */
function expectIcon(button: HTMLElement, icon: string) {
  const svg = button.firstElementChild;
  expect(svg?.tagName.toLowerCase()).toBe('svg');
  expect(svg).toHaveAttribute('data-icon', icon);
  expect(svg).toHaveAttribute('aria-hidden', 'true');
  expect(svg).toHaveAttribute('focusable', 'false');
  // Nothing visible or announced before the icon.
  expect(button.childNodes[0]).toBe(svg);
}

for (const language of ['en', 'sk'] as const) {
  const t = copy[language];

  test(`${language}: summary buttons: Play again (primary) and Choose level (secondary)`, () => {
    render(
      <SummaryView
        t={t}
        total={5}
        firstTry={4}
        headingRef={{ current: null }}
        onAgain={() => {}}
        onBack={() => {}}
      />,
    );
    const again = screen.getByRole('button', { name: t.again });
    expectIcon(again, 'replay');
    expect(again).toHaveClass('primary');
    const back = screen.getByRole('button', { name: t.back });
    expectIcon(back, 'list');
    expect(back).toHaveClass('secondary');
    expect(back).not.toHaveClass('text-button');
  });

  test(`${language}: leave dialog: Keep practising and Choose a new trail`, () => {
    render(<LeaveDialog t={t} onStay={() => {}} onLeave={() => {}} />);
    const stay = screen.getByRole('button', { name: t.stay });
    expectIcon(stay, 'play');
    const leave = screen.getByRole('button', { name: t.leave });
    expectIcon(leave, 'door');
    expect(leave).toHaveClass('secondary');
  });

  test(`${language}: English word failure: Try again`, () => {
    render(
      <FeedbackLine kind="ready" playError={{ t, onRetry: () => {} }}>
        {''}
      </FeedbackLine>,
    );
    const retry = screen.getByRole('button', { name: t.tryAgain });
    expectIcon(retry, 'replay');
    expect(retry).toHaveClass('secondary');
  });

  test(`${language}: points not saved: Try again`, () => {
    render(
      <SummaryPoints
        t={t.points}
        save={{ state: 'failed' }}
        frame={staticFrame(0)}
        newBadge={0}
        onRetry={() => {}}
      />,
    );
    const retry = screen.getByRole('button', { name: t.points.retry });
    expectIcon(retry, 'replay');
    expect(retry).toHaveClass('secondary');
  });

  test(`${language}: streak offer: Unlock, No thanks, then Yes and Back`, async () => {
    vi.useFakeTimers();
    render(
      <StreakOffer
        t={t.points}
        offer={{ streak: 12, missed: 2, cost: 14 }}
        points={135}
        onAnswered={() => {}}
        onClose={() => {}}
        onWarm={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    const unlock = within(dialog).getByRole('button', { name: t.points.unlock });
    expectIcon(unlock, 'unlock');
    const no = within(dialog).getByRole('button', { name: t.points.noThanks });
    expectIcon(no, 'cross');
    expect(no).toHaveClass('secondary');
    act(() => vi.advanceTimersByTime(700));
    fireEvent.click(unlock, { detail: 1 });
    const yes = within(dialog).getByRole('button', { name: t.points.yes });
    expectIcon(yes, 'tick');
    const back = within(dialog).getByRole('button', { name: t.points.back });
    expectIcon(back, 'back');
    expect(back).toHaveClass('secondary');
  });

  test(`${language}: leaderboard failure: Try again`, async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    render(
      <LeaderboardDialog
        t={t.points}
        hidden={false}
        triggerRef={{ current: null }}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    const retry = await within(dialog).findByRole('button', {
      name: t.points.retry,
    });
    expectIcon(retry, 'replay');
    expect(retry).toHaveClass('secondary');
  });
}

test('no text-button is left in the app', () => {
  const files = import.meta.glob('./**/*.tsx', { query: '?raw', import: 'default', eager: true });
  const offenders = Object.entries(files)
    .filter(([path]) => !path.endsWith('.test.tsx'))
    .filter(([, source]) => String(source).includes('text-button'))
    .map(([path]) => path);
  expect(offenders).toEqual([]);
});
