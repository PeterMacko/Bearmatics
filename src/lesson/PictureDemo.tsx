import { useEffect, useRef, type ComponentType } from 'react';

/** How long the moving demo and the reduced-motion still steps stay on screen. */
export const DEMO_MS = 3200;
export const STILL_DEMO_MS = 4500;

export type DemoStep = 1 | 2 | 3 | 'moving';

/**
 * A picture demo without voice (Logic bear path and patterns): one moving scene, or with
 * reduced motion the same as 3 numbered still steps. Calls `onDone` once, at the end only.
 * Classes: `<className> <className>-still|-moving`, frames `frameClassName`.
 */
export default function PictureDemo({
  className,
  frameClassName,
  label,
  reduced,
  onDone,
  Scene,
}: {
  className: string;
  frameClassName: string;
  label: string;
  reduced: boolean;
  onDone: () => void;
  Scene: ComponentType<{ step: DemoStep }>;
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
      className={`${className} ${reduced ? `${className}-still` : `${className}-moving`}`}
      role="img"
      aria-label={label}
    >
      {reduced ? (
        ([1, 2, 3] as const).map((step) => (
          <div className={frameClassName} key={step}>
            <span className="demo-number" aria-hidden="true">
              {step}
            </span>
            <Scene step={step} />
          </div>
        ))
      ) : (
        <Scene step="moving" />
      )}
    </div>
  );
}
