import type { Copy } from '../i18n';
import { nextAction, type Session } from '../session';

/** The lesson header position: "Exercise 3 of 10" (unit = exercise or word), or the review count. */
export function positionText<E>(t: Copy, session: Session<E>, unit: string): string {
  return session.reviewing
    ? `${t.review} · ${session.reviewQueue.length} ${t.remaining}`
    : `${unit} ${session.index + 1} ${t.of} ${session.exercises.length}`;
}

/** Label of the button after a solved exercise; English lessons say "Next word". */
export function nextLabel<E>(t: Copy, session: Session<E>, english = false): string {
  const action = nextAction(session);
  return english && action === 'next' ? t.englishNext : t[action];
}
