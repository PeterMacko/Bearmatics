import { expect, test, vi } from 'vitest';
import * as audio from './audio';
type Player = { setEnabled(value: boolean): Promise<boolean>; play(outcome: 'correct' | 'incorrect' | 'complete'): boolean; dispose(): void };
const PlayerClass = (audio as Record<string, unknown>).FeedbackAudio as new (factory?: () => AudioContext) => Player;
function fixture() {
  const nodes: { stop: ReturnType<typeof vi.fn> }[] = [];
  const envelopes: { value: number; time: number }[][] = [];
  const frequencies: number[] = [];
  const context = {
    state: 'suspended', currentTime: 0, destination: {},
    resume: vi.fn(async () => { context.state = 'running'; }), close: vi.fn(async () => { context.state = 'closed'; }),
    createGain: vi.fn(() => { const events: { value: number; time: number }[] = []; envelopes.push(events); const record = (value: number, time: number) => events.push({ value, time }); return { gain: { setValueAtTime: record, linearRampToValueAtTime: record }, connect: vi.fn(), disconnect: vi.fn() }; }),
    createOscillator: vi.fn(() => { const node = { frequency: { setValueAtTime: (value: number) => frequencies.push(value) }, type: '', connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }; nodes.push(node); return node; }),
  };
  return { nodes, frequencies, envelopes, context, factory: vi.fn(() => context as unknown as AudioContext) };
}
test('engine is gesture-activated, success and retry are distinct, and mute immediately stops pending tones', async () => {
  expect(PlayerClass).toBeTypeOf('function');
  const f = fixture(); const player = new PlayerClass(f.factory);
  expect(player.play('correct')).toBe(false); expect(f.factory).not.toHaveBeenCalled();
  expect(await player.setEnabled(true)).toBe(true);
  expect(player.play('correct')).toBe(true); const success = [...f.frequencies];
  expect(success.length).toBeGreaterThan(0);
  f.frequencies.length = 0; expect(player.play('incorrect')).toBe(true);
  expect(f.frequencies).not.toEqual(success);
  await player.setEnabled(false);
  for (const node of f.nodes) expect(node.stop).toHaveBeenCalledWith();
  expect(player.play('correct')).toBe(false);
  player.dispose(); expect(f.context.close).toHaveBeenCalled();
});
test('unavailable audio fails closed without throwing', async () => {
  expect(PlayerClass).toBeTypeOf('function');
  const player = new PlayerClass(() => { throw new Error('Audio unavailable'); });
  expect(await player.setEnabled(true)).toBe(false);
  expect(player.play('incorrect')).toBe(false); expect(() => player.dispose()).not.toThrow();
});
test('muting cancels an in-flight audio activation', async () => {
  expect(PlayerClass).toBeTypeOf('function');
  const f = fixture(); let resume!: () => void;
  f.context.resume.mockImplementation(() => new Promise<void>(resolve => { resume = () => { f.context.state = 'running'; resolve(); }; }));
  const player = new PlayerClass(f.factory); const activating = player.setEnabled(true);
  await player.setEnabled(false); resume();
  expect(await activating).toBe(false); expect(player.play('correct')).toBe(false);
});

test('feedback has a stronger smooth envelope with bounded aggregate headroom', async () => {
  for (const outcome of ['correct', 'incorrect', 'complete'] as const) {
    const f = fixture(); const player = new PlayerClass(f.factory);
    await player.setEnabled(true); player.play(outcome);
    for (const events of f.envelopes) {
      expect(events[0].value).toBe(0);
      expect(events[1].value).toBe(0.6);
      expect(events[2].value).toBe(0.48);
      expect(events[2].time).toBeGreaterThan(events[1].time);
      expect(events[1].time - events[0].time).toBeCloseTo(0.015, 10);
      expect(events.at(-1)!.value).toBe(0);
    }
    // A sum of piecewise-linear envelopes can peak only at an event boundary.
    for (const t of f.envelopes.flat().map(event => event.time)) {
      const sum = f.envelopes.reduce((total, events) => {
        const i = events.findIndex(e => e.time >= t);
        if (i <= 0) return total;
        const a = events[i - 1], b = events[i];
        return total + a.value + (b.value - a.value) * (t - a.time) / (b.time - a.time);
      }, 0);
      expect(sum).toBeLessThanOrEqual(0.65);
    }
    const old = [...f.nodes]; player.play(outcome);
    for (const node of old) expect(node.stop).toHaveBeenCalledWith();
  }
});

