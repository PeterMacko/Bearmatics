import type { Copy } from '../i18n';
import PictureDemo, { type DemoStep } from '../lesson/PictureDemo';
import { Finger } from './LogicArt';
import { PatternPicture } from './PatternArt';
import type { PatternItem } from './patterns';

export {
  DEMO_MS as PATTERN_DEMO_MS,
  STILL_DEMO_MS as PATTERN_STILL_DEMO_MS,
} from '../lesson/PictureDemo';

const bear: PatternItem = { kind: 'motif', motif: 'bears' };
const pirate: PatternItem = { kind: 'motif', motif: 'pirates' };
const lollipop: PatternItem = { kind: 'motif', motif: 'lollipops' };
const ROW = [bear, pirate, bear, pirate];
/** The right picture is the middle choice (the finger's target). */
const CHOICES = [pirate, bear, lollipop];

/** One picture of the demo: a short row with "?", three choices, the finger and the mover. */
function DemoScene({ step }: { step: DemoStep }) {
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
  return (
    <PictureDemo
      className="pattern-demo"
      frameClassName="pattern-demo-frame"
      label={t.pattern.demo}
      reduced={reduced}
      onDone={onDone}
      Scene={DemoScene}
    />
  );
}
