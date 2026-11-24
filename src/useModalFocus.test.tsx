import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, type RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ignoreRepeatClick } from './ignoreRepeatClick';
import { useModalFocus } from './useModalFocus';

function Dialog({
  onEscape,
  restoreTo,
  lastDisabled = false,
}: {
  onEscape: () => void;
  restoreTo: RefObject<HTMLElement | null> | 'opener';
  lastDisabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = useModalFocus(ref, { onEscape, restoreTo });
  return (
    <div ref={ref} role="dialog" onKeyDown={onKeyDown}>
      <button type="button">first</button>
      <div tabIndex={-1} data-testid="box">
        box
      </div>
      <div tabIndex={0}>content</div>
      <button type="button">middle</button>
      <button type="button" disabled={lastDisabled}>
        last
      </button>
    </div>
  );
}

const Opener = ({ open, restoreTo }: { open: boolean; restoreTo: 'ref' | 'opener' }) => {
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} type="button">
        trigger
      </button>
      {open && <Dialog onEscape={() => {}} restoreTo={restoreTo === 'ref' ? trigger : 'opener'} />}
    </>
  );
};

const tab = (shiftKey = false) => {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  const cancelled = !document.activeElement!.dispatchEvent(event);
  return cancelled;
};

describe('useModalFocus', () => {
  it('SCRUM-298: the dialog itself takes focus from a click on its padding (tabindex -1), so Escape and Tab still work', () => {
    const onEscape = vi.fn();
    render(<Dialog onEscape={onEscape} restoreTo="opener" />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('tabindex', '-1');
    dialog.focus(); // what a mouse click on the padding does to a focusable dialog
    expect(dialog).toHaveFocus();
    expect(tab()).toBe(true);
    expect(screen.getByText('first')).toHaveFocus();
    dialog.focus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('focuses the first button on open', () => {
    render(<Dialog onEscape={() => {}} restoreTo="opener" />);
    expect(screen.getByText('first')).toHaveFocus();
  });

  it('closes on Escape', () => {
    const onEscape = vi.fn();
    render(<Dialog onEscape={onEscape} restoreTo="opener" />);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    screen.getByText('first').dispatchEvent(event);
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('wraps Tab at both ends and skips disabled buttons', () => {
    render(<Dialog onEscape={() => {}} restoreTo="opener" lastDisabled />);
    fireEvent.keyDown(screen.getByText('first'), { key: 'Tab', shiftKey: true });
    expect(screen.getByText('middle')).toHaveFocus();
    fireEvent.keyDown(screen.getByText('middle'), { key: 'Tab' });
    expect(screen.getByText('first')).toHaveFocus();
    // Inside the dialog, between the ends: the browser moves focus.
    screen.getByText('content').focus();
    expect(tab()).toBe(false);
    expect(screen.getByText('content')).toHaveFocus();
  });

  it('keeps Tab inside when focus sits on a non-tabbable element', () => {
    render(<Dialog onEscape={() => {}} restoreTo="opener" />);
    screen.getByTestId('box').focus();
    fireEvent.keyDown(screen.getByTestId('box'), { key: 'Tab' });
    expect(screen.getByText('first')).toHaveFocus();
    screen.getByTestId('box').focus();
    fireEvent.keyDown(screen.getByTestId('box'), { key: 'Tab', shiftKey: true });
    expect(screen.getByText('last')).toHaveFocus();
  });

  it('returns focus to a trigger ref without scrolling', () => {
    const { rerender } = render(<Opener open={false} restoreTo="ref" />);
    const trigger = screen.getByText('trigger');
    const focus = vi.spyOn(trigger, 'focus');
    rerender(<Opener open restoreTo="ref" />);
    expect(screen.getByText('first')).toHaveFocus();
    rerender(<Opener open={false} restoreTo="ref" />);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(trigger).toHaveFocus();
  });

  it("returns focus to the opener ('opener') with a plain focus()", () => {
    const { rerender } = render(<Opener open={false} restoreTo="opener" />);
    const trigger = screen.getByText('trigger');
    trigger.focus();
    const focus = vi.spyOn(trigger, 'focus');
    rerender(<Opener open restoreTo="opener" />);
    expect(screen.getByText('first')).toHaveFocus();
    rerender(<Opener open={false} restoreTo="opener" />);
    expect(focus).toHaveBeenCalledWith();
    expect(trigger).toHaveFocus();
  });
});

describe('ignoreRepeatClick', () => {
  const click = (detail: number) => ({ detail, preventDefault: vi.fn() });

  it('cancels the repeat click of a double tap', () => {
    const event = click(2);
    expect(ignoreRepeatClick(event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('lets single clicks and keyboard activation through', () => {
    for (const detail of [0, 1]) {
      const event = click(detail);
      expect(ignoreRepeatClick(event)).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
  });

  it('also cancels a single click while it comes too soon', () => {
    const event = click(1);
    expect(ignoreRepeatClick(event, true)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(ignoreRepeatClick(click(0), true)).toBe(true);
  });
});
