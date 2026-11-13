import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import * as math from './math/engine';
import { FeedbackAudio } from './audio';
import App from './App';

const button = (name: string) => screen.getByRole('button', { name });
const click = (name: string) => fireEvent.click(button(name));
const settings = () => click('Settings');
const close = () => click('Close settings');
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

test('sound is desired initially without autoplay; Start lazily activates', async () => {
  const activate = vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockResolvedValue(true);
  const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  settings();
  expect(button('Sound requested')).toHaveAttribute('aria-pressed', 'true');
  close();
  expect(activate).not.toHaveBeenCalled();
  expect(play).not.toHaveBeenCalled();
  click('Let’s count');
  expect(activate).toHaveBeenCalledExactlyOnceWith(true);
  await flush();
  settings();
  expect(button('Sound on')).toHaveAttribute('aria-pressed', 'true');
});

test.each([5, 10, 20])(
  'fanfare waits for all %i originals and mastery; no StrictMode or UI replays',
  async (size) => {
    vi.spyOn(math, 'generateSession').mockReturnValue(
      Array(size).fill({ level: 1, operation: '+', values: [1, 2, 3], blank: 2 }),
    );
    vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockResolvedValue(true);
    const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole('radio', { name: `${size} exercises` }));
    click('Let’s count');
    await flush();
    const answer = (value: string) => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value } });
      click('Check answer');
    };
    const fanfares = () => play.mock.calls.filter(([outcome]) => outcome === 'complete');
    for (let i = 0; i < size; i++) {
      click('Check answer'); // invalid is quiet
      if (i === size - 1) answer('9');
      answer('3');
      fireEvent.submit(screen.getByRole('textbox').closest('form')!);
      expect(fanfares()).toHaveLength(0);
      click(i === size - 1 ? 'Review tricky ones' : 'Next exercise');
    }
    expect(fanfares()).toHaveLength(0);
    answer('9');
    answer('3');
    click('Next exercise'); // retry does not clear mastery
    expect(fanfares()).toHaveLength(0);
    click('Show a hint');
    click('Close hint');
    answer('3');
    click('Next exercise');
    expect(fanfares()).toHaveLength(0); // hinted review also cannot complete
    answer('3');
    const finish = button('See how you did');
    act(() => {
      fireEvent.click(finish);
      fireEvent.click(finish);
    });
    expect(fanfares()).toHaveLength(1);
    settings();
    click('Slovenčina');
    click('Zavrieť nastavenia');
    click('Nastavenia');
    click('English');
    click('Sound on');
    click('Sound off');
    await flush();
    close();
    settings();
    close();
    expect(fanfares()).toHaveLength(1);
    click('Play again');
    await flush();
    for (let i = 0; i < size; i++) {
      answer('3');
      click(i === size - 1 ? 'See how you did' : 'Next exercise');
    }
    expect(fanfares()).toHaveLength(2);
  },
);

test('explicit mute before Start remains off and does not activate', async () => {
  const activate = vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockResolvedValue(false);
  const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
  render(<App />);
  settings();
  click('Sound requested');
  close();
  click('Let’s count');
  await flush();
  expect(activate.mock.calls).toEqual([[false]]);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '999' } });
  click('Check answer');
  expect(play).not.toHaveBeenCalled();
  settings();
  expect(button('Sound off')).toHaveAttribute('aria-pressed', 'false');
});

test('pending activation is mutable and stale completion cannot unmute or replay', async () => {
  let resolve!: (enabled: boolean) => void;
  vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockImplementation((value) =>
    value
      ? new Promise<boolean>((r) => {
          resolve = r;
        })
      : Promise.resolve(false),
  );
  const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
  vi.spyOn(math, 'generateSession').mockReturnValue(
    Array(5).fill({ level: 1, operation: '+', values: [1, 2, 3], blank: 2 }),
  );
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  click('Let’s count');
  settings();
  expect(button('Sound requested')).not.toBeDisabled();
  click('Sound requested');
  close();
  for (let i = 0; i < 5; i++) {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
    click('Check answer');
    click(i === 4 ? 'See how you did' : 'Next exercise');
  }
  await act(async () => resolve(true));
  settings();
  expect(button('Sound off')).toHaveAttribute('aria-pressed', 'false');
  expect(play).not.toHaveBeenCalled();
  click('Sound off');
  await act(async () => resolve(true));
  close();
  expect(play).not.toHaveBeenCalled();
});

test('activation finishing after a whole silent session never replays completion or feedback', async () => {
  let resolve!: (enabled: boolean) => void;
  vi.spyOn(FeedbackAudio.prototype, 'setEnabled').mockImplementation(
    () =>
      new Promise<boolean>((r) => {
        resolve = r;
      }),
  );
  const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
  vi.spyOn(math, 'generateSession').mockReturnValue(
    Array(5).fill({ level: 1, operation: '+', values: [1, 2, 3], blank: 2 }),
  );
  render(<App />);
  fireEvent.click(screen.getByRole('radio', { name: '5 exercises' }));
  click('Let’s count');
  for (let i = 0; i < 5; i++) {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } });
    click('Check answer');
    click(i === 4 ? 'See how you did' : 'Next exercise');
  }
  await act(async () => resolve(true));
  expect(play).not.toHaveBeenCalled();
});

test('blocked Start keeps preference, explains silence locally and retries only on later gesture', async () => {
  const activate = vi
    .spyOn(FeedbackAudio.prototype, 'setEnabled')
    .mockResolvedValueOnce(false)
    .mockResolvedValue(true);
  const play = vi.spyOn(FeedbackAudio.prototype, 'play').mockReturnValue(true);
  render(<App />);
  click('Let’s count');
  await flush();
  settings();
  expect(button('Sound unavailable')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Sound isn’t available in this browser.')).toBeInTheDocument();
  click('Slovenčina');
  expect(screen.getByText('Zvuk tu nie je dostupný.')).toBeInTheDocument();
  click('English');
  close();
  expect(activate).toHaveBeenCalledTimes(1);
  expect(play).not.toHaveBeenCalled();
  click('Check answer');
  await flush();
  expect(activate).toHaveBeenCalledTimes(2);
  expect(play).not.toHaveBeenCalled();
});
