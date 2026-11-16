import { useEffect, useRef, useState } from 'react';
import { fill, type Copy } from './i18n';
import { PictureMotif, type PictureTheme } from './PictureGroup';

/**
 * SCRUM-156: Small maths "Take away". The basket holds the first number of pictures; a tap moves
 * a picture to "Taken out" and back. It never checks anything and never changes scoring; the
 * parent remounts it (key) for every new example or review repeat, so it starts full.
 */
export default function TakeAwayBasket({
  t,
  theme,
  total,
  onMove,
}: {
  t: Copy['basket'];
  theme: PictureTheme;
  total: number;
  /** Called on every move (the pop sound). */
  onMove: () => void;
}) {
  const [out, setOut] = useState<readonly boolean[]>(() => Array(total).fill(false));
  const [announcement, setAnnouncement] = useState('');
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  // The moved picture is a new button in the other area: keep keyboard focus on it.
  const refocus = useRef<number | null>(null);
  useEffect(() => {
    if (refocus.current === null) return;
    buttons.current.get(refocus.current)?.focus({ preventScroll: true });
    refocus.current = null;
  }, [out]);
  const name = t.names[theme];
  const move = (index: number, hadFocus: boolean) => {
    const next = out.map((value, i) => (i === index ? !value : value));
    setOut(next);
    if (hadFocus) refocus.current = index;
    const taken = next.filter(Boolean).length;
    setAnnouncement(fill(t.counts, { basket: total - taken, out: taken }));
    onMove();
  };
  const area = (taken: boolean) => {
    const items = out.flatMap((value, index) => (value === taken ? [index] : []));
    return (
      <div className={`basket-area ${taken ? 'taken-out' : 'in-basket'}`}>
        <h3 className="basket-title" id={`basket-${taken ? 'out' : 'in'}`}>
          {taken ? t.takenOut : t.basket}
        </h3>
        <div
          className="basket-items"
          role="group"
          aria-labelledby={`basket-${taken ? 'out' : 'in'}`}
        >
          {items.length === 0 && (
            <span className="basket-empty" aria-hidden="true">
              {t.empty}
            </span>
          )}
          {items.map((index) => (
            <button
              key={index}
              type="button"
              className="basket-picture"
              data-picture={index}
              aria-label={fill(taken ? t.out : t.inBasket, { name })}
              ref={(element) => {
                if (element) buttons.current.set(index, element);
                else buttons.current.delete(index);
              }}
              onClick={(event) => move(index, document.activeElement === event.currentTarget)}
            >
              <PictureMotif theme={theme} />
            </button>
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className="take-away">
      {area(false)}
      {area(true)}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}
