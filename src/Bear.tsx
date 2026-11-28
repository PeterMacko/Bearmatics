import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { useBearTap } from './useBearTap';
import { useMenuWink } from './useMenuWink';

/** Original SVG artwork and expressions created for Bearmatics. */
/** SCRUM-324: 'thinking' = a kind "hmm" (Pexeso miss): eyes look up, no frown. */
type BearMood = 'neutral' | 'happy' | 'sad' | 'thinking';
export default function Bear({
  mood = 'neutral',
  idleWink = false,
  reacting = false,
  bubble,
  onTap,
}: {
  mood?: BearMood;
  idleWink?: boolean;
  /** A lesson's answer reaction is showing: taps are ignored (SCRUM-172). */
  reacting?: boolean;
  /** The tap bubble's words ("Grrr!" / "Brum brum!"); without it the bear ignores taps. */
  bubble?: string;
  /** Called once per accepted tap (the growl). */
  onTap?: () => void;
}) {
  const { winking, idleMotion } = useMenuWink(idleWink && mood === 'neutral');
  const tap = useBearTap({
    reacting: reacting || !bubble,
    moodAnimates: mood !== 'neutral',
    onTap,
  });
  const tapped = tap.tapped;
  const bubbleRef = useRef<HTMLSpanElement>(null);
  // QA178-04: the room beside the head for the bubble (from 68% of the bear's box to the window's
  // right edge, or, when the bubble sits on the left, from the window's left edge to 32%),
  // measured on the tap BEFORE the bubble exists, so the bubble wraps to fit from its first
  // layout. A bubble that stuck out even for one layout made mobile browsers zoom out, which reset
  // the page scroll (Slovak at 200% text on a small phone).
  const [room, setRoom] = useState<{ right: number; left: number } | undefined>(undefined);
  const onClick = (event: MouseEvent<SVGSVGElement>) => {
    let host = event.currentTarget.parentElement;
    while (host && host !== document.body && getComputedStyle(host).position === 'static')
      host = host.parentElement;
    const width = document.documentElement.clientWidth;
    if (host && width > 0) {
      const box = host.getBoundingClientRect();
      setRoom({
        right: Math.max(0, Math.floor(width - 4 - (box.left + box.width * 0.68))),
        left: Math.max(0, Math.floor(box.left + box.width * 0.32 - 4)),
      });
    }
    tap.handlers.onClick();
  };
  // Fallback for a bubble wider than the room (a single very long word): shift it back inside the
  // window. Measured from layout offsets, because the pop-in scale transform changes the drawn box.
  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const parent = el.offsetParent;
    if (!parent) return;
    const left = parent.getBoundingClientRect().left + el.offsetLeft;
    const over = left + el.offsetWidth - (document.documentElement.clientWidth - 4);
    if (over > 0) el.style.marginLeft = `${-Math.ceil(over)}px`;
    else if (left < 4) el.style.marginLeft = `${Math.ceil(4 - left)}px`;
  }, [tapped, bubble]);
  return (
    <>
      <svg
        className={`bear bear-${mood}`}
        data-mood={mood}
        data-winking={winking || undefined}
        data-idle-motion={idleMotion}
        data-tapped={tapped || undefined}
        data-tap-hop={tap.hop || undefined}
        viewBox="0 0 260 280"
        aria-hidden="true"
        focusable="false"
        {...tap.handlers}
        onClick={onClick}
      >
        <ellipse className="bear-shadow" cx="130" cy="262" rx="82" ry="10" fill="#efdcbf" />
        <g className="bear-hop">
          <g className="bear-character">
            <ellipse cx="130" cy="205" rx="67" ry="62" fill="#a96e45" />
            <ellipse cx="130" cy="216" rx="40" ry="43" fill="#e9bf86" />
            <ellipse cx="73" cy="244" rx="30" ry="19" fill="#805037" />
            <ellipse cx="187" cy="244" rx="30" ry="19" fill="#805037" />
            <ellipse
              cx="69"
              cy="196"
              rx="17"
              ry="32"
              fill="#a96e45"
              transform="rotate(18 69 196)"
            />
            <g className="bear-arm-right">
              <ellipse
                cx="191"
                cy="196"
                rx="17"
                ry="32"
                fill="#a96e45"
                transform="rotate(-18 191 196)"
              />
            </g>
            <circle cx="63" cy="66" r="32" fill="#a96e45" />
            <circle cx="197" cy="66" r="32" fill="#a96e45" />
            <circle cx="63" cy="66" r="18" fill="#e9bf86" />
            <circle cx="197" cy="66" r="18" fill="#e9bf86" />
            <rect x="44" y="55" width="172" height="139" rx="72" fill="#b87b4e" />
            <ellipse cx="130" cy="149" rx="41" ry="32" fill="#f1d4a4" />
            {tapped ? (
              <g
                className="bear-tap-eyes"
                fill="none"
                stroke="#382a22"
                strokeWidth="5"
                strokeLinecap="round"
              >
                <path d="M90 121q7-12 14 0" />
                <path d="M156 121q7-12 14 0" />
              </g>
            ) : mood === 'happy' ? (
              <g fill="none" stroke="#382a22" strokeWidth="5" strokeLinecap="round">
                <path d="M90 121q7-12 14 0" />
                <path d="M156 121q7-12 14 0" />
              </g>
            ) : mood === 'thinking' ? (
              <g fill="#382a22" className="bear-thinking-eyes">
                <ellipse cx="100" cy="114" rx="6" ry="8" />
                <ellipse cx="166" cy="114" rx="6" ry="8" />
              </g>
            ) : (
              <g fill="#382a22">
                <ellipse cx="97" cy="119" rx="6" ry="8" />
                {winking ? (
                  <path
                    className="bear-wink-eye"
                    d="M156 120q7 6 14 0"
                    fill="none"
                    stroke="#382a22"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                ) : (
                  <ellipse cx="163" cy="119" rx="6" ry="8" />
                )}
              </g>
            )}
            {mood === 'sad' && !tapped && (
              <g fill="none" stroke="#805037" strokeWidth="4" strokeLinecap="round">
                <path d="M88 105l15-5" />
                <path d="M157 100l15 5" />
              </g>
            )}
            <ellipse cx="130" cy="139" rx="13" ry="9" fill="#382a22" />
            {tapped ? (
              <g className="bear-tap-mouth">
                <path
                  d="M130 146v5"
                  fill="none"
                  stroke="#382a22"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M114 154q16 26 32 0z"
                  fill="#382a22"
                  stroke="#382a22"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                <path d="M122 165q8-5 16 0q-8 6-16 0z" fill="#d86b6b" />
              </g>
            ) : (
              <path
                d={
                  mood === 'sad'
                    ? 'M130 146v7m-13 11q13-13 26 0'
                    : mood === 'happy'
                      ? 'M130 146v10m-17 0q17 23 34 0'
                      : mood === 'thinking'
                        ? 'M130 146v9m-9 4q9 3 18 0'
                        : 'M130 146v9m-10 4q10 5 20 0'
                }
                fill="none"
                stroke="#382a22"
                strokeWidth="4"
                strokeLinecap="round"
              />
            )}
            <circle cx="78" cy="143" r="10" fill="#d99174" opacity=".65" />
            <circle cx="182" cy="143" r="10" fill="#d99174" opacity=".65" />
            <path d="M94 185l36 14 36-14-12 31h-48z" fill="#447eb9" />
          </g>
        </g>
      </svg>
      {tapped && (
        <span
          ref={bubbleRef}
          className="bear-bubble"
          aria-hidden="true"
          style={
            room === undefined
              ? undefined
              : ({
                  '--bubble-room-right': `${room.right}px`,
                  '--bubble-room-left': `${room.left}px`,
                } as CSSProperties)
          }
        >
          {bubble}
        </span>
      )}
    </>
  );
}
