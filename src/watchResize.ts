type WatchOptions = {
  /**
   * When to call back after a change. Without: at once. 'next': once on the next animation
   * frame, however many changes arrive before it. 'last': on the frame after the last change
   * (every change restarts the wait).
   */
  frame?: 'next' | 'last';
  /** Also watch the visual viewport (mobile browser bars, on-screen keyboard). */
  visualViewport?: boolean;
  /** Also watch web fonts finishing loading. */
  fonts?: boolean;
};

/**
 * The resize scaffold of the layout hooks: calls `onResize` when the window or one of `targets`
 * changes size (targets only where ResizeObserver exists). Call it inside the hook's layout
 * effect after the first measurement, and call the returned function in the effect's cleanup.
 */
export function watchResize(
  onResize: () => void,
  targets: readonly (Element | null | undefined)[],
  options: WatchOptions = {},
): () => void {
  let frame = 0;
  let disposed = false;
  const run = () => {
    frame = 0;
    onResize();
  };
  const changed =
    options.frame === 'next'
      ? () => {
          if (!disposed && !frame) frame = requestAnimationFrame(run);
        }
      : options.frame === 'last'
        ? () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(onResize);
          }
        : onResize;
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(changed);
  if (observer) targets.forEach((target) => target && observer.observe(target));
  window.addEventListener('resize', changed);
  if (options.visualViewport) window.visualViewport?.addEventListener('resize', changed);
  if (options.fonts) document.fonts?.addEventListener('loadingdone', changed);
  return () => {
    disposed = true;
    if (options.frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener('resize', changed);
    if (options.visualViewport) window.visualViewport?.removeEventListener('resize', changed);
    if (options.fonts) document.fonts?.removeEventListener('loadingdone', changed);
  };
}
