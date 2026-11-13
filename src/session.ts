import { checkAnswer, type AnswerResult, type Exercise } from './math/engine';

export type Feedback = 'ready' | 'correct' | 'incorrect' | 'invalid';

/** State of one practice session, including the review round (maths exercises by default). */
export type Session<E = Exercise> = {
  exercises: readonly E[];
  index: number;
  firstTry: number;
  attempts: number;
  solved: boolean;
  done: boolean;
  feedback: Feedback;
  hintStage: number;
  reviewing: boolean;
  reviewQueue: readonly E[];
};

export const MAX_HINT_STAGE = 3;

export function createSession<E>(exercises: readonly E[]): Session<E> {
  return {
    exercises,
    index: 0,
    firstTry: 0,
    attempts: 0,
    solved: false,
    done: false,
    feedback: 'ready',
    hintStage: 0,
    reviewing: false,
    reviewQueue: [],
  };
}

/** The exercise on screen: the next review item while reviewing, otherwise the current original. */
export function currentExercise<E>(session: Session<E>): E | undefined {
  return session.reviewing ? session.reviewQueue[0] : session.exercises[session.index];
}

/** Editing the answer clears old feedback until the exercise is solved. */
export function clearFeedback<E>(session: Session<E>): Session<E> {
  return session.solved ? session : { ...session, feedback: 'ready' };
}

/**
 * Checks an answer. Invalid input only sets feedback; a real attempt counts, and a first-try
 * point needs an original exercise solved on the first attempt without hints.
 */
export function submitAnswer<E = Exercise>(
  session: Session<E>,
  answer: string,
  check: (exercise: E, answer: string) => AnswerResult = checkAnswer as never,
): Session<E> {
  if (session.solved || session.done) return session;
  const result = check(currentExercise(session)!, answer);
  if (result === 'invalid-input') return { ...session, feedback: 'invalid' };
  const solved = result === 'correct';
  const firstTry =
    solved && !session.reviewing && session.attempts === 0 && session.hintStage === 0;
  return {
    ...session,
    solved,
    attempts: session.attempts + 1,
    firstTry: session.firstTry + (firstTry ? 1 : 0),
    feedback: result,
  };
}

/**
 * Moves on after a solved exercise. Originals needing more than one attempt join the review
 * queue; a review item leaves the queue only when solved first time without hints, otherwise
 * it goes to the back. The session is done when the originals and the queue are finished.
 */
export function advance<E>(session: Session<E>): Session<E> {
  if (!session.solved || session.done) return session;
  const reset = { attempts: 0, hintStage: 0, solved: false, feedback: 'ready' as const };
  if (session.reviewing) {
    const [reviewed, ...remaining] = session.reviewQueue;
    const reviewQueue =
      session.attempts === 1 && session.hintStage === 0 ? remaining : [...remaining, reviewed];
    return { ...session, ...reset, reviewQueue, done: reviewQueue.length === 0 };
  }
  const reviewQueue =
    session.attempts > 1
      ? [...session.reviewQueue, session.exercises[session.index]]
      : session.reviewQueue;
  if (session.index === session.exercises.length - 1)
    return {
      ...session,
      ...reset,
      reviewQueue,
      reviewing: reviewQueue.length > 0,
      done: reviewQueue.length === 0,
    };
  return { ...session, ...reset, reviewQueue, index: session.index + 1 };
}

/** Opening the hint dialog shows the first hint stage on an unsolved exercise. */
export function openHintStage<E>(session: Session<E>): Session<E> {
  return !session.solved && !session.done && session.hintStage === 0
    ? { ...session, hintStage: 1 }
    : session;
}

export function nextHintStage<E>(session: Session<E>): Session<E> {
  if (session.done || session.solved || session.hintStage >= MAX_HINT_STAGE) return session;
  return { ...session, hintStage: session.hintStage + 1 };
}

/** Leaving needs confirmation once any progress or a typed answer would be lost. */
export function hasProgress<E>(session: Session<E>, answer: string): boolean {
  return Boolean(
    session.index > 0 || session.attempts > 0 || session.hintStage > 0 || answer.trim(),
  );
}

/** Value for the top progress bar (all originals count as done while reviewing). */
export function progressValue<E>(session: Session<E>): number {
  return session.reviewing ? session.exercises.length : session.index + (session.solved ? 1 : 0);
}

/** Which label the button after a solved exercise shows. */
export function nextAction<E>(session: Session<E>): 'next' | 'finish' | 'reviewStart' {
  if (session.reviewing)
    return session.reviewQueue.length === 1 && session.attempts === 1 && session.hintStage === 0
      ? 'finish'
      : 'next';
  if (session.index !== session.exercises.length - 1) return 'next';
  return session.reviewQueue.length > 0 || session.attempts > 1 ? 'reviewStart' : 'finish';
}

export function bearMood<E>(session: Session<E> | null): 'happy' | 'sad' | 'neutral' {
  if (session?.done || session?.feedback === 'correct') return 'happy';
  return session?.feedback === 'incorrect' ? 'sad' : 'neutral';
}
