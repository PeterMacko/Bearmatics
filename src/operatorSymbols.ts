import type { Exercise } from './math/engine';

/** Display symbols for each arithmetic operation, shared by the equation and hints. */
export const OPERATOR_SYMBOLS: Record<Exercise['operation'], string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};
