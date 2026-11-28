import { useEffect, useRef } from 'react';
import type { Copy } from '../i18n';
import { ArrowIcon, Finger, GridBear, HoneyPot } from './LogicArt';

/** How long the moving demo and the reduced-motion still steps stay on screen. */
export const DEMO_MS = 3200;
const STILL_DEMO_MS = 4500;

/** One picture of the demo: a 2-cell strip, the arrow slot and the Go button. */
function DemoScene({ step }: { step: 1 | 2 | 3 | 'moving' }) {
  return (
    <div className="demo-scene" data-step={step}>
      <div className="demo-strip">
        <span className="demo-cell" />
        <span className="demo-cell">
          <span className="demo-honey">
            <HoneyPot />
          </span>
        </span>
        <span className="demo-bear">
          <GridBear mood={step === 3 ? 'happy' : 'neutral'} />
        </span>
      </div>
      <div className="demo-controls">
        <span className="demo-arrow-button">
          <ArrowIcon arrow="right" />
          <span className="demo-finger">
            <Finger />
          </span>
        </span>
        <span className="demo-slot">
          <span className="demo-slot-arrow">
            <ArrowIcon arrow="right" />
          </span>
        </span>
        <span className="demo-go">▶</span>
      </div>
    </div>
  );
}

/**
 * Picture demo without voice (scope 5): a finger taps →, the arrow appears in a slot, Go pulses,
 * the bear steps to the honey. Reduced motion: the same as 3 still steps. Calls `onDone` once.
 */
export default function LogicDemo({
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
    const timer = window.setTimeout(() => done.current(), reduced ? STILL_DEMO_MS : DEMO_MS);
    return () => window.clearTimeout(timer);
  }, [reduced]);
  return (
    <div
      className={`logic-demo ${reduced ? 'logic-demo-still' : 'logic-demo-moving'}`}
      role="img"
      aria-label={t.logicDemo}
    >
      {reduced ? (
        ([1, 2, 3] as const).map((step) => (
          <div className="demo-frame" key={step}>
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
