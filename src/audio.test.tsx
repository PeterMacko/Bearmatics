import { expect, test, vi } from 'vitest';
import * as audio from './audio';
type Player = { setEnabled(value: boolean): Promise<boolean>; play(outcome: 'correct' | 'incorrect'): boolean; dispose(): void };
const PlayerClass = (audio as Record<string, unknown>).FeedbackAudio as new (factory?: () => AudioContext) => Player;
function fixture() {
  const nodes: { stop: ReturnType<typeof vi.fn> }[] = [];
  const frequencies: number[] = [];
  const context = {
    state: 'suspended', currentTime: 0, destination: {},
    resume: vi.fn(async () => { context.state = 'running'; }), close: vi.fn(async () => { context.state = 'closed'; }),
    createGain: vi.fn(() => ({ gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
    createOscillator: vi.fn(() => { const node = { frequency: { setValueAtTime: (value: number) => frequencies.push(value) }, type: '', connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }; nodes.push(node); return node; }),
  };
  return { nodes, frequencies, context, factory: vi.fn(() => context as unknown as AudioContext) };
}
test('audio is opt-in, success and retry are distinct, and mute immediately stops pending tones', async () => {
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
