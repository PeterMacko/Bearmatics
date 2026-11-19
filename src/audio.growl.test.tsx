import { expect, test, vi } from 'vitest';
import { FeedbackAudio, growlUrl } from './audio';

// SCRUM-172 (Peter's choice, version 5): the bear's growl is a recorded roar
// (public/audio/bear-growl.mp3, about 0.9 s), played when the bear is tapped. It follows Mute,
// does not cut other sounds and restarts from the beginning on the next tap.

function context() {
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    close: vi.fn(async () => {}),
    createGain: vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createOscillator: vi.fn(() => ({
      type: '',
      frequency: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    })),
  };
  return ctx;
}

function fixture() {
  const ctx = context();
  const element = {
    src: '',
    preload: '',
    currentTime: 0.4,
    play: vi.fn(async () => {}),
    pause: vi.fn(),
  };
  const growlFactory = vi.fn(() => element);
  const player = new FeedbackAudio(() => ctx as unknown as AudioContext, growlFactory);
  return { ctx, element, growlFactory, player };
}

test('growl plays the recorded roar file from the start', async () => {
  const f = fixture();
  await f.player.setEnabled(true);
  expect(f.player.play('growl')).toBe(true);
  expect(f.element.src).toBe(growlUrl());
  expect(growlUrl()).toMatch(/audio\/bear-growl\.mp3$/);
  expect(f.element.currentTime).toBe(0);
  expect(f.element.play).toHaveBeenCalledTimes(1);
  // No synthesized voices any more.
  expect(f.ctx.createOscillator).not.toHaveBeenCalled();
  // The next tap reuses the same element and starts again from 0.
  f.element.currentTime = 0.5;
  f.player.play('growl');
  expect(f.growlFactory).toHaveBeenCalledTimes(1);
  expect(f.element.currentTime).toBe(0);
  expect(f.element.play).toHaveBeenCalledTimes(2);
});

test('growl is silent while sound is off, and Mute stops a running roar', async () => {
  const f = fixture();
  expect(f.player.play('growl')).toBe(false);
  expect(f.growlFactory).not.toHaveBeenCalled();
  await f.player.setEnabled(true);
  f.player.play('growl');
  await f.player.setEnabled(false);
  expect(f.element.pause).toHaveBeenCalled();
  expect(f.player.play('growl')).toBe(false);
  expect(f.element.play).toHaveBeenCalledTimes(1);
});

test('a blocked or failed roar never throws', async () => {
  const f = fixture();
  f.element.play.mockImplementation(async () => {
    throw new Error('NotAllowedError');
  });
  await f.player.setEnabled(true);
  expect(() => f.player.play('growl')).not.toThrow();
  await Promise.resolve();
});

test('growl does not cut a running sound', async () => {
  const f = fixture();
  await f.player.setEnabled(true);
  f.player.play('complete');
  const fanfare = f.ctx.createOscillator.mock.results.map((r) => r.value);
  f.player.play('growl');
  for (const o of fanfare) {
    expect(o.stop).toHaveBeenCalledTimes(1);
    expect(o.stop.mock.calls[0]).toHaveLength(1);
  }
});

test('dispose stops the roar', async () => {
  const f = fixture();
  await f.player.setEnabled(true);
  f.player.play('growl');
  f.player.dispose();
  expect(f.element.pause).toHaveBeenCalled();
});

test('the roar file ships with the app', async () => {
  const { existsSync, statSync } = await import('node:fs');
  const file = 'public/audio/bear-growl.mp3';
  expect(existsSync(file)).toBe(true);
  expect(statSync(file).size).toBeLessThan(20_000);
});
