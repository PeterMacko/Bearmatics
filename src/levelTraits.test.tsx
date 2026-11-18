import { expect, test } from 'vitest';
import { levelTraits } from './levelTraits';

test('levelTraits: Small maths levels (engine 0, 8, 9) share the picture layout', () => {
  expect(levelTraits(0)).toEqual({
    pictures: true,
    basket: false,
    dice: false,
    hint: true,
    pictureLayout: true,
  });
  expect(levelTraits(8)).toEqual({
    pictures: false,
    basket: true,
    dice: false,
    hint: false,
    pictureLayout: true,
  });
  expect(levelTraits(9)).toEqual({
    pictures: true,
    basket: false,
    dice: true,
    hint: false,
    pictureLayout: true,
  });
});

test('levelTraits: Maths levels 1-7 are plain number lessons with a hint', () => {
  for (const level of [1, 2, 3, 4, 5, 6, 7] as const) {
    expect(levelTraits(level)).toEqual({
      pictures: false,
      basket: false,
      dice: false,
      hint: true,
      pictureLayout: false,
    });
  }
});
