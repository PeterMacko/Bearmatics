// SCRUM-289 / SCRUM-294: the Logic picture demo plays only until it has been seen to the end once
// on this device. One flag in localStorage, never sent anywhere and not per account. Blocked
// storage (reading or writing throws) means the demo plays at every lesson, as before.

export const DEMO_SEEN_KEY = 'bearmatics-logic-demo-seen';

/** Whether the demo has played to its end on this device (false when storage is blocked). */
export function logicDemoSeen(): boolean {
  try {
    return localStorage.getItem(DEMO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** The demo played to its end: later lessons start straight with the puzzle. */
export function markLogicDemoSeen() {
  try {
    localStorage.setItem(DEMO_SEEN_KEY, '1');
  } catch {
    // Storage full or blocked: the demo simply plays again next time.
  }
}
