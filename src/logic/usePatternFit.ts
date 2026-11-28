import { useLayoutEffect, useRef } from 'react';
import { LAYOUT } from '../layoutSelectors';
import { watchResize } from '../watchResize';

/** Gap between the places of a row (narrower where 7 places would drop under 40 px). */
const PLACE_GAP = { wide: 6, narrow: 3 } as const;
/** Smallest place: 7 places x 40 px fit a 320 px phone; dice groups (Level 5) stay larger.
 *  Level 4's 8 places stay on one line on phones too (Peter, SCRUM-307), so they may get smaller. */
const MIN_PLACE = { pictures: 40, eight: 28, dice: 56 } as const;
/** Largest place on phones (compact lessons) and larger windows. */
const MAX_PLACE = {
  pictures: { compact: 76, wide: 84 },
  dice: { compact: 96, wide: 120 },
} as const;

/**
 * Sizes the pattern row (`--place`, `--cols` on the lesson section) to the room the screen has:
 * the largest place that fits the stage's width (always one line, also Level 4's 8 places), then shrink by however much the page overflows, never below the minimum (then the
 * page may scroll, e.g. very large text). The choices follow the place size in CSS (>= 56 px).
 * Same approach as useBoardFit / useWordGrid.
 */
export default function usePatternFit(...keys: unknown[]) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const section = ref.current;
    if (!section || typeof window === 'undefined') return;
    const fit = () => {
      const stage = section.querySelector<HTMLElement>('.pattern-stage');
      const play = section.querySelector<HTMLElement>('.pattern-play');
      if (!stage || !play) return;
      const places = Number(section.dataset.places) || 7;
      const kind = section.dataset.dice ? 'dice' : 'pictures';
      const compact = section.closest(LAYOUT.compactPractice) !== null;
      const max = MAX_PLACE[kind][compact ? 'compact' : 'wide'];
      const min = kind === 'pictures' && places === 8 ? MIN_PLACE.eight : MIN_PLACE[kind];
      const width = stage.clientWidth - 4;
      if (!(width > 0)) return; // no layout (unit tests)
      let gap: number = PLACE_GAP.wide;
      const across = (cols: number) => Math.floor((width - (cols - 1) * gap) / cols);
      const cols = places;
      if (across(cols) < min) gap = PLACE_GAP.narrow;
      const lines = Math.ceil(places / cols);
      const byWidth = across(cols);
      section.style.setProperty('--cols', String(cols));
      section.style.setProperty('--place-gap', `${gap}px`);
      const set = (place: number) => section.style.setProperty('--place', `${place}px`);
      let place = Math.min(max, byWidth);
      set(place);
      for (let i = 0; i < 4; i++) {
        // clientHeight is the layout viewport; innerHeight can grow while mobile browsers zoom out.
        const viewport = document.documentElement.clientHeight || window.innerHeight;
        const bottoms = Array.from(play.children).map(
          (child) => child.getBoundingClientRect().bottom + window.scrollY,
        );
        const overflow = Math.max(
          document.documentElement.scrollHeight - viewport,
          Math.max(...bottoms) + 8 - viewport,
          0,
        );
        if (overflow < 0.5) break;
        // The choices grow with the place (about 1.3x), so they share the shrink.
        const next = Math.max(Math.min(min, byWidth), Math.floor(place - overflow / (lines + 1.3)));
        if (next === place) break;
        place = next;
        set(place);
      }
    };
    fit();
    return watchResize(fit, [section.parentElement], { frame: 'last', fonts: true });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- refit when the caller's keys change
  }, keys);
  return ref;
}
