import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { releaseStrayTaps, STRAY_TAP_MS, swallowStrayTaps, useShadeClose } from './useShadeClose';

// SCRUM-335 Wave 0 (review RF-05): useShadeClose on its own (until now only through ProfileView
// and Leaderboard): a tap that starts and ends on the shade closes, a drag does not, the settle
// time and double taps, and the stray-tap swallow after a close (mousedown, click and dblclick
// within STRAY_TAP_MS are cancelled; keyboard clicks, detail 0, are not).

let now = 1000;
const wait = (ms: number) => {
  now += ms;
  act(() => vi.advanceTimersByTime(ms));
};

beforeEach(() => {
  now = 1000;
  vi.useFakeTimers();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => {
  releaseStrayTaps();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function Modal({
  onClose,
  anywhere,
  settleMs,
}: {
  onClose: () => void;
  anywhere?: boolean;
  settleMs?: number;
}) {
  const { shadeProps, close } = useShadeClose(onClose, { anywhere, settleMs });
  return (
    <div data-testid="shade" {...shadeProps}>
      <div data-testid="window">
        <button type="button" onClick={(event) => close(event)}>
          Close
        </button>
      </div>
    </div>
  );
}

/** A whole tap: pointer down and up on `down`/`up`, then the click on their common ancestor. */
function tapOn(down: Element, up: Element = down, click: Element = down, detail = 1) {
  fireEvent.pointerDown(down);
  fireEvent.mouseDown(down);
  fireEvent.pointerUp(up);
  fireEvent.mouseUp(up);
  fireEvent.click(click, { detail });
}

const shade = () => screen.getByTestId('shade');
const inside = () => screen.getByTestId('window');

describe('shade tap', () => {
  test('pointer down and up on the shade closes', () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose} />);
    tapOn(shade());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('a drag from inside the window to the shade does not close (QA265-01)', () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose} />);
    tapOn(inside(), shade(), shade());
    expect(onClose).not.toHaveBeenCalled();
  });

  test('a press on the shade released inside the window does not close', () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose} />);
    tapOn(shade(), inside(), shade());
    expect(onClose).not.toHaveBeenCalled();
  });

  test('a tap inside the window does not close; with `anywhere` it does', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Modal onClose={onClose} />);
    tapOn(inside());
    expect(onClose).not.toHaveBeenCalled();
    unmount();
    render(<Modal onClose={onClose} anywhere />);
    tapOn(inside());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('the shade keeps the focus in the window on mousedown', () => {
    render(<Modal onClose={vi.fn()} />);
    expect(fireEvent.mouseDown(shade())).toBe(false); // default prevented
    expect(fireEvent.mouseDown(inside())).toBe(true);
  });
});

describe('settle time', () => {
  test('taps in the first settleMs and second presses (detail > 1) are ignored', () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose} settleMs={STRAY_TAP_MS} />);
    wait(STRAY_TAP_MS - 1);
    tapOn(shade());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }), { detail: 1 });
    expect(onClose).not.toHaveBeenCalled();
    wait(1);
    tapOn(shade(), shade(), shade(), 2);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }), { detail: 2 });
    expect(onClose).not.toHaveBeenCalled();
    tapOn(shade());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('keyboard activation of the own close button closes at once', () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose} settleMs={STRAY_TAP_MS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }), { detail: 0 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('stray taps after closing', () => {
  /** A button on the page under the shade, counting the presses that reach it. */
  function pageButton() {
    const reached: string[] = [];
    const { unmount } = render(
      <button
        type="button"
        onMouseDown={() => reached.push('mousedown')}
        onClick={(e) => reached.push(`click ${e.detail}`)}
        onDoubleClick={() => reached.push('dblclick')}
      >
        Under
      </button>,
    );
    return { button: screen.getByRole('button', { name: 'Under' }), reached, unmount };
  }

  test('the stray-tap time is 600 ms', () => {
    expect(STRAY_TAP_MS).toBe(600);
  });

  test('a shade close swallows mousedown, click and dblclick for 600 ms, not keyboard clicks', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Modal onClose={onClose} />);
    tapOn(shade());
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    const { button, reached } = pageButton();
    wait(STRAY_TAP_MS - 1);
    expect(fireEvent.mouseDown(button)).toBe(false);
    expect(fireEvent.click(button, { detail: 1 })).toBe(false);
    expect(fireEvent.click(button, { detail: 2 })).toBe(false);
    expect(fireEvent.doubleClick(button)).toBe(false);
    expect(reached).toEqual([]);
    // Keyboard activation is never a stray tap.
    expect(fireEvent.click(button, { detail: 0 })).toBe(true);
    expect(reached).toEqual(['click 0']);
    wait(1);
    fireEvent.mouseDown(button);
    fireEvent.click(button, { detail: 1 });
    fireEvent.doubleClick(button);
    expect(reached).toEqual(['click 0', 'mousedown', 'click 1', 'dblclick']);
  });

  test('the own close button by pointer swallows too; by keyboard it does not', () => {
    const onClose = vi.fn();
    const first = render(<Modal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }), { detail: 1 });
    first.unmount();
    let under = pageButton();
    fireEvent.click(under.button, { detail: 1 });
    expect(under.reached).toEqual([]);
    under.unmount();
    releaseStrayTaps();
    const second = render(<Modal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }), { detail: 0 });
    second.unmount();
    expect(onClose).toHaveBeenCalledTimes(2);
    under = pageButton();
    fireEvent.click(under.button, { detail: 1 });
    expect(under.reached).toEqual(['click 1']);
  });

  test('swallowStrayTaps(ms) holds for the given time; releaseStrayTaps ends it at once', () => {
    const { button, reached } = pageButton();
    swallowStrayTaps(100);
    wait(99);
    fireEvent.click(button, { detail: 1 });
    wait(1);
    fireEvent.click(button, { detail: 1 });
    swallowStrayTaps();
    releaseStrayTaps();
    fireEvent.click(button, { detail: 1 });
    expect(reached).toEqual(['click 1', 'click 1']);
  });
});
