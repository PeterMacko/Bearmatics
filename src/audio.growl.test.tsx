import { expect, test, vi } from 'vitest';
import { FeedbackAudio } from './audio';

// SCRUM-172: the bear's growl is synthesized (no file), about half a second, low, bounded, does
// not cut other sounds, and stays silent while sound is off.

function fixture() {
  const oscillators: {
    type: string;
    frequencies: number[];
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[] = [];
  const gains: { value: number; time: number }[][] = [];
  const context = {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running';
    }),
    close: vi.fn(async () => {}),
    createGain: vi.fn(() => {
      const events: { value: number; time: number }[] = [];
      gains.push(events);
      const record = (value: number, time: number) => events.push({ value, time });
      return {
        gain: {
          setValueAtTime: record,
          linearRampToValueAtTime: record,
          exponentialRampToValueAtTime: record,
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }),
    createOscillator: vi.fn(() => {
      const frequencies: number[] = [];
      const record = (value: number) => frequencies.push(value);
      const node = {
        type: '',
        frequencies,
        frequency: {
          setValueAtTime: record,
          linearRampToValueAtTime: record,
          exponentialRampToValueAtTime: record,
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      oscillators.push(node);
      return node;
    }),
  };
  return { context, oscillators, gains, factory: () => context as unknown as AudioContext };
}

test('growl: low, ~0.5 s, bounded, and silent while sound is off', async () => {
  const f = fixture();
  const player = new FeedbackAudio(f.factory);
  expect(player.play('growl')).toBe(false);
  expect(f.oscillators).toHaveLength(0);
  await player.setEnabled(true);
  expect(player.play('growl')).toBe(true);
  expect(f.oscillators.length).toBeGreaterThan(0);
  for (const o of f.oscillators) {
    expect(Math.max(...o.frequencies)).toBeLessThanOrEqual(300);
    expect(Math.min(...o.frequencies)).toBeGreaterThanOrEqual(60);
    const end = o.stop.mock.calls[0][0] as number;
    expect(end).toBeGreaterThanOrEqual(0.4);
    expect(end).toBeLessThanOrEqual(0.6);
  }
  // Sum of the voices' peak levels leaves headroom below full scale.
  const peaks = f.gains.map((events) => Math.max(...events.map((e) => e.value)));
  expect(peaks.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(0.6);
  // Every voice ends silent.
  for (const events of f.gains) expect(events.at(-1)!.value).toBe(0);
  // Mute: nothing more plays.
  await player.setEnabled(false);
  const count = f.oscillators.length;
  expect(player.play('growl')).toBe(false);
  expect(f.oscillators).toHaveLength(count);
});

test('growl does not cut a running sound', async () => {
  const f = fixture();
  const player = new FeedbackAudio(f.factory);
  await player.setEnabled(true);
  player.play('complete');
  const fanfare = [...f.oscillators];
  player.play('growl');
  // The fanfare's notes were only stopped at their own scheduled end (one call each, with a time).
  for (const o of fanfare) {
    expect(o.stop).toHaveBeenCalledTimes(1);
    expect(o.stop.mock.calls[0]).toHaveLength(1);
  }
});
