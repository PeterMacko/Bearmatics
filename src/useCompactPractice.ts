import { useEffect, useState } from 'react';
import { COMPACT_PRACTICE_QUERY } from './breakpoints';
import { ANY_COARSE_POINTER, hasTouch } from './touch';

// Capability is independent of viewport and the primary/most recent pointer.
export function useTouchCapability() {
  const [touch, setTouch] = useState(hasTouch);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const media = matchMedia(ANY_COARSE_POINTER);
    const update = () => setTouch(hasTouch());
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return touch;
}

// Short landscape phones need the compact layout too, not just narrow screens.
const compactPracticeQuery = COMPACT_PRACTICE_QUERY;
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
