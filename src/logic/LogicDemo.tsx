import type { Copy } from '../i18n';
import PictureDemo, { type DemoStep } from '../lesson/PictureDemo';
import { ArrowIcon, Finger, GridBear, HoneyPot } from './LogicArt';

export { DEMO_MS } from '../lesson/PictureDemo';

/** One picture of the demo: a 2-cell strip, the arrow slot and the Go button. */
function DemoScene({ step }: { step: DemoStep }) {
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
  return (
    <PictureDemo
      className="logic-demo"
      frameClassName="demo-frame"
      label={t.logicDemo}
      reduced={reduced}
      onDone={onDone}
      Scene={DemoScene}
    />
  );
}
