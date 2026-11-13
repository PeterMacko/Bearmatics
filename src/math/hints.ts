import { solveBlank, type Exercise, type Fact, type Operation } from './engine';
import type { Language } from '../i18n';

export type HintStage = 1 | 2 | 3;
export type CountingModel = {
  kind: 'parts' | 'groups';
  labels: readonly [string, string, string];
  values: readonly (number | null)[];
};
export type CountingStep = { left: number; operation: Operation; right: number; result: number };
export type Hint = {
  title: string;
  body: string;
  model?: CountingModel;
  formula?: CountingStep;
  steps?: readonly CountingStep[];
  completed?: Fact;
};
const text = {
  en: {
    strategy: 'Try a counting strategy',
    visual: 'Look at the parts',
    worked: 'Let’s work it out',
    combine: 'Put the two known groups together. You can count on from the bigger number.',
    part: 'Start with the whole. Take away the part you already know to find the missing part.',
    take: 'Start with the whole and take away the shown amount. Count what is left.',
    multiply: 'Think of equal groups. Count the same amount in every group.',
    groups: 'How many groups of the known size fit into the total?',
    each: 'Share the total equally between the known number of groups. How much goes in each?',
    partsHelp:
      'Use the known groups to find the missing number. A long block is ten. A dot is one.',
    groupsHelp:
      'Use the total and equal groups to find the missing piece. A long block is ten. A dot is one.',
    finish:
      'Here is the counting step and the completed equation. Now type the missing number yourself.',
    first: 'One part',
    second: 'Another part',
    whole: 'Whole',
    removed: 'Taken away',
    left: 'Left over',
    number: 'Groups',
    eachLabel: 'In each group',
    total: 'Total',
  },
  sk: {
    strategy: 'Skús počítať po krokoch',
    visual: 'Pozri sa na časti',
    worked: 'Vypočítajme to spolu',
    combine: 'Spoj obe známe skupiny. Môžeš začať väčším číslom a pripočítať menšie.',
    part: 'Začni celkom. Odober časť, ktorú poznáš. Zostane ti chýbajúca časť.',
    take: 'Začni celkom a odober uvedený počet. Spočítaj, koľko zostalo.',
    multiply: 'Predstav si rovnako veľké skupiny. V každej spočítaj rovnaký počet.',
    groups: 'Koľko skupín so známou veľkosťou sa zmestí do celku?',
    each: 'Rozdeľ celok rovnomerne do známeho počtu skupín. Koľko bude v každej?',
    partsHelp:
      'Pomocou známych skupín nájdi chýbajúce číslo. Dlhý dielik znamená desať. Bodka jednu.',
    groupsHelp:
      'Pomocou celku a rovnakých skupín nájdi chýbajúce číslo. Dlhý dielik znamená desať. Bodka jednu.',
    finish: 'Tu je postup aj doplnený príklad. Teraz chýbajúce číslo napíš sám alebo sama.',
    first: 'Jedna časť',
    second: 'Druhá časť',
    whole: 'Celok',
    removed: 'Odobraté',
    left: 'Zostalo',
    number: 'Počet skupín',
    eachLabel: 'V každej skupine',
    total: 'Celkom',
  },
} as const;

/** Earlier stages contain known quantities only; a numerical solution appears at stage three. */
export function createHint(exercise: Exercise, stage: number, language: Language): Hint {
  if (![1, 2, 3].includes(stage) || !['en', 'sk'].includes(language))
    throw new RangeError('Unsupported hint settings');
  const result = solveBlank(exercise);
  const { values, blank, operation } = exercise;
  const [a, b, c] = values;
  const t = text[language];
  const strategy =
    operation === '+'
      ? blank === 2
        ? t.combine
        : t.part
      : operation === '-'
        ? blank === 0
          ? t.combine
          : blank === 1
            ? t.part
            : t.take
        : operation === '*'
          ? blank === 2
            ? t.multiply
            : blank === 0
              ? t.groups
              : t.each
          : blank === 0
            ? t.multiply
            : blank === 1
              ? t.groups
              : t.each;
  if (stage === 1) return { title: t.strategy, body: strategy };
  if (stage === 2) {
    const known = values.map((value, i) => (i === blank ? null : value));
    const groups = operation === '*' || operation === '/';
    const reordered =
      operation === '-' || operation === '/' ? [known[1], known[2], known[0]] : known;
    const labels: readonly [string, string, string] = groups
      ? [t.number, t.eachLabel, t.total]
      : operation === '-'
        ? [t.removed, t.left, t.whole]
        : [t.first, t.second, t.whole];
    return {
      title: t.visual,
      body: `${strategy} ${groups ? t.groupsHelp : t.partsHelp}`,
      model: { kind: groups ? 'groups' : 'parts', labels, values: reordered },
    };
  }
  let left: number, right: number, inverse: Operation;
  if (operation === '+') {
    [left, inverse, right] = blank === 2 ? [a, '+', b] : [c, '-', blank === 0 ? b : a];
  } else if (operation === '-') {
    [left, inverse, right] = blank === 0 ? [b, '+', c] : [a, '-', blank === 1 ? c : b];
  } else if (operation === '*') {
    [left, inverse, right] = blank === 2 ? [a, '*', b] : [c, '/', blank === 0 ? b : a];
  } else {
    [left, inverse, right] = blank === 0 ? [b, '*', c] : [a, '/', blank === 1 ? c : b];
  }
  let steps: CountingStep[] | undefined;
  if (inverse === '+' || inverse === '-') {
    const split =
      right >= 10
        ? Math.floor(right / 10) * 10
        : inverse === '+' && left % 10 > 0 && (left % 10) + right > 10
          ? 10 - (left % 10)
          : inverse === '-' && left % 10 > 0 && right > left % 10
            ? left % 10
            : 0;
    if (split > 0 && split < right) {
      const intermediate = inverse === '+' ? left + split : left - split;
      steps = [
        { left, operation: inverse, right: split, result: intermediate },
        { left: intermediate, operation: inverse, right: right - split, result },
      ];
    }
  }
  return {
    title: t.worked,
    body: `${strategy} ${t.finish}`,
    formula: { left, operation: inverse, right, result },
    steps,
    completed: values,
  };
}
