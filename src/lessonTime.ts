import { fill, pointsText, type Copy } from './i18n';

/**
 * Lesson time on the summary (SCRUM-211). The start of the lesson lives in this tab's
 * sessionStorage (gone when the tab closes): a new lesson overwrites it, leaving a lesson removes
 * it. The time is one simple difference from the start to the summary; nothing is paused or
 * capped, nothing is sent to the server or kept anywhere else.
 */
export const LESSON_START_KEY = 'bearmatics.lessonStart';

type LessonStart = { startedAt: number; size: number };
/** Whole seconds: the total, and the average per chosen example. */
type LessonTime = { total: number; average: number };

/** Storage can be unavailable (privacy modes): the time line then just stays away. */
function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** A lesson starts (its first example is shown): `size` is the number chosen (5, 10 or 20). */
export function startLessonClock(size: number, now = Date.now()) {
  try {
    storage()?.setItem(LESSON_START_KEY, JSON.stringify({ startedAt: now, size }));
  } catch {
    // Full or blocked storage: no time on the summary, nothing else changes.
  }
}

export function clearLessonStart() {
  try {
    storage()?.removeItem(LESSON_START_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function readLessonStart(): LessonStart | null {
  try {
    const raw = storage()?.getItem(LESSON_START_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LessonStart> | null;
    if (
      !value ||
      typeof value.startedAt !== 'number' ||
      !Number.isFinite(value.startedAt) ||
      typeof value.size !== 'number' ||
      !Number.isInteger(value.size) ||
      value.size <= 0
    )
      return null;
    return { startedAt: value.startedAt, size: value.size };
  } catch {
    return null;
  }
}

/**
 * Time from the stored start to `now` (the summary), rounded down to whole seconds, and the
 * average over the chosen number of examples (review repeats do not change the divisor), rounded
 * to whole seconds. Null without a start or when the clock went backwards.
 */
export function measureLessonTime(now = Date.now()): LessonTime | null {
  const start = readLessonStart();
  if (!start) return null;
  const elapsed = now - start.startedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;
  const total = Math.floor(elapsed / 1000);
  return { total, average: Math.round(total / start.size) };
}

const two = (n: number) => String(n).padStart(2, '0');

/** 0:07, 3:25, 1:02:05. */
export function formatClock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0 ? `${hours}:${two(minutes)}:${two(rest)}` : `${minutes}:${two(rest)}`;
}

// SCRUM-324: line/spoken may be another lesson's wording (Pexeso: per pair).
type TimeCopy = Omit<Copy['lessonTime'], 'line' | 'spoken'> & { line: string; spoken: string };

/** "3 minutes 25 seconds" / "3 minúty 25 sekúnd"; zero parts are left out (all zero: "0 seconds"). */
type Units = { hour: readonly string[]; minute: readonly string[]; second: readonly string[] };

function spokenDuration(units: Units, seconds: number): string {
  const parts: string[] = [];
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours) parts.push(pointsText(units.hour, hours));
  if (minutes) parts.push(pointsText(units.minute, minutes));
  if (rest || parts.length === 0) parts.push(pointsText(units.second, rest));
  return parts.join(' ');
}

/** The summary line as shown, and the same in full words for screen readers. */
export function lessonTimeText(t: TimeCopy, time: LessonTime): { shown: string; spoken: string } {
  const average =
    time.average < 60 ? fill(t.seconds, { n: time.average }) : formatClock(time.average);
  return {
    shown: fill(t.line, { time: formatClock(time.total), average }),
    spoken: fill(t.spoken, {
      time: spokenDuration(
        { hour: t.hourUnits, minute: t.minuteUnits, second: t.secondUnits },
        time.total,
      ),
      average: spokenDuration(t.averageUnits, time.average),
    }),
  };
}
