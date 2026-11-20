// SCRUM-202: how often each level was played today, kept on this device only (localStorage,
// never sent to the server). A play is a lesson finished to its summary whose points were
// saved. One record per account holds today's counts per course and level; records of older
// days are removed whenever counts are written.
import type { Account } from '../account/api';
import type { PointsCourse } from './multipliers';

export const PLAYS_KEY = 'bearmatics-plays';

/** The device's own counts: per account key, the day and the counts per "course:level". */
type Store = Record<string, { day: string; counts: Record<string, number> }>;

/**
 * The account a record belongs to. The app has no stable account ID: kind + username for
 * password accounts, kind + nickname for Google accounts (a nickname change starts that day's
 * counts again; accepted in the scope).
 */
export function playsAccountKey(account: Pick<Account, 'kind' | 'username' | 'nickname'>) {
  return `${account.kind}:${account.kind === 'password' ? account.username : account.nickname}`;
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bratislava',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The device's calendar date in Slovakia ('YYYY-MM-DD'), used when the server's is unknown. */
export function deviceSlovakDay(ms: number): string {
  return DAY_FORMAT.format(new Date(ms));
}

const dayNumber = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
const dayFromNumber = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

/**
 * Today's Slovak day. The server's day (from the last progress answer) wins over the device
 * clock: `shift` is how many days the server was ahead of the device's own Slovak date when it
 * answered, so midnight still turns the day while the app stays open.
 */
export function playDay(ms: number, shift: number): string {
  return shift ? dayFromNumber(dayNumber(deviceSlovakDay(ms)) + shift) : deviceSlovakDay(ms);
}

/** Days between the device's Slovak date at `ms` and the server's `day`. */
export function dayShift(ms: number, serverDay: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serverDay)) return 0;
  return dayNumber(serverDay) - dayNumber(deviceSlovakDay(ms));
}

function readStore(): Store {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PLAYS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

const levelKey = (course: PointsCourse, level: number) => `${course}:${level}`;

/** Saved plays of this course and level (level as shown) on `day` by this account. */
export function playsToday(account: string, day: string, course: PointsCourse, level: number) {
  const record = readStore()[account];
  if (!record || record.day !== day) return 0;
  const count = record.counts?.[levelKey(course, level)];
  return typeof count === 'number' && count > 0 ? count : 0;
}

/** One more saved play today; every record of an older day (any account) is removed. */
export function addPlay(account: string, day: string, course: PointsCourse, level: number) {
  const store = readStore();
  const kept: Store = {};
  for (const [key, record] of Object.entries(store))
    if (record && record.day === day && key !== account) kept[key] = record;
  const counts = store[account]?.day === day ? { ...store[account].counts } : {};
  counts[levelKey(course, level)] = playsToday(account, day, course, level) + 1;
  kept[account] = { day, counts };
  try {
    localStorage.setItem(PLAYS_KEY, JSON.stringify(kept));
  } catch {
    // Storage full or blocked: the play simply is not counted on this device.
  }
}
