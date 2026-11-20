import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { watchResize } from './watchResize';

// SCRUM-201 (CR-17): the shared resize scaffold of AppBar, useMenuLayout and useWordGrid.

let frames: Map<number, FrameRequestCallback>;
let nextId: number;
let observed: Element[];
let observerCallback: (() => void) | null;
let disconnected: number;

beforeEach(() => {
  frames = new Map();
  nextId = 1;
  observed = [];
  observerCallback = null;
  disconnected = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(nextId, callback);
    return nextId++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        observerCallback = callback;
      }
      observe(element: Element) {
        observed.push(element);
      }
      disconnect() {
        disconnected++;
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const runFrames = () => {
  const waiting = [...frames.values()];
  frames.clear();
  waiting.forEach((callback) => callback(0));
};
const resize = () => window.dispatchEvent(new Event('resize'));

test('without a frame option it measures at once on window and element changes', () => {
  const measure = vi.fn();
  const a = document.createElement('div');
  const stop = watchResize(measure, [a, null]);
  expect(observed).toEqual([a]);
  resize();
  observerCallback!();
  expect(measure).toHaveBeenCalledTimes(2);
  expect(frames.size).toBe(0);
  stop();
  resize();
  expect(measure).toHaveBeenCalledTimes(2);
  expect(disconnected).toBe(1);
});

test("'next' joins all changes into the one waiting frame", () => {
  const measure = vi.fn();
  const stop = watchResize(measure, [], { frame: 'next', visualViewport: true, fonts: true });
  resize();
  resize();
  observerCallback!();
  expect(frames.size).toBe(1);
  expect(measure).not.toHaveBeenCalled();
  runFrames();
  expect(measure).toHaveBeenCalledTimes(1);
  resize();
  expect(frames.size).toBe(1);
  stop();
  expect(frames.size).toBe(0);
  observerCallback!();
  expect(frames.size).toBe(0);
});

test("'last' restarts the wait on every change and measures once after the last", () => {
  const measure = vi.fn();
  const stop = watchResize(measure, [], { frame: 'last' });
  resize();
  const first = [...frames.keys()];
  resize();
  expect(frames.size).toBe(1);
  expect([...frames.keys()]).not.toEqual(first);
  runFrames();
  expect(measure).toHaveBeenCalledTimes(1);
  resize();
  stop();
  expect(frames.size).toBe(0);
});

test('without ResizeObserver it still follows the window', () => {
  vi.stubGlobal('ResizeObserver', undefined);
  const measure = vi.fn();
  const stop = watchResize(measure, [document.body]);
  resize();
  expect(measure).toHaveBeenCalledTimes(1);
  stop();
});
