import { describe, expect, it } from 'vitest';
import { copy } from '../i18n';
import type { Session } from '../session';
import { nextLabel, positionText } from './lessonText';

const session = (patch: Partial<Session<number>> = {}): Session<number> => ({
  exercises: [1, 2, 3],
  index: 0,
  firstTry: 0,
  attempts: 1,
  solved: true,
  done: false,
  feedback: 'correct',
  hintStage: 0,
  reviewing: false,
  reviewQueue: [],
  ...patch,
});

describe('positionText', () => {
  it('counts exercises or words from one', () => {
    expect(positionText(copy.en, session({ index: 1 }), copy.en.exercise)).toBe('Exercise 2 of 3');
    expect(positionText(copy.en, session(), copy.en.englishWord)).toBe(
      `${copy.en.englishWord} 1 of 3`,
    );
    expect(positionText(copy.sk, session({ index: 2 }), copy.sk.exercise)).toBe(
      `${copy.sk.exercise} 3 ${copy.sk.of} 3`,
    );
  });

  it('shows the review count while reviewing', () => {
    expect(
      positionText(copy.en, session({ reviewing: true, reviewQueue: [1, 3] }), copy.en.exercise),
    ).toBe(`${copy.en.review} · 2 ${copy.en.remaining}`);
  });
});

describe('nextLabel', () => {
  it('uses the maths label for every action', () => {
    expect(nextLabel(copy.en, session())).toBe(copy.en.next);
    expect(nextLabel(copy.en, session({ index: 2 }))).toBe(copy.en.finish);
    expect(nextLabel(copy.en, session({ index: 2, reviewQueue: [1] }))).toBe(copy.en.reviewStart);
  });

  it('says "Next word" only for the plain next step in English', () => {
    expect(nextLabel(copy.sk, session(), true)).toBe(copy.sk.englishNext);
    expect(nextLabel(copy.en, session({ index: 2 }), true)).toBe(copy.en.finish);
    expect(nextLabel(copy.en, session({ index: 2, attempts: 2 }), true)).toBe(copy.en.reviewStart);
  });
});
