import { useEffect, useRef, useState } from 'react';
import type { Account } from '../account/api';
import {
  finishLesson,
  loadProgress,
  startLesson,
  type Offer,
  type Progress,
  type Streak,
} from './api';
import { pointsFrames, reducedMotion, staticFrame, usePointsAnimation } from './animation';
import { multipliedPoints, multiplierFor, type Multiplier, type PointsCourse } from './multipliers';
import { addPlay, dayShift, playDay, playsAccountKey, playsToday } from './playCounts';
import type { LessonSave } from './SummaryPoints';

/** Where a lesson is played: course and level as shown in its menu (SCRUM-202). */
export type LessonPlace = { course: PointsCourse; level: number };

// The running lesson. Its server ID is requested at Start when the player is signed in; a
// lesson started before the account has loaded asks for it as soon as the account is known.
type Lesson = {
  size: number;
  id: Promise<string | null>;
  saved: boolean;
  /** The account turned out to be signed out: nothing to save. */
  signedOut: boolean;
  /** A finish request was sent and its answer was lost, so "already counted" is expected. */
  retried: boolean;
  earned: number;
  place: LessonPlace | null;
  /** SCRUM-202: fixed when the lesson finishes (from today's plays before it); null before. */
  multiplier: Multiplier | null;
  /**
   * The Slovak day the multiplier was looked up for, fixed with it. The play is counted under
   * this same day, even when the save answer moves the server's day on (QA204-01).
   */
  day: string | null;
  /** First-try answers (capped at the size) the multiplier applies to. */
  firstTry: number;
  /** This lesson was counted as today's play (once, also when a save is retried). */
  counted: boolean;
};

/**
 * Points, streak and the lesson's server record for signed-in players (SCRUM-117/118): the
 * lesson ID at Start, saving (and retrying) the finished lesson, the bar's points animation,
 * the new-badge chime and when the streak unlock offer opens. `finishedFirstTry` is the
 * finished lesson's first-try score, null while no lesson is finished.
 */
