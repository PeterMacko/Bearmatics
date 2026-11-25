import { useEffect, useRef } from 'react';
import type { Copy } from '../i18n';
import { Finger } from './LogicArt';
import { PatternPicture } from './PatternArt';
import type { PatternItem } from './patterns';

/** How long the moving demo and the reduced-motion still steps stay on screen. */
export const PATTERN_DEMO_MS = 3200;
export const PATTERN_STILL_DEMO_MS = 4500;

const bear: PatternItem = { kind: 'motif', motif: 'bears' };
const pirate: PatternItem = { kind: 'motif', motif: 'pirates' };
const lollipop: PatternItem = { kind: 'motif', motif: 'lollipops' };
const ROW = [bear, pirate, bear, pirate];
/** The right picture is the middle choice (the finger's target). */
const CHOICES = [pirate, bear, lollipop];

/** One picture of the demo: a short row with "?", three choices, the finger and the mover. */
function DemoScene({ step }: { step: 1 | 2 | 3 | 'moving' }) {
  return (
    <div className="pattern-demo-scene" data-step={step}>
      <div className="pattern-demo-row">
        {ROW.map((item, i) => (
          <span key={i} className="pattern-demo-place">
            <PatternPicture item={item} />
          </span>
        ))}
        <span className="pattern-demo-place pattern-demo-gap">
          <span className="pattern-demo-question">?</span>
        </span>
      </div>
      <div className="pattern-demo-choices">
        {CHOICES.map((item, i) => (
          <span key={i} className="pattern-demo-choice" data-right={i === 1 || undefined}>
            <PatternPicture item={item} />
          </span>
        ))}
      </div>
      <span className="pattern-demo-mover">
        <PatternPicture item={bear} />
      </span>
      <span className="pattern-demo-finger">
        <Finger />
      </span>
    </div>
  );
}

/**
 * Pattern demo without voice (~3 s): a finger taps the picture that fits and it moves into the
 * "?" place. Reduced motion: the same as 3 still steps. Calls `onDone` once at the end only.
 */
export default function PatternDemo({
  t,
  reduced,
  onDone,
}: {
  t: Copy;
  reduced: boolean;
  onDone: () => void;
}) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const timer = window.setTimeout(
      () => done.current(),
      reduced ? PATTERN_STILL_DEMO_MS : PATTERN_DEMO_MS,
    );
    return () => window.clearTimeout(timer);
  }, [reduced]);
  return (
    <div
      className={`pattern-demo ${reduced ? 'pattern-demo-still' : 'pattern-demo-moving'}`}
      role="img"
      aria-label={t.pattern.demo}
    >
      {reduced ? (
        ([1, 2, 3] as const).map((step) => (
          <div className="pattern-demo-frame" key={step}>
            <span className="demo-number" aria-hidden="true">
              {step}
            </span>
            <DemoScene step={step} />
          </div>
        ))
      ) : (
        <DemoScene step="moving" />
      )}
    </div>
  );
}