test('correct tune lasts one second with non-overlapping rising notes and mute cancels all', async () => {
  const f = fixture(); const player = new PlayerClass(f.factory);
  await player.setEnabled(true); player.play('correct');
  expect(f.frequencies).toEqual([523.25, 659.25, 783.99]);
  expect(f.envelopes.map(events => events[0].time)).toEqual([0, 0.22, 0.44]);
  expect(f.envelopes.map(events => events.at(-1)!.time)).toEqual([0.2, 0.42, 1]);
  for (const [index, node] of f.nodes.entries()) expect(node.stop).toHaveBeenCalledWith(f.envelopes[index].at(-1)!.time);
  await player.setEnabled(false);
  for (const node of f.nodes) expect(node.stop).toHaveBeenCalledWith();
});

test('gentle descending retry lasts 0.9 seconds and mute cancels all notes', async () => {
  const f = fixture(); const player = new PlayerClass(f.factory);
  await player.setEnabled(true); player.play('incorrect');
  expect(f.frequencies).toEqual([329.63, 261.63]);
  expect(f.envelopes.map(events => events[0].time)).toEqual([0, 0.26]);
  expect(f.envelopes.map(events => events.at(-1)!.time)).toEqual([0.24, 0.9]);
  for (const [index, node] of f.nodes.entries()) expect(node.stop).toHaveBeenCalledWith(f.envelopes[index].at(-1)!.time);
  await player.setEnabled(false);
  for (const node of f.nodes) expect(node.stop).toHaveBeenCalledWith();
});

test('completion is a distinct two-second fanfare, bounded and immediately mutable', async () => {
  const f = fixture(); const player = new PlayerClass(f.factory);
  await player.setEnabled(true); player.play('complete');
  expect(f.frequencies).toEqual([523.25, 659.25, 783.99, 1046.5]);
  expect(f.envelopes.at(-1)!.at(-1)!.time).toBeCloseTo(2);
  for (let t = 0; t <= 2; t += 0.001) {
    const sum = f.envelopes.reduce((total, events) => {
      const i = events.findIndex(e => e.time >= t);
      if (i <= 0) return total;
      const a = events[i - 1], b = events[i];
      return total + a.value + (b.value - a.value) * (t - a.time) / (b.time - a.time);
    }, 0);
    expect(sum).toBeLessThanOrEqual(0.65);
  }
  await player.setEnabled(false);
  for (const node of f.nodes) expect(node.stop).toHaveBeenCalledWith();
  expect(player.play('complete')).toBe(false);
});

test('each cue captures one currentTime anchor even while the audio clock advances', async () => {
  for (const outcome of ['correct', 'incorrect', 'complete'] as const) {
    const f = fixture(); let reads = 0;
    Object.defineProperty(f.context, 'currentTime', { get: () => 10 + reads++ * 0.01 });
    const player = new PlayerClass(f.factory);
    await player.setEnabled(true); player.play(outcome);
    expect(reads).toBe(1);
    expect(f.envelopes[0][0].time).toBe(10);
    expect(f.envelopes.at(-1)!.at(-1)!.time).toBe(10 + (outcome === 'complete' ? 2 : outcome === 'correct' ? 1 : 0.9));
  }
});

test('dispose cancels pending activation and never schedules stale completion', async () => {
  const f = fixture(); let resume!: () => void;
  f.context.resume.mockImplementation(() => new Promise<void>(resolve => { resume = () => { f.context.state = 'running'; resolve(); }; }));
  const player = new PlayerClass(f.factory); const activating = player.setEnabled(true);
  player.dispose(); resume();
  expect(await activating).toBe(false);
  expect(player.play('complete')).toBe(false);
  expect(f.nodes).toHaveLength(0);
});
