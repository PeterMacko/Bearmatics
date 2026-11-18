import type { MouseEvent, PointerEvent, RefObject } from 'react';
import type { Copy } from '../i18n';
import SpeakerIcon from './SpeakerIcon';

/** The large speaker that (re)plays the word; `playing` animates it. */
export default function SpeakerButton({
  t,
  speakerRef,
  playing,
  onReplay,
  keepKeyboard,
}: {
  t: Copy;
  speakerRef: RefObject<HTMLButtonElement | null>;
  playing: boolean;
  onReplay: () => void;
  /** Writing lessons: keep focus (and the on-screen keyboard) in the input. */
  keepKeyboard?: (event: PointerEvent | MouseEvent) => void;
}) {
  return (
    <button
      ref={speakerRef}
      type="button"
      className="speaker-button"
      data-playing={playing}
      aria-label={t.playWord}
      onPointerDown={keepKeyboard}
      onMouseDown={keepKeyboard}
      onClick={onReplay}
    >
      <SpeakerIcon />
    </button>
  );
}
