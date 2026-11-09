import { createHint } from './math/hints';
import type { Exercise } from './math/engine';
import { copy, type Language } from './i18n';

const symbols = { '+': '+', '-': '−', '*': '×', '/': '÷' } as const;
export default function HintPanel({ exercise, stage, language }: { exercise: Exercise; stage: number; language: Language }) {
  const hint = createHint(exercise, stage, language);
  const t = copy[language];
  const formula = hint.formula;
  return <section id="hint-panel" className="hint-panel" aria-label={t.hint}>
    <p className="hint-step" aria-live="polite">{t.hintStep} {stage} / 3</p>
    <h3>{hint.title}</h3><p>{hint.body}</p>
    {hint.model && <div className={`hint-model model-${hint.model.kind}`}>{hint.model.values.map((value, index) => {
      const tens = value === null || value <= 10 ? 0 : Math.floor(value / 10);
      const ones = value === null ? 0 : value <= 10 ? value : value % 10;
      return <div className="quantity" key={index}><span className="quantity-label">{hint.model!.labels[index]}</span><strong>{value ?? '?'}</strong>
        {value === null ? <span className="sr-only">{t.unknown}</span> : <div className="quantity-tokens" role="img" aria-label={`${value}. ${t.tens}: ${tens}, ${t.ones}: ${ones}`}>
          {Array.from({ length: tens }, (_, i) => <span key={`t${i}`} className="ten-block" aria-hidden="true" />)}
          {Array.from({ length: ones }, (_, i) => <span key={`o${i}`} className="one-dot" aria-hidden="true" />)}
          {value === 0 && <span className="zero-dots" aria-hidden="true">{t.zeroDots}</span>}
        </div>}
      </div>;
    })}</div>}
    {formula && <div data-testid="worked-solution" className="worked-solution"><p>{formula.left} {symbols[formula.operation]} {formula.right} = <strong>{formula.result}</strong></p>{hint.steps && <ol className="counting-steps" aria-label={t.countingSteps}>{hint.steps.map((step, index) => <li key={index}>{step.left} {symbols[step.operation]} {step.right} = {step.result}</li>)}</ol>}<p className="completed-equation"><span>{t.originalEquation}: </span>{exercise.values[0]} {symbols[exercise.operation]} {exercise.values[1]} = {exercise.values[2]}</p></div>}
  </section>;
}