export function useLessonPoints({
  account,
  accountKnown,
  finishedFirstTry,
  playBadge,
}: {
  account: Account | null;
  accountKnown: boolean;
  finishedFirstTry: number | null;
  playBadge: () => void;
}) {
  // Points (SCRUM-117): signed-in players only; null while unknown or signed out.
  const [points, setPoints] = useState<number | null>(null);
  // Streak (SCRUM-118): shown next to the badge; null while unknown or signed out.
  const [streak, setStreak] = useState<Streak | null>(null);
  const [offer, setOffer] = useState<{ offer: Offer; points: number } | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [warming, setWarming] = useState(false);
  // The streak number shown when the lesson started (the summary switches from it).
  const streakAtStart = useRef<number | null>(null);
  // SCRUM-202: the server's Slovak day as a shift from the device's own Slovak date.
  const dayShiftRef = useRef(0);
  // Bumped when a play is counted, so the level menus show the next play's sign again.
  const [, setPlaysCounted] = useState(0);
  const showProgress = (progress: Progress) => {
    if (progress.day) dayShiftRef.current = dayShift(Date.now(), progress.day);
    setPoints(progress.points);
    setStreak({ streak: progress.streak, frozen: progress.frozen, today: progress.today });
  };
  const accountId = account ? `${account.kind}:${account.username ?? account.nickname}` : null;
  useEffect(() => {
    if (!accountId) {
      setPoints(null);
      setStreak(null);
      return;
    }
    let live = true;
    loadProgress().then(
      (found) => live && showProgress(found),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [accountId]);
  const lesson = useRef<Lesson | null>(null);
  const waitingStart = useRef<((id: string | null) => void) | null>(null);
  const [lessonSave, setLessonSave] = useState<LessonSave | null>(null);
  const beginLesson = (lessonSize: number, place: LessonPlace | null = null) => {
    streakAtStart.current = streak ? streak.streak : null;
    setLessonSave(null);
    closeOffer();
    waitingStart.current = null;
    const fresh: Lesson = {
      size: lessonSize,
      id: Promise.resolve(null),
      saved: false,
      signedOut: false,
      retried: false,
      earned: 0,
      place,
      multiplier: null,
      day: null,
      firstTry: 0,
      counted: false,
    };
    if (account) fresh.id = startLesson(lessonSize).catch(() => null);
    else if (!accountKnown)
      fresh.id = new Promise((resolve) => {
        waitingStart.current = resolve;
      });
    else fresh.signedOut = true;
    lesson.current = fresh;
  };
  useEffect(() => {
    const resolve = waitingStart.current;
    const current = lesson.current;
    if (!accountKnown || !resolve || !current) return;
    waitingStart.current = null;
    if (account) startLesson(current.size).then(resolve, () => resolve(null));
    else {
      current.signedOut = true;
      resolve(null);
    }
  }, [accountKnown, account]);
  const saveLesson = async (firstTry: number) => {
    const current = lesson.current;
    if (!current || current.signedOut) return;
    const playsKey = account ? playsAccountKey(account) : null;
    if (current.multiplier === null) {
      // Fixed now, from the plays saved before this one; a retried save keeps it, and the play
      // is later counted under this same day.
      const day = playDay(Date.now(), dayShiftRef.current);
      current.day = day;
      current.firstTry = Math.min(firstTry, current.size);
      current.multiplier =
        current.place && playsKey
          ? multiplierFor(
              current.place.course,
              current.place.level,
              playsToday(playsKey, day, current.place.course, current.place.level) + 1,
            )
          : 1;
      current.earned = multipliedPoints(current.firstTry, current.multiplier);
    }
    setLessonSave({ state: 'saving' });
    let sent = false;
    try {
      let id = await current.id;
      if (current.signedOut) {
        if (lesson.current === current) setLessonSave(null);
        return;
      }
      if (!id) {
        id = await startLesson(current.size);
        current.id = Promise.resolve(id);
      }
      sent = true;
      const result = await finishLesson(id, current.size, current.earned);
      // The bar always gets the saved total, also when the child has already left the summary.
      showProgress(result);
      // Saved: today's play of this level (a failed save is not a play; counted once).
      // Counted under the day its multiplier came from (not the day this answer reports).
      if (!current.counted && current.place && playsKey && current.day) {
        current.counted = true;
        addPlay(playsKey, current.day, current.place.course, current.place.level);
        setPlaysCounted((n) => n + 1);
      }
      if (lesson.current !== current) return;
      // The unlock offer comes after the summary scene (after the points animation).
      if (result.offer) setOffer({ offer: result.offer, points: result.points });
      // A retry after a lost answer finds the lesson already counted: show what it gave.
      const added = result.added === 0 && current.retried ? current.earned : result.added;
      setLessonSave({
        state: 'saved',
        added,
        before: result.points - added,
        after: result.points,
        firstTry: current.firstTry,
        multiplier: current.multiplier ?? 1,
      });
    } catch {
      if (sent) current.retried = true;
      if (lesson.current === current) setLessonSave({ state: 'failed' });
    }
  };
  useEffect(() => {
    // Once per finished lesson (including its review round); leaving early saves nothing.
    const current = lesson.current;
    if (finishedFirstTry === null || !current || current.saved) return;
    current.saved = true;
    summaryShownAt.current = Date.now();
    void saveLesson(finishedFirstTry);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- runs when a lesson finishes
  }, [finishedFirstTry]);
  // Summary animation: the points fill the bar (top bar and summary) once per saved lesson.
  const summaryShownAt = useRef(0);
  const chimeTimer = useRef(0);
  const [newBadge, setNewBadge] = useState(0);
  const animationRun =
    lessonSave?.state === 'saved' && lessonSave.added > 0
      ? {
          key: `${lessonSave.before}:${lessonSave.after}:${summaryShownAt.current}`,
          before: lessonSave.before,
          after: lessonSave.after,
          delay: 700,
        }
      : null;
  const animated = usePointsAnimation(animationRun, (badge) => {
    setNewBadge(badge);
    // The chime never cuts the completion fanfare (about 2 s after the summary appears).
    window.clearTimeout(chimeTimer.current);
    const wait = summaryShownAt.current + 2200 - Date.now();
    if (wait > 0) chimeTimer.current = window.setTimeout(playBadge, wait);
    else playBadge();
  });
  useEffect(() => {
    if (lessonSave?.state !== 'saved') {
      setNewBadge(0);
      window.clearTimeout(chimeTimer.current);
    }
  }, [lessonSave]);
  useEffect(() => () => window.clearTimeout(chimeTimer.current), []);
  // SCRUM-118: open the unlock offer once the points have filled the bar.
  useEffect(() => {
    if (!offer || lessonSave?.state !== 'saved') return;
    const reduce = reducedMotion();
    const fill = pointsFrames(lessonSave.before, lessonSave.after).reduce(
      (sum, f) => sum + f.hold,
      0,
    );
    const wait = reduce ? 900 : (lessonSave.added > 0 ? 700 + fill : 0) + 900;
    const timer = window.setTimeout(() => setOfferOpen(true), wait);
    return () => window.clearTimeout(timer);
  }, [offer, lessonSave]);
  const closeOffer = () => {
    setOfferOpen(false);
    setOffer(null);
  };
  /** Leaving the lesson or its summary: nothing more is saved or offered for it. */
  const endLesson = () => {
    lesson.current = null;
    closeOffer();
    waitingStart.current = null;
    setLessonSave(null);
  };
  /** SCRUM-202: the multiplier the next play of a level gets; null when signed out. */
  const nextMultiplier = (place: LessonPlace): Multiplier | null => {
    if (!account) return null;
    const plays = playsToday(
      playsAccountKey(account),
      playDay(Date.now(), dayShiftRef.current),
      place.course,
      place.level,
    );
    return multiplierFor(place.course, place.level, plays + 1);
  };
  useEffect(() => {
    if (!warming) return;
    const timer = window.setTimeout(() => setWarming(false), 1600);
    return () => window.clearTimeout(timer);
  }, [warming]);
  // Before the first animation frame the bar still shows the old total (no flash of the new one).
  // After the lesson's animation the total can change again (streak unlock pays points):
  // then the bar shows the new total.
  const animating = animationRun !== null && points === animationRun.after;
  const shownFrame = animating
    ? (animated ?? staticFrame(animationRun.before))
    : points === null
      ? null
      : staticFrame(points);
  return {
    points,
    streak,
    showProgress,
    streakAtStart,
    offer,
    offerOpen,
    closeOffer,
    warming,
    setWarming,
    lessonSave,
    beginLesson,
    saveLesson,
    endLesson,
    newBadge,
    shownFrame,
    nextMultiplier,
  };
}
