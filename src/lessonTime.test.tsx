import { afterEach, describe, expect, it } from 'vitest';
import { copy } from './i18n';
import {
  LESSON_START_KEY,
  clearLessonStart,
  formatClock,
  lessonTimeText,
  measureLessonTime,
  readLessonStart,
  startLessonClock,
} from './lessonTime';

afterEach(() => sessionStorage.clear());

const MINUTE = 60_000;

describe('lesson time (SCRUM-211)', () => {
  it('stores the start and the chosen size in the tab’s sessionStorage', () => {
    startLessonClock(10, 1_000);
    expect(JSON.parse(sessionStorage.getItem(LESSON_START_KEY)!)).toEqual({
      startedAt: 1_000,
      size: 10,
    });
    expect(readLessonStart()).toEqual({ startedAt: 1_000, size: 10 });
    expect(localStorage.getItem(LESSON_START_KEY)).toBeNull();
  });

  it('a new lesson overwrites the start; leaving removes it', () => {
    startLessonClock(5, 1_000);
    startLessonClock(20, 9_000);
    expect(readLessonStart()).toEqual({ startedAt: 9_000, size: 20 });
    clearLessonStart();
    expect(sessionStorage.getItem(LESSON_START_KEY)).toBeNull();
    expect(measureLessonTime(20_000)).toBeNull();
  });

  it.each([
    [5, 3 * MINUTE + 25_000, 205, 41],
    [10, 3 * MINUTE + 25_000, 205, 21],
    [20, 3 * MINUTE + 25_000, 205, 10],
    [10, 13 * MINUTE + 20_999, 800, 80],
    [20, 7_400, 7, 0],
  ])('size %i, %i ms: total %i s, average %i s', (size, elapsed, total, average) => {
    startLessonClock(size, 50_000);
    expect(measureLessonTime(50_000 + elapsed)).toEqual({ total, average });
  });

  it('the divisor stays the chosen size whatever happens later (review repeats)', () => {
    // A 5-example lesson with three review repeats still divides by 5.
    startLessonClock(5, 0);
    expect(measureLessonTime(100_000)).toEqual({ total: 100, average: 20 });
  });

  it('nothing is paused or capped: hours count', () => {
    startLessonClock(10, 0);
    expect(measureLessonTime(3_725_900)).toEqual({ total: 3725, average: 373 });
  });

  it('missing, broken or negative: no time', () => {
    expect(measureLessonTime(1_000)).toBeNull();
    sessionStorage.setItem(LESSON_START_KEY, 'not json');
    expect(measureLessonTime(1_000)).toBeNull();
    sessionStorage.setItem(LESSON_START_KEY, JSON.stringify({ startedAt: 'x', size: 10 }));
    expect(measureLessonTime(1_000)).toBeNull();
    sessionStorage.setItem(LESSON_START_KEY, JSON.stringify({ startedAt: 0, size: 0 }));
    expect(measureLessonTime(1_000)).toBeNull();
    startLessonClock(10, 5_000);
    expect(measureLessonTime(4_999)).toBeNull();
    expect(measureLessonTime(5_000)).toEqual({ total: 0, average: 0 });
  });

  it('formats m:ss and h:mm:ss', () => {
    expect(formatClock(7)).toBe('0:07');
    expect(formatClock(205)).toBe('3:25');
    expect(formatClock(3599)).toBe('59:59');
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3725)).toBe('1:02:05');
  });

  it('visible and screen-reader text in English', () => {
    const t = copy.en.lessonTime;
    expect(lessonTimeText(t, { total: 205, average: 10 })).toEqual({
      shown: 'Time 3:25 · about 10 s per exercise',
      spoken: 'Time 3 minutes 25 seconds, about 10 seconds per exercise',
    });
    expect(lessonTimeText(t, { total: 800, average: 80 })).toEqual({
      shown: 'Time 13:20 · about 1:20 per exercise',
      spoken: 'Time 13 minutes 20 seconds, about 1 minute 20 seconds per exercise',
    });
    expect(lessonTimeText(t, { total: 7, average: 1 })).toEqual({
      shown: 'Time 0:07 · about 1 s per exercise',
      spoken: 'Time 7 seconds, about 1 second per exercise',
    });
    expect(lessonTimeText(t, { total: 3725, average: 60 })).toEqual({
      shown: 'Time 1:02:05 · about 1:00 per exercise',
      spoken: 'Time 1 hour 2 minutes 5 seconds, about 1 minute per exercise',
    });
    expect(lessonTimeText(t, { total: 7200, average: 0 }).spoken).toBe(
      'Time 2 hours, about 0 seconds per exercise',
    );
  });

  it('Slovak average after "asi" uses the accusative (Peter): 1 minútu, 1 sekundu, 1 hodinu', () => {
    const t = copy.sk.lessonTime;
    expect(lessonTimeText(t, { total: 61, average: 61 }).spoken).toBe(
      'Čas 1 minúta 1 sekunda, asi 1 minútu 1 sekundu na príklad',
    );
    expect(lessonTimeText(t, { total: 3725, average: 3661 }).spoken).toBe(
      'Čas 1 hodina 2 minúty 5 sekúnd, asi 1 hodinu 1 minútu 1 sekundu na príklad',
    );
    expect(lessonTimeText(t, { total: 205, average: 122 }).spoken).toBe(
      'Čas 3 minúty 25 sekúnd, asi 2 minúty 2 sekundy na príklad',
    );
    expect(lessonTimeText(t, { total: 205, average: 1 }).spoken).toBe(
      'Čas 3 minúty 25 sekúnd, asi 1 sekundu na príklad',
    );
  });

  it('visible and screen-reader text in Slovak with the three plural forms', () => {
    const t = copy.sk.lessonTime;
    expect(lessonTimeText(t, { total: 205, average: 10 })).toEqual({
      shown: 'Čas 3:25 · asi 10 s na príklad',
      spoken: 'Čas 3 minúty 25 sekúnd, asi 10 sekúnd na príklad',
    });
    expect(lessonTimeText(t, { total: 61, average: 2 }).spoken).toBe(
      'Čas 1 minúta 1 sekunda, asi 2 sekundy na príklad',
    );
    expect(lessonTimeText(t, { total: 3725, average: 80 })).toEqual({
      shown: 'Čas 1:02:05 · asi 1:20 na príklad',
      spoken: 'Čas 1 hodina 2 minúty 5 sekúnd, asi 1 minútu 20 sekúnd na príklad',
    });
    expect(lessonTimeText(t, { total: 2 * 3600 + 5 * 60, average: 4 }).spoken).toBe(
      'Čas 2 hodiny 5 minút, asi 4 sekundy na príklad',
    );
    expect(lessonTimeText(t, { total: 5 * 3600, average: 0 }).spoken).toBe(
      'Čas 5 hodín, asi 0 sekúnd na príklad',
    );
  });
});
