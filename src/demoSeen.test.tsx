import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import App from './App';
import { DEMO_KEYS, demoSeen, markDemoSeen, type DemoName } from './demoSeen';
import { tap } from './testing/ui';

afterEach(() => {
  vi.unstubAllGlobals();
});

const NAMES = Object.keys(DEMO_KEYS) as DemoName[];

describe('show-once helper (any demo)', () => {
  test.each(NAMES)(
    '%s: not seen on a fresh device, seen after markDemoSeen, own flag only',
    (name) => {
      expect(demoSeen(name)).toBe(false);
      markDemoSeen(name);
      expect(demoSeen(name)).toBe(true);
      expect(localStorage.getItem(DEMO_KEYS[name])).toBe('1');
      for (const other of NAMES.filter((n) => n !== name)) expect(demoSeen(other)).toBe(false);
      expect(localStorage.length).toBe(1);
    },
  );

  test.each(NAMES)('%s: blocked storage = never seen, marking does not throw', (name) => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => markDemoSeen(name)).not.toThrow();
    expect(demoSeen(name)).toBe(false);
  });

  test('only "1" counts as seen', () => {
    localStorage.setItem(DEMO_KEYS.patterns, 'true');
    expect(demoSeen('patterns')).toBe(false);
  });

  test('the keys: the bear demo keeps its SCRUM-289 key, the pattern demo has its own', () => {
    expect(DEMO_KEYS).toEqual({
      'bear-path': 'bearmatics-logic-demo-seen',
      patterns: 'bearmatics-pattern-demo-seen',
    });
  });
});

test('a device with the old bear-demo flag does not see the bear demo again', () => {
  localStorage.setItem('bearmatics-logic-demo-seen', '1');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Logic' }));
  tap('Let’s plan');
  expect(screen.queryByRole('img', { name: /^Demo/ })).toBeNull();
  expect(screen.getByRole('img', { name: /^Bear: row/ })).toBeInTheDocument();
});
