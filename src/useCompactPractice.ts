import { useEffect, useState } from 'react';

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
export const compactPracticeQuery =
  '(max-width: 620px), (max-height: 500px) and (max-width: 950px)';
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
