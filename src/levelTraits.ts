import type { Level } from './math/engine';

/** What a practice screen shows for an engine level (Small maths levels differ from the rest). */
export type LevelTraits = {
  /** Picture groups beside the numbers (Small maths level 1 and the dice level). */
  pictures: boolean;
  /** The take-away basket under the equation (engine level 8). */
  basket: boolean;
  /** The result shown as two dice once solved (engine level 9). */
  dice: boolean;
  /** The hint (i) button beside Check. */
  hint: boolean;
  /** The shared picture-lesson layout (`practice--pictures`): bear beside the header. */
  pictureLayout: boolean;
};

/** Display traits of an engine level; replaces the scattered `level === 0 || level === 9` checks. */
export function levelTraits(level: Level): LevelTraits {
  const pictures = level === 0 || level === 9;
  const basket = level === 8;
  const dice = level === 9;
  return {
    pictures,
    basket,
    dice,
    hint: !basket && !dice,
    pictureLayout: pictures || basket,
  };
}
