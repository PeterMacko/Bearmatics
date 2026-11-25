// SCRUM-299: one show-once helper for every picture demo (SCRUM-289 started it for the bear
// demo). A demo is marked seen only when it played to its end; the flag is one localStorage
// entry on this device, never per account and never sent anywhere. Blocked storage (reading or
// writing throws) means the demo plays at every lesson.

/** The demos and their device flags. The bear demo keeps its SCRUM-289 key byte for byte. */
export const DEMO_KEYS = {
  'bear-path': 'bearmatics-logic-demo-seen',
  patterns: 'bearmatics-pattern-demo-seen',
} as const;

export type DemoName = keyof typeof DEMO_KEYS;

/** Whether the demo has played to its end on this device (false when storage is blocked). */
export function demoSeen(name: DemoName): boolean {
  try {
    return localStorage.getItem(DEMO_KEYS[name]) === '1';
  } catch {
    return false;
  }
}

/** The demo played to its end: later lessons start without it. */
export function markDemoSeen(name: DemoName) {
  try {
    localStorage.setItem(DEMO_KEYS[name], '1');
  } catch {
    // Storage full or blocked: the demo simply plays again next time.
  }
}
