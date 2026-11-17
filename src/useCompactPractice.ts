import { useEffect, useState } from 'react';
import { COMPACT_PRACTICE_QUERY } from './breakpoints';

// Capability is independent of viewport and the primary/most recent pointer.
export function useTouchCapability() {
  const detect = () =>
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    (typeof matchMedia !== 'undefined' && matchMedia('(any-pointer: coarse)').matches);
  const [touch, setTouch] = useState(detect);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const media = matchMedia('(any-pointer: coarse)');
    const update = () => setTouch(detect());
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return touch;
}

// Short landscape phones need the compact layout too, not just narrow screens.
export const compactPracticeQuery = COMPACT_PRACTICE_QUERY;
export function useCompactPractice() {
  const [compact, setCompact] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(compactPracticeQuery).matches,
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const media = matchMedia(compactPracticeQuery);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return compact;
}
