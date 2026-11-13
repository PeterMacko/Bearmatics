import type { Exercise } from './math/engine';

export type Feedback = 'ready' | 'correct' | 'incorrect' | 'invalid';

/** State of one practice session, including the review round. */
export type Session = {
  exercises: readonly Exercise[];
  index: number;
  firstTry: number;
  attempts: number;
  solved: boolean;
  done: boolean;
  feedback: Feedback;
  hintStage: number;
  reviewing: boolean;
  reviewQueue: readonly Exercise[];
};
